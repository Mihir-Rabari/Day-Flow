import { prisma } from '../database/client';
import { PasswordService } from './passwordService';
import { emailService } from './emailService';
import { logger } from '../utils/logger';

interface PasswordResetToken {
  id: string;
  employeeId: string;
  token: string;
  expiresAt: Date;
  used: boolean;
  createdAt: Date;
}

export class PasswordResetService {
  private static readonly TOKEN_EXPIRY_HOURS = 1; // 1 hour

  /**
   * Initiate password reset process by generating token and sending email
   */
  static async initiatePasswordReset(email: string): Promise<void> {
    try {
      // Find employee by email
      const employee = await prisma.employee.findUnique({
        where: { email: email.toLowerCase().trim() },
      });

      if (!employee) {
        // Don't reveal if email exists or not for security
        logger.warn('Password reset attempted for non-existent email', {
          email,
        });
        return;
      }

      if (!employee.isActive) {
        logger.warn('Password reset attempted for inactive employee', {
          employeeId: employee.id,
          email,
        });
        return;
      }

      // Generate reset token
      const resetToken = PasswordService.generateResetToken();
      const expiresAt = new Date(
        Date.now() + this.TOKEN_EXPIRY_HOURS * 60 * 60 * 1000
      );

      // Store reset token in database (you'll need to add this table to schema)
      // For now, we'll use a simple approach with employee table
      // In production, you should create a separate password_reset_tokens table

      // Invalidate any existing tokens for this employee
      await this.invalidateExistingTokens(employee.id);

      // Store the new token (simplified - in production use separate table)
      const tokenData = {
        employeeId: employee.id,
        token: resetToken,
        expiresAt,
        used: false,
      };

      // Since we don't have the table yet, we'll store it in memory for now
      // In a real implementation, you'd store this in the database
      this.storeResetToken(tokenData);

      // Send password reset email
      await emailService.sendPasswordResetEmail(
        employee.email,
        `${employee.firstName} ${employee.lastName}`,
        resetToken
      );

      logger.info('Password reset initiated successfully', {
        employeeId: employee.id,
        email: employee.email,
      });
    } catch (error) {
      logger.error('Error initiating password reset', {
        error: error instanceof Error ? error.message : 'Unknown error',
        email,
      });
      throw new Error('Failed to initiate password reset');
    }
  }

  /**
   * Reset password using token
   */
  static async resetPassword(
    token: string,
    newPassword: string
  ): Promise<void> {
    try {
      // Validate new password
      const validation = PasswordService.validatePassword(newPassword);
      if (!validation.isValid) {
        throw new Error(`Invalid password: ${validation.errors.join(', ')}`);
      }

      // Find and validate token
      const tokenData = this.getResetToken(token);
      if (!tokenData) {
        throw new Error('Invalid or expired reset token');
      }

      if (tokenData.used) {
        throw new Error('Reset token has already been used');
      }

      if (new Date() > tokenData.expiresAt) {
        throw new Error('Reset token has expired');
      }

      // Find employee
      const employee = await prisma.employee.findUnique({
        where: { id: tokenData.employeeId },
      });

      if (!employee || !employee.isActive) {
        throw new Error('Employee not found or inactive');
      }

      // Hash new password
      const passwordHash = await PasswordService.hashPassword(newPassword);

      // Update employee password
      await prisma.employee.update({
        where: { id: employee.id },
        data: { passwordHash },
      });

      // Mark token as used
      this.markTokenAsUsed(token);

      logger.info('Password reset completed successfully', {
        employeeId: employee.id,
        email: employee.email,
      });
    } catch (error) {
      logger.error('Error resetting password', {
        error: error instanceof Error ? error.message : 'Unknown error',
        token: token.substring(0, 8) + '...', // Log partial token for security
      });
      throw error;
    }
  }

  /**
   * Validate reset token without using it
   */
  static validateResetToken(token: string): boolean {
    const tokenData = this.getResetToken(token);

    if (!tokenData) {
      return false;
    }

    if (tokenData.used) {
      return false;
    }

    if (new Date() > tokenData.expiresAt) {
      return false;
    }

    return true;
  }

  /**
   * Clean up expired tokens (should be run periodically)
   */
  static cleanupExpiredTokens(): void {
    const now = new Date();
    const validTokens = this.resetTokens.filter(
      token => !token.used && token.expiresAt > now
    );
    this.resetTokens = validTokens;

    logger.info('Cleaned up expired password reset tokens', {
      removedCount: this.resetTokens.length - validTokens.length,
    });
  }

  // In-memory storage for reset tokens (in production, use database)
  private static resetTokens: PasswordResetToken[] = [];

  private static storeResetToken(
    tokenData: Omit<PasswordResetToken, 'id' | 'createdAt'>
  ): void {
    const fullTokenData: PasswordResetToken = {
      id: Math.random().toString(36).substring(2, 15),
      ...tokenData,
      createdAt: new Date(),
    };
    this.resetTokens.push(fullTokenData);
  }

  private static getResetToken(token: string): PasswordResetToken | undefined {
    return this.resetTokens.find(t => t.token === token);
  }

  private static markTokenAsUsed(token: string): void {
    const tokenData = this.resetTokens.find(t => t.token === token);
    if (tokenData) {
      tokenData.used = true;
    }
  }

  private static async invalidateExistingTokens(
    employeeId: string
  ): Promise<void> {
    this.resetTokens.forEach(token => {
      if (token.employeeId === employeeId && !token.used) {
        token.used = true;
      }
    });
  }
}
