import { PrismaClient, LeaveStatus, LeaveType } from '@prisma/client';
import {
  CreateLeaveRequest,
  LeaveFilters,
  LeaveBalance,
  PaginatedResponse,
  LeaveRequest,
  PaginationOptions,
} from '../types';
import { LeaveNotificationService } from './leaveNotificationService';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export class LeaveService {
  /**
   * Apply for leave
   */
  static async applyLeave(
    employeeId: string,
    request: CreateLeaveRequest
  ): Promise<LeaveRequest> {
    try {
      // Validate employee exists and is active
      const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
      });

      if (!employee) {
        throw new Error('Employee not found');
      }

      if (!employee.isActive) {
        throw new Error('Employee is not active');
      }

      // Validate dates
      const startDate = new Date(request.startDate);
      const endDate = new Date(request.endDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (startDate < today) {
        throw new Error('Leave start date cannot be in the past');
      }

      if (endDate < startDate) {
        throw new Error('Leave end date cannot be before start date');
      }

      // Calculate number of days
      const timeDiff = endDate.getTime() - startDate.getTime();
      const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1; // Include both start and end dates
      const days = request.halfDay ? 0.5 : daysDiff;

      // Check for overlapping leave requests
      const overlappingLeaves = await prisma.leaveRequest.findMany({
        where: {
          employeeId,
          status: {
            in: [LeaveStatus.PENDING, LeaveStatus.APPROVED],
          },
          OR: [
            {
              startDate: {
                lte: endDate,
              },
              endDate: {
                gte: startDate,
              },
            },
          ],
        },
      });

      if (overlappingLeaves.length > 0) {
        throw new Error(
          'Leave request overlaps with existing pending or approved leave'
        );
      }

      // Check leave balance for paid leave types
      if (
        request.type === LeaveType.PAID ||
        request.type === LeaveType.CASUAL
      ) {
        const currentYear = new Date().getFullYear();
        const leaveBalance = await this.getLeaveBalance(
          employeeId,
          currentYear
        );

        if (
          request.type === LeaveType.PAID &&
          days > leaveBalance.remainingPaidLeave
        ) {
          throw new Error('Insufficient paid leave balance');
        }

        if (
          request.type === LeaveType.CASUAL &&
          days > leaveBalance.remainingCasualLeave
        ) {
          throw new Error('Insufficient casual leave balance');
        }
      }

      // Create leave request
      const leaveRequest = await prisma.leaveRequest.create({
        data: {
          employeeId,
          type: request.type,
          startDate,
          endDate,
          days,
          reason: request.reason,
          status: LeaveStatus.PENDING,
        },
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              department: true,
            },
          },
        },
      });

      // Send notification to approvers
      try {
        await LeaveNotificationService.sendLeaveApplicationNotification(
          leaveRequest.id
        );
      } catch (error) {
        logger.warn('Failed to send leave application notification', {
          leaveRequestId: leaveRequest.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      logger.info('Leave request created successfully', {
        leaveRequestId: leaveRequest.id,
        employeeId,
        type: request.type,
        days,
      });

      return {
        id: leaveRequest.id,
        employeeId: leaveRequest.employeeId,
        type: leaveRequest.type as LeaveType,
        startDate: leaveRequest.startDate,
        endDate: leaveRequest.endDate,
        days: leaveRequest.days,
        reason: leaveRequest.reason,
        status: leaveRequest.status as LeaveStatus,
        appliedDate: leaveRequest.appliedDate,
        approvedBy: leaveRequest.approvedBy,
        approvedDate: leaveRequest.approvedDate,
        comments: leaveRequest.comments,
        createdAt: leaveRequest.createdAt,
        updatedAt: leaveRequest.updatedAt,
      };
    } catch (error) {
      logger.error('Failed to create leave request', {
        error: error instanceof Error ? error.message : 'Unknown error',
        employeeId,
        request,
      });
      throw error;
    }
  }

  /**
   * Approve leave request
   */
  static async approveLeave(
    leaveId: string,
    approverId: string,
    comments?: string
  ): Promise<LeaveRequest> {
    try {
      // Validate approver exists and has permission
      const approver = await prisma.employee.findUnique({
        where: { id: approverId },
      });

      if (!approver) {
        throw new Error('Approver not found');
      }

      if (!['HR_OFFICER', 'ADMIN'].includes(approver.role)) {
        throw new Error('Insufficient permissions to approve leave');
      }

      // Get leave request
      const leaveRequest = await prisma.leaveRequest.findUnique({
        where: { id: leaveId },
        include: {
          employee: true,
        },
      });

      if (!leaveRequest) {
        throw new Error('Leave request not found');
      }

      if (leaveRequest.status !== LeaveStatus.PENDING) {
        throw new Error('Leave request is not in pending status');
      }

      // Update leave request
      const updatedLeave = await prisma.leaveRequest.update({
        where: { id: leaveId },
        data: {
          status: LeaveStatus.APPROVED,
          approvedBy: approverId,
          approvedDate: new Date(),
          comments,
        },
      });

      // Send notification to employee
      try {
        await LeaveNotificationService.sendLeaveStatusNotification(
          leaveId,
          LeaveStatus.APPROVED,
          `${approver.firstName} ${approver.lastName}`,
          comments
        );
      } catch (error) {
        logger.warn('Failed to send leave approval notification', {
          leaveRequestId: leaveId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      logger.info('Leave request approved successfully', {
        leaveRequestId: leaveId,
        approverId,
        employeeId: leaveRequest.employeeId,
      });

      return {
        id: updatedLeave.id,
        employeeId: updatedLeave.employeeId,
        type: updatedLeave.type as LeaveType,
        startDate: updatedLeave.startDate,
        endDate: updatedLeave.endDate,
        days: updatedLeave.days,
        reason: updatedLeave.reason,
        status: updatedLeave.status as LeaveStatus,
        appliedDate: updatedLeave.appliedDate,
        approvedBy: updatedLeave.approvedBy,
        approvedDate: updatedLeave.approvedDate,
        comments: updatedLeave.comments,
        createdAt: updatedLeave.createdAt,
        updatedAt: updatedLeave.updatedAt,
      };
    } catch (error) {
      logger.error('Failed to approve leave request', {
        error: error instanceof Error ? error.message : 'Unknown error',
        leaveId,
        approverId,
      });
      throw error;
    }
  }

  /**
   * Reject leave request
   */
  static async rejectLeave(
    leaveId: string,
    approverId: string,
    comments: string
  ): Promise<LeaveRequest> {
    try {
      // Validate approver exists and has permission
      const approver = await prisma.employee.findUnique({
        where: { id: approverId },
      });

      if (!approver) {
        throw new Error('Approver not found');
      }

      if (!['HR_OFFICER', 'ADMIN'].includes(approver.role)) {
        throw new Error('Insufficient permissions to reject leave');
      }

      // Get leave request
      const leaveRequest = await prisma.leaveRequest.findUnique({
        where: { id: leaveId },
        include: {
          employee: true,
        },
      });

      if (!leaveRequest) {
        throw new Error('Leave request not found');
      }

      if (leaveRequest.status !== LeaveStatus.PENDING) {
        throw new Error('Leave request is not in pending status');
      }

      if (!comments || comments.trim().length === 0) {
        throw new Error('Comments are required when rejecting leave');
      }

      // Update leave request
      const updatedLeave = await prisma.leaveRequest.update({
        where: { id: leaveId },
        data: {
          status: LeaveStatus.REJECTED,
          approvedBy: approverId,
          approvedDate: new Date(),
          comments: comments.trim(),
        },
      });

      // Send notification to employee
      try {
        await LeaveNotificationService.sendLeaveStatusNotification(
          leaveId,
          LeaveStatus.REJECTED,
          `${approver.firstName} ${approver.lastName}`,
          comments
        );
      } catch (error) {
        logger.warn('Failed to send leave rejection notification', {
          leaveRequestId: leaveId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      logger.info('Leave request rejected successfully', {
        leaveRequestId: leaveId,
        approverId,
        employeeId: leaveRequest.employeeId,
      });

      return {
        id: updatedLeave.id,
        employeeId: updatedLeave.employeeId,
        type: updatedLeave.type as LeaveType,
        startDate: updatedLeave.startDate,
        endDate: updatedLeave.endDate,
        days: updatedLeave.days,
        reason: updatedLeave.reason,
        status: updatedLeave.status as LeaveStatus,
        appliedDate: updatedLeave.appliedDate,
        approvedBy: updatedLeave.approvedBy,
        approvedDate: updatedLeave.approvedDate,
        comments: updatedLeave.comments,
        createdAt: updatedLeave.createdAt,
        updatedAt: updatedLeave.updatedAt,
      };
    } catch (error) {
      logger.error('Failed to reject leave request', {
        error: error instanceof Error ? error.message : 'Unknown error',
        leaveId,
        approverId,
      });
      throw error;
    }
  }

  /**
   * Get leave requests with filtering and pagination
   */
  static async getLeaveRequests(
    filters: LeaveFilters,
    pagination: PaginationOptions
  ): Promise<PaginatedResponse<LeaveRequest>> {
    try {
      const {
        page,
        limit,
        sortBy = 'appliedDate',
        sortOrder = 'desc',
      } = pagination;
      const skip = (page - 1) * limit;

      // Build where clause
      const where: any = {};

      if (filters.employeeId) {
        where.employeeId = filters.employeeId;
      }

      if (filters.type) {
        where.type = filters.type;
      }

      if (filters.status) {
        where.status = filters.status;
      }

      if (filters.startDate || filters.endDate) {
        where.startDate = {};
        if (filters.startDate) {
          where.startDate.gte = filters.startDate;
        }
        if (filters.endDate) {
          where.startDate.lte = filters.endDate;
        }
      }

      if (filters.appliedDateFrom || filters.appliedDateTo) {
        where.appliedDate = {};
        if (filters.appliedDateFrom) {
          where.appliedDate.gte = filters.appliedDateFrom;
        }
        if (filters.appliedDateTo) {
          where.appliedDate.lte = filters.appliedDateTo;
        }
      }

      if (filters.approvedBy) {
        where.approvedBy = filters.approvedBy;
      }

      // Get total count
      const total = await prisma.leaveRequest.count({ where });

      // Get paginated data
      const leaveRequests = await prisma.leaveRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              department: true,
              loginId: true,
            },
          },
        },
      });

      const data: LeaveRequest[] = leaveRequests.map(leave => ({
        id: leave.id,
        employeeId: leave.employeeId,
        type: leave.type as LeaveType,
        startDate: leave.startDate,
        endDate: leave.endDate,
        days: leave.days,
        reason: leave.reason,
        status: leave.status as LeaveStatus,
        appliedDate: leave.appliedDate,
        approvedBy: leave.approvedBy,
        approvedDate: leave.approvedDate,
        comments: leave.comments,
        createdAt: leave.createdAt,
        updatedAt: leave.updatedAt,
      }));

      return {
        data,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      logger.error('Failed to get leave requests', {
        error: error instanceof Error ? error.message : 'Unknown error',
        filters,
        pagination,
      });
      throw new Error('Failed to retrieve leave requests');
    }
  }

  /**
   * Get leave balance for an employee
   */
  static async getLeaveBalance(
    employeeId: string,
    year: number
  ): Promise<LeaveBalance> {
    try {
      // Validate employee exists
      const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
      });

      if (!employee) {
        throw new Error('Employee not found');
      }

      // Define annual leave entitlements (these could be configurable)
      const ANNUAL_PAID_LEAVE = 21; // 21 days per year
      const ANNUAL_SICK_LEAVE = 12; // 12 days per year
      const ANNUAL_CASUAL_LEAVE = 12; // 12 days per year

      // Calculate used leave for the year
      const yearStart = new Date(year, 0, 1);
      const yearEnd = new Date(year, 11, 31);

      const usedLeaves = await prisma.leaveRequest.findMany({
        where: {
          employeeId,
          status: LeaveStatus.APPROVED,
          startDate: {
            gte: yearStart,
            lte: yearEnd,
          },
        },
      });

      // Calculate totals by type
      let usedPaidLeave = 0;
      let usedSickLeave = 0;
      let usedCasualLeave = 0;

      usedLeaves.forEach(leave => {
        switch (leave.type) {
          case LeaveType.PAID:
            usedPaidLeave += leave.days;
            break;
          case LeaveType.SICK:
            usedSickLeave += leave.days;
            break;
          case LeaveType.CASUAL:
            usedCasualLeave += leave.days;
            break;
          // Unpaid, Maternity, and Paternity leaves don't count against annual balance
        }
      });

      return {
        employeeId,
        year,
        totalPaidLeave: ANNUAL_PAID_LEAVE,
        usedPaidLeave,
        remainingPaidLeave: Math.max(0, ANNUAL_PAID_LEAVE - usedPaidLeave),
        totalSickLeave: ANNUAL_SICK_LEAVE,
        usedSickLeave,
        remainingSickLeave: Math.max(0, ANNUAL_SICK_LEAVE - usedSickLeave),
        totalCasualLeave: ANNUAL_CASUAL_LEAVE,
        usedCasualLeave,
        remainingCasualLeave: Math.max(
          0,
          ANNUAL_CASUAL_LEAVE - usedCasualLeave
        ),
      };
    } catch (error) {
      logger.error('Failed to get leave balance', {
        error: error instanceof Error ? error.message : 'Unknown error',
        employeeId,
        year,
      });
      throw error;
    }
  }

  /**
   * Get leave request by ID
   */
  static async getLeaveRequestById(
    leaveId: string
  ): Promise<LeaveRequest | null> {
    try {
      const leaveRequest = await prisma.leaveRequest.findUnique({
        where: { id: leaveId },
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              department: true,
              loginId: true,
            },
          },
        },
      });

      if (!leaveRequest) {
        return null;
      }

      return {
        id: leaveRequest.id,
        employeeId: leaveRequest.employeeId,
        type: leaveRequest.type as LeaveType,
        startDate: leaveRequest.startDate,
        endDate: leaveRequest.endDate,
        days: leaveRequest.days,
        reason: leaveRequest.reason,
        status: leaveRequest.status as LeaveStatus,
        appliedDate: leaveRequest.appliedDate,
        approvedBy: leaveRequest.approvedBy,
        approvedDate: leaveRequest.approvedDate,
        comments: leaveRequest.comments,
        createdAt: leaveRequest.createdAt,
        updatedAt: leaveRequest.updatedAt,
      };
    } catch (error) {
      logger.error('Failed to get leave request by ID', {
        error: error instanceof Error ? error.message : 'Unknown error',
        leaveId,
      });
      throw new Error('Failed to retrieve leave request');
    }
  }

  /**
   * Cancel leave request (only for pending requests by the employee)
   */
  static async cancelLeaveRequest(
    leaveId: string,
    employeeId: string
  ): Promise<LeaveRequest> {
    try {
      // Get leave request
      const leaveRequest = await prisma.leaveRequest.findUnique({
        where: { id: leaveId },
      });

      if (!leaveRequest) {
        throw new Error('Leave request not found');
      }

      if (leaveRequest.employeeId !== employeeId) {
        throw new Error('Unauthorized to cancel this leave request');
      }

      if (leaveRequest.status !== LeaveStatus.PENDING) {
        throw new Error('Only pending leave requests can be cancelled');
      }

      // Delete the leave request (cancellation)
      await prisma.leaveRequest.delete({
        where: { id: leaveId },
      });

      logger.info('Leave request cancelled successfully', {
        leaveRequestId: leaveId,
        employeeId,
      });

      return {
        id: leaveRequest.id,
        employeeId: leaveRequest.employeeId,
        type: leaveRequest.type as LeaveType,
        startDate: leaveRequest.startDate,
        endDate: leaveRequest.endDate,
        days: leaveRequest.days,
        reason: leaveRequest.reason,
        status: leaveRequest.status as LeaveStatus,
        appliedDate: leaveRequest.appliedDate,
        approvedBy: leaveRequest.approvedBy,
        approvedDate: leaveRequest.approvedDate,
        comments: leaveRequest.comments,
        createdAt: leaveRequest.createdAt,
        updatedAt: leaveRequest.updatedAt,
      };
    } catch (error) {
      logger.error('Failed to cancel leave request', {
        error: error instanceof Error ? error.message : 'Unknown error',
        leaveId,
        employeeId,
      });
      throw error;
    }
  }
}
