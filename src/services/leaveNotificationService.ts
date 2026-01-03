import { PrismaClient, LeaveStatus, LeaveType } from '@prisma/client';
import { emailService } from './emailService';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export class LeaveNotificationService {
  /**
   * Send notification when leave request status changes
   */
  static async sendLeaveStatusNotification(
    leaveRequestId: string,
    newStatus: LeaveStatus,
    approverName: string,
    comments?: string
  ): Promise<void> {
    try {
      // Get leave request with employee details
      const leaveRequest = await prisma.leaveRequest.findUnique({
        where: { id: leaveRequestId },
        include: {
          employee: true,
        },
      });

      if (!leaveRequest) {
        throw new Error('Leave request not found');
      }

      if (!leaveRequest.employee.isActive) {
        logger.warn('Attempted to send notification to inactive employee', {
          leaveRequestId,
          employeeId: leaveRequest.employeeId,
        });
        return;
      }

      // Only send notifications for approved/rejected status
      if (newStatus === LeaveStatus.PENDING) {
        return;
      }

      const status =
        newStatus === LeaveStatus.APPROVED ? 'approved' : 'rejected';
      const leaveTypeDisplay = this.formatLeaveType(leaveRequest.type);

      await emailService.sendLeaveNotificationEmail(
        leaveRequest.employee.email,
        `${leaveRequest.employee.firstName} ${leaveRequest.employee.lastName}`,
        leaveTypeDisplay,
        leaveRequest.startDate,
        leaveRequest.endDate,
        status,
        approverName,
        comments
      );

      logger.info('Leave status notification sent successfully', {
        leaveRequestId,
        employeeId: leaveRequest.employeeId,
        status: newStatus,
        approverName,
      });
    } catch (error) {
      logger.error('Failed to send leave status notification', {
        error: error instanceof Error ? error.message : 'Unknown error',
        leaveRequestId,
        newStatus,
        approverName,
      });
      throw new Error(
        `Failed to send leave notification: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Send notification when new leave request is submitted (to managers/HR)
   */
  static async sendLeaveApplicationNotification(
    leaveRequestId: string
  ): Promise<void> {
    try {
      // Get leave request with employee details
      const leaveRequest = await prisma.leaveRequest.findUnique({
        where: { id: leaveRequestId },
        include: {
          employee: true,
        },
      });

      if (!leaveRequest) {
        throw new Error('Leave request not found');
      }

      // Get HR officers and admins to notify
      const approvers = await prisma.employee.findMany({
        where: {
          OR: [{ role: 'HR_OFFICER' }, { role: 'ADMIN' }],
          isActive: true,
        },
      });

      // Also notify reporting manager if specified
      let reportingManager = null;
      if (leaveRequest.employee.reportingManager) {
        reportingManager = await prisma.employee.findFirst({
          where: {
            loginId: leaveRequest.employee.reportingManager,
            isActive: true,
          },
        });
      }

      const notificationRecipients = [...approvers];
      if (reportingManager) {
        notificationRecipients.push(reportingManager);
      }

      // Send notifications to all approvers
      const notificationPromises = notificationRecipients.map(
        async approver => {
          try {
            await this.sendLeaveApplicationEmail(leaveRequest, approver);
          } catch (error) {
            logger.error(
              'Failed to send leave application notification to approver',
              {
                leaveRequestId,
                approverId: approver.id,
                error: error instanceof Error ? error.message : 'Unknown error',
              }
            );
          }
        }
      );

      await Promise.allSettled(notificationPromises);

      logger.info('Leave application notifications sent', {
        leaveRequestId,
        recipientCount: notificationRecipients.length,
      });
    } catch (error) {
      logger.error('Failed to send leave application notifications', {
        error: error instanceof Error ? error.message : 'Unknown error',
        leaveRequestId,
      });
      throw new Error(
        `Failed to send leave application notifications: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Send bulk leave reminders (for upcoming leaves)
   */
  static async sendLeaveReminders(): Promise<void> {
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);

      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      nextWeek.setHours(23, 59, 59, 999);

      // Get approved leaves starting tomorrow or within next week
      const upcomingLeaves = await prisma.leaveRequest.findMany({
        where: {
          status: LeaveStatus.APPROVED,
          startDate: {
            gte: tomorrow,
            lte: nextWeek,
          },
        },
        include: {
          employee: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              isActive: true,
            },
          },
        },
      });

      const reminderPromises = upcomingLeaves
        .filter(leave => leave.employee.isActive)
        .map(async leave => {
          try {
            await this.sendLeaveReminderEmail(leave);
          } catch (error) {
            logger.error('Failed to send leave reminder', {
              leaveRequestId: leave.id,
              employeeId: leave.employeeId,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        });

      await Promise.allSettled(reminderPromises);

      logger.info('Leave reminders sent', {
        reminderCount: upcomingLeaves.length,
      });
    } catch (error) {
      logger.error('Failed to send leave reminders', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Format leave type for display
   */
  private static formatLeaveType(type: LeaveType): string {
    switch (type) {
      case LeaveType.PAID:
        return 'Paid Leave';
      case LeaveType.SICK:
        return 'Sick Leave';
      case LeaveType.UNPAID:
        return 'Unpaid Leave';
      case LeaveType.CASUAL:
        return 'Casual Leave';
      case LeaveType.MATERNITY:
        return 'Maternity Leave';
      case LeaveType.PATERNITY:
        return 'Paternity Leave';
      default:
        return 'Leave';
    }
  }

  /**
   * Send leave application notification email to approvers
   */
  private static async sendLeaveApplicationEmail(
    leaveRequest: any,
    approver: any
  ): Promise<void> {
    const leaveTypeDisplay = this.formatLeaveType(leaveRequest.type);
    const employeeName = `${leaveRequest.employee.firstName} ${leaveRequest.employee.lastName}`;

    const subject = `New Leave Request - ${employeeName} (${leaveTypeDisplay})`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Leave Request</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #2196F3; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .leave-details { background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #2196F3; }
          .button { display: inline-block; padding: 12px 24px; background-color: #2196F3; color: white; text-decoration: none; border-radius: 5px; margin: 10px 5px; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>New Leave Request</h1>
          </div>
          <div class="content">
            <h2>Hello ${approver.firstName},</h2>
            <p>A new leave request has been submitted and requires your review.</p>
            
            <div class="leave-details">
              <h3>Leave Request Details:</h3>
              <p><strong>Employee:</strong> ${employeeName}</p>
              <p><strong>Type:</strong> ${leaveTypeDisplay}</p>
              <p><strong>Start Date:</strong> ${leaveRequest.startDate.toLocaleDateString()}</p>
              <p><strong>End Date:</strong> ${leaveRequest.endDate.toLocaleDateString()}</p>
              <p><strong>Duration:</strong> ${leaveRequest.days} day(s)</p>
              <p><strong>Reason:</strong> ${leaveRequest.reason}</p>
              <p><strong>Applied Date:</strong> ${leaveRequest.appliedDate.toLocaleDateString()}</p>
            </div>
            
            <p>Please review this request and take appropriate action.</p>
            
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3001'}/leave-requests" class="button">Review Request</a>
            
            <p>Best regards,<br>Dayflow HR System</p>
          </div>
          <div class="footer">
            <p>This is an automated message. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      New Leave Request - Dayflow HR System
      
      Hello ${approver.firstName},
      
      A new leave request has been submitted and requires your review.
      
      Leave Request Details:
      Employee: ${employeeName}
      Type: ${leaveTypeDisplay}
      Start Date: ${leaveRequest.startDate.toLocaleDateString()}
      End Date: ${leaveRequest.endDate.toLocaleDateString()}
      Duration: ${leaveRequest.days} day(s)
      Reason: ${leaveRequest.reason}
      Applied Date: ${leaveRequest.appliedDate.toLocaleDateString()}
      
      Please review this request and take appropriate action.
      
      Best regards,
      Dayflow HR System
    `;

    await emailService.sendEmail({
      to: approver.email,
      subject,
      html,
      text,
    });
  }

  /**
   * Send leave reminder email
   */
  private static async sendLeaveReminderEmail(
    leaveRequest: any
  ): Promise<void> {
    const leaveTypeDisplay = this.formatLeaveType(leaveRequest.type);
    const employeeName = `${leaveRequest.employee.firstName} ${leaveRequest.employee.lastName}`;

    const daysUntilLeave = Math.ceil(
      (leaveRequest.startDate.getTime() - new Date().getTime()) /
        (1000 * 60 * 60 * 24)
    );

    const subject = `Leave Reminder - ${leaveTypeDisplay} starts ${daysUntilLeave === 1 ? 'tomorrow' : `in ${daysUntilLeave} days`}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Leave Reminder</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #FF9800; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .leave-details { background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #FF9800; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Leave Reminder</h1>
          </div>
          <div class="content">
            <h2>Hello ${employeeName},</h2>
            <p>This is a reminder that your approved leave is starting ${daysUntilLeave === 1 ? 'tomorrow' : `in ${daysUntilLeave} days`}.</p>
            
            <div class="leave-details">
              <h3>Leave Details:</h3>
              <p><strong>Type:</strong> ${leaveTypeDisplay}</p>
              <p><strong>Start Date:</strong> ${leaveRequest.startDate.toLocaleDateString()}</p>
              <p><strong>End Date:</strong> ${leaveRequest.endDate.toLocaleDateString()}</p>
              <p><strong>Duration:</strong> ${leaveRequest.days} day(s)</p>
            </div>
            
            <p><strong>Reminders:</strong></p>
            <ul>
              <li>Complete any pending handovers</li>
              <li>Set up out-of-office messages</li>
              <li>Inform your team about your absence</li>
              <li>Ensure all urgent tasks are completed or delegated</li>
            </ul>
            
            <p>Have a great time off!</p>
            
            <p>Best regards,<br>Dayflow HR Team</p>
          </div>
          <div class="footer">
            <p>This is an automated reminder. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      Leave Reminder - Dayflow HR System
      
      Hello ${employeeName},
      
      This is a reminder that your approved leave is starting ${daysUntilLeave === 1 ? 'tomorrow' : `in ${daysUntilLeave} days`}.
      
      Leave Details:
      Type: ${leaveTypeDisplay}
      Start Date: ${leaveRequest.startDate.toLocaleDateString()}
      End Date: ${leaveRequest.endDate.toLocaleDateString()}
      Duration: ${leaveRequest.days} day(s)
      
      Reminders:
      - Complete any pending handovers
      - Set up out-of-office messages
      - Inform your team about your absence
      - Ensure all urgent tasks are completed or delegated
      
      Have a great time off!
      
      Best regards,
      Dayflow HR Team
    `;

    await emailService.sendEmail({
      to: leaveRequest.employee.email,
      subject,
      html,
      text,
    });
  }
}
