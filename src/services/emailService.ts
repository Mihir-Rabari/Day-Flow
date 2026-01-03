import nodemailer from 'nodemailer';
import { config } from '../config/config';
import { logger } from '../utils/logger';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface WelcomeEmailData {
  employeeName: string;
  loginId: string;
  temporaryPassword: string;
  loginUrl: string;
  companyName: string;
}

export interface PasswordResetEmailData {
  employeeName: string;
  resetToken: string;
  resetUrl: string;
  expirationTime: string;
}

export interface LeaveNotificationEmailData {
  employeeName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  status: 'approved' | 'rejected';
  comments?: string;
  approverName: string;
}

class EmailService {
  private transporter: nodemailer.Transporter;
  private maxRetries = 3;
  private retryDelay = 1000; // 1 second

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: config.email.smtp.host,
      port: config.email.smtp.port,
      secure: config.email.smtp.port === 465, // true for 465, false for other ports
      auth: {
        user: config.email.smtp.user,
        pass: config.email.smtp.pass,
      },
      tls: {
        rejectUnauthorized: false, // Allow self-signed certificates in development
      },
    });

    // Verify connection configuration
    this.verifyConnection();
  }

  private async verifyConnection(): Promise<void> {
    try {
      await this.transporter.verify();
      logger.info('Email service connection verified successfully');
    } catch (error) {
      logger.error('Email service connection failed:', error);
    }
  }

  private async sendEmailWithRetry(
    emailOptions: EmailOptions,
    retryCount = 0
  ): Promise<void> {
    try {
      const mailOptions = {
        from: `${config.email.from.name} <${config.email.from.email}>`,
        to: emailOptions.to,
        subject: emailOptions.subject,
        html: emailOptions.html,
        text: emailOptions.text,
      };

      const info = await this.transporter.sendMail(mailOptions);
      logger.info(`Email sent successfully to ${emailOptions.to}`, {
        messageId: info.messageId,
        subject: emailOptions.subject,
      });
    } catch (error) {
      logger.error(`Email sending failed (attempt ${retryCount + 1}):`, error);

      if (retryCount < this.maxRetries) {
        logger.info(`Retrying email send in ${this.retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        return this.sendEmailWithRetry(emailOptions, retryCount + 1);
      }

      throw new Error(
        `Failed to send email after ${this.maxRetries + 1} attempts: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  public async sendEmail(emailOptions: EmailOptions): Promise<void> {
    return this.sendEmailWithRetry(emailOptions);
  }

  // Email template methods
  public generateWelcomeEmail(data: WelcomeEmailData): EmailOptions {
    const subject = `Welcome to ${data.companyName} - Your Account Details`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to ${data.companyName}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .credentials { background-color: #e8f5e8; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .button { display: inline-block; padding: 12px 24px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to ${data.companyName}!</h1>
          </div>
          <div class="content">
            <h2>Hello ${data.employeeName},</h2>
            <p>Welcome to the team! Your employee account has been created successfully.</p>
            
            <div class="credentials">
              <h3>Your Login Credentials:</h3>
              <p><strong>Login ID:</strong> ${data.loginId}</p>
              <p><strong>Temporary Password:</strong> ${data.temporaryPassword}</p>
            </div>
            
            <p>Please log in to the system using the credentials above and change your password immediately for security purposes.</p>
            
            <a href="${data.loginUrl}" class="button">Login to Dayflow</a>
            
            <p><strong>Important Security Notes:</strong></p>
            <ul>
              <li>Change your password immediately after first login</li>
              <li>Use a strong password with at least 8 characters</li>
              <li>Never share your login credentials with anyone</li>
            </ul>
            
            <p>If you have any questions or need assistance, please contact the HR department.</p>
            
            <p>Best regards,<br>The ${data.companyName} Team</p>
          </div>
          <div class="footer">
            <p>This is an automated message. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      Welcome to ${data.companyName}!
      
      Hello ${data.employeeName},
      
      Welcome to the team! Your employee account has been created successfully.
      
      Your Login Credentials:
      Login ID: ${data.loginId}
      Temporary Password: ${data.temporaryPassword}
      
      Please log in to the system at ${data.loginUrl} and change your password immediately.
      
      Important Security Notes:
      - Change your password immediately after first login
      - Use a strong password with at least 8 characters
      - Never share your login credentials with anyone
      
      If you have any questions, please contact the HR department.
      
      Best regards,
      The ${data.companyName} Team
    `;

    return {
      to: '', // Will be set by the calling method
      subject,
      html,
      text,
    };
  }

  public generatePasswordResetEmail(
    data: PasswordResetEmailData
  ): EmailOptions {
    const subject = 'Password Reset Request - Dayflow HR System';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset Request</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #FF9800; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .reset-info { background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #FF9800; }
          .button { display: inline-block; padding: 12px 24px; background-color: #FF9800; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          .warning { color: #d32f2f; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Reset Request</h1>
          </div>
          <div class="content">
            <h2>Hello ${data.employeeName},</h2>
            <p>We received a request to reset your password for your Dayflow account.</p>
            
            <div class="reset-info">
              <h3>Reset Token:</h3>
              <p><strong>${data.resetToken}</strong></p>
              <p><strong>Expires:</strong> ${data.expirationTime}</p>
            </div>
            
            <p>Use the reset token above to reset your password, or click the button below:</p>
            
            <a href="${data.resetUrl}" class="button">Reset Password</a>
            
            <p class="warning">⚠️ Security Notice:</p>
            <ul>
              <li>This reset token will expire in 1 hour</li>
              <li>If you didn't request this reset, please ignore this email</li>
              <li>Never share your reset token with anyone</li>
              <li>Contact IT support if you suspect unauthorized access</li>
            </ul>
            
            <p>If you have any concerns, please contact the IT support team immediately.</p>
            
            <p>Best regards,<br>Dayflow Security Team</p>
          </div>
          <div class="footer">
            <p>This is an automated security message. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      Password Reset Request - Dayflow HR System
      
      Hello ${data.employeeName},
      
      We received a request to reset your password for your Dayflow account.
      
      Reset Token: ${data.resetToken}
      Expires: ${data.expirationTime}
      
      Use this token to reset your password at: ${data.resetUrl}
      
      Security Notice:
      - This reset token will expire in 1 hour
      - If you didn't request this reset, please ignore this email
      - Never share your reset token with anyone
      - Contact IT support if you suspect unauthorized access
      
      Best regards,
      Dayflow Security Team
    `;

    return {
      to: '', // Will be set by the calling method
      subject,
      html,
      text,
    };
  }

  public generateLeaveNotificationEmail(
    data: LeaveNotificationEmailData
  ): EmailOptions {
    const statusColor = data.status === 'approved' ? '#4CAF50' : '#f44336';
    const statusText = data.status === 'approved' ? 'Approved' : 'Rejected';
    const subject = `Leave Request ${statusText} - ${data.leaveType}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Leave Request ${statusText}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: ${statusColor}; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .leave-details { background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid ${statusColor}; }
          .status { font-size: 18px; font-weight: bold; color: ${statusColor}; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Leave Request Update</h1>
          </div>
          <div class="content">
            <h2>Hello ${data.employeeName},</h2>
            <p>Your leave request has been <span class="status">${statusText.toUpperCase()}</span>.</p>
            
            <div class="leave-details">
              <h3>Leave Details:</h3>
              <p><strong>Type:</strong> ${data.leaveType}</p>
              <p><strong>Start Date:</strong> ${data.startDate}</p>
              <p><strong>End Date:</strong> ${data.endDate}</p>
              <p><strong>Status:</strong> <span class="status">${statusText}</span></p>
              <p><strong>Reviewed by:</strong> ${data.approverName}</p>
              ${data.comments ? `<p><strong>Comments:</strong> ${data.comments}</p>` : ''}
            </div>
            
            ${
              data.status === 'approved'
                ? '<p>Your leave has been approved. Please ensure proper handover of your responsibilities before your leave begins.</p>'
                : '<p>Your leave request has been rejected. Please contact your manager or HR for more information.</p>'
            }
            
            <p>If you have any questions about this decision, please contact your reporting manager or the HR department.</p>
            
            <p>Best regards,<br>Dayflow HR Team</p>
          </div>
          <div class="footer">
            <p>This is an automated message. Please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      Leave Request ${statusText} - Dayflow HR System
      
      Hello ${data.employeeName},
      
      Your leave request has been ${statusText.toUpperCase()}.
      
      Leave Details:
      Type: ${data.leaveType}
      Start Date: ${data.startDate}
      End Date: ${data.endDate}
      Status: ${statusText}
      Reviewed by: ${data.approverName}
      ${data.comments ? `Comments: ${data.comments}` : ''}
      
      ${
        data.status === 'approved'
          ? 'Your leave has been approved. Please ensure proper handover of your responsibilities before your leave begins.'
          : 'Your leave request has been rejected. Please contact your manager or HR for more information.'
      }
      
      If you have any questions, please contact your reporting manager or HR department.
      
      Best regards,
      Dayflow HR Team
    `;

    return {
      to: '', // Will be set by the calling method
      subject,
      html,
      text,
    };
  }

  // High-level email sending methods
  public async sendWelcomeEmail(
    employeeEmail: string,
    employeeName: string,
    loginId: string,
    temporaryPassword: string
  ): Promise<void> {
    try {
      const welcomeData: WelcomeEmailData = {
        employeeName,
        loginId,
        temporaryPassword,
        loginUrl: `${process.env.FRONTEND_URL || 'http://localhost:3001'}/login`,
        companyName: config.email.from.name.replace(' HR System', ''),
      };

      const emailOptions = this.generateWelcomeEmail(welcomeData);
      emailOptions.to = employeeEmail;

      await this.sendEmail(emailOptions);

      logger.info(`Welcome email sent successfully to ${employeeEmail}`, {
        loginId,
        employeeName,
      });
    } catch (error) {
      logger.error(`Failed to send welcome email to ${employeeEmail}:`, error);
      throw new Error(
        `Failed to send welcome email: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  public async sendPasswordResetEmail(
    employeeEmail: string,
    employeeName: string,
    resetToken: string
  ): Promise<void> {
    try {
      const expirationTime = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
      const resetData: PasswordResetEmailData = {
        employeeName,
        resetToken,
        resetUrl: `${process.env.FRONTEND_URL || 'http://localhost:3001'}/reset-password?token=${resetToken}`,
        expirationTime: expirationTime.toLocaleString(),
      };

      const emailOptions = this.generatePasswordResetEmail(resetData);
      emailOptions.to = employeeEmail;

      await this.sendEmail(emailOptions);

      logger.info(
        `Password reset email sent successfully to ${employeeEmail}`,
        {
          resetToken: resetToken.substring(0, 8) + '...', // Log partial token for security
          employeeName,
        }
      );
    } catch (error) {
      logger.error(
        `Failed to send password reset email to ${employeeEmail}:`,
        error
      );
      throw new Error(
        `Failed to send password reset email: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  public async sendLeaveNotificationEmail(
    employeeEmail: string,
    employeeName: string,
    leaveType: string,
    startDate: Date,
    endDate: Date,
    status: 'approved' | 'rejected',
    approverName: string,
    comments?: string
  ): Promise<void> {
    try {
      const leaveData: LeaveNotificationEmailData = {
        employeeName,
        leaveType,
        startDate: startDate.toLocaleDateString(),
        endDate: endDate.toLocaleDateString(),
        status,
        approverName,
        comments,
      };

      const emailOptions = this.generateLeaveNotificationEmail(leaveData);
      emailOptions.to = employeeEmail;

      await this.sendEmail(emailOptions);

      logger.info(
        `Leave notification email sent successfully to ${employeeEmail}`,
        {
          leaveType,
          status,
          approverName,
          employeeName,
        }
      );
    } catch (error) {
      logger.error(
        `Failed to send leave notification email to ${employeeEmail}:`,
        error
      );
      throw new Error(
        `Failed to send leave notification email: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  // Utility method to test email configuration
  public async testEmailConfiguration(): Promise<boolean> {
    try {
      await this.verifyConnection();
      return true;
    } catch (error) {
      logger.error('Email configuration test failed:', error);
      return false;
    }
  }

  // Method to send bulk emails (for future use)
  public async sendBulkEmails(emails: EmailOptions[]): Promise<void> {
    const results = await Promise.allSettled(
      emails.map(email => this.sendEmail(email))
    );

    const failed = results.filter(result => result.status === 'rejected');
    if (failed.length > 0) {
      logger.warn(
        `${failed.length} out of ${emails.length} emails failed to send`
      );
      failed.forEach((result, index) => {
        if (result.status === 'rejected') {
          logger.error(`Bulk email ${index} failed:`, result.reason);
        }
      });
    }

    logger.info(
      `Bulk email sending completed: ${emails.length - failed.length}/${emails.length} successful`
    );
  }
}

export const emailService = new EmailService();
