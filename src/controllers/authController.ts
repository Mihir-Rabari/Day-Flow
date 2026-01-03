import { Request, Response, NextFunction } from 'express';
import { prisma } from '../database/client';
import Joi from 'joi';
import { TokenService } from '../services/tokenService';
import { PasswordService } from '../services/passwordService';
import { PasswordResetService } from '../services/passwordResetService';
import { logger } from '../utils/logger';
import { ApiResponse, LoginCredentials, UserProfile, UserRole } from '../types';
import {
  AuthenticationError,
  ValidationError,
} from '../middleware/errorHandler';

/**
 * Validation schemas for authentication endpoints
 */
export const authValidationSchemas = {
  login: Joi.object({
    loginId: Joi.string()
      .required()
      .trim()
      .min(1)
      .max(50)
      .pattern(/^[a-zA-Z0-9]+$/)
      .messages({
        'string.pattern.base':
          'Login ID must contain only alphanumeric characters',
        'string.empty': 'Login ID is required',
        'string.max': 'Login ID must not exceed 50 characters',
      }),
    password: Joi.string().required().min(1).max(128).messages({
      'string.empty': 'Password is required',
      'string.max': 'Password must not exceed 128 characters',
    }),
  }),

  refreshToken: Joi.object({
    refreshToken: Joi.string().required().trim().min(1).messages({
      'string.empty': 'Refresh token is required',
    }),
  }),

  forgotPassword: Joi.object({
    email: Joi.string()
      .email()
      .required()
      .trim()
      .lowercase()
      .max(255)
      .messages({
        'string.email': 'Please provide a valid email address',
        'string.empty': 'Email is required',
        'string.max': 'Email must not exceed 255 characters',
      }),
  }),

  resetPassword: Joi.object({
    token: Joi.string().required().trim().min(1).max(255).messages({
      'string.empty': 'Reset token is required',
      'string.max': 'Invalid reset token format',
    }),
    newPassword: Joi.string()
      .required()
      .min(8)
      .max(128)
      .pattern(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{}|;:,.<>?])/
      )
      .messages({
        'string.min': 'Password must be at least 8 characters long',
        'string.max': 'Password must not exceed 128 characters',
        'string.pattern.base':
          'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
        'string.empty': 'New password is required',
      }),
  }),

  changePassword: Joi.object({
    currentPassword: Joi.string().required().min(1).max(128).messages({
      'string.empty': 'Current password is required',
      'string.max': 'Password must not exceed 128 characters',
    }),
    newPassword: Joi.string()
      .required()
      .min(8)
      .max(128)
      .pattern(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{}|;:,.<>?])/
      )
      .messages({
        'string.min': 'Password must be at least 8 characters long',
        'string.max': 'Password must not exceed 128 characters',
        'string.pattern.base':
          'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
        'string.empty': 'New password is required',
      }),
  }),

  resetTokenParam: Joi.object({
    token: Joi.string().required().trim().min(1).max(255).messages({
      'string.empty': 'Reset token is required',
      'string.max': 'Invalid reset token format',
    }),
  }),
};

export class AuthController {
  /**
   * POST /api/auth/login
   * Authenticate user with login credentials
   */
  static async login(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { loginId, password }: LoginCredentials = req.body;

      logger.info('Login attempt', { loginId });

      // Find employee by loginId
      const employee = await prisma.employee.findUnique({
        where: { loginId: loginId.trim() },
        select: {
          id: true,
          loginId: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          profilePicture: true,
          passwordHash: true,
        },
      });

      if (!employee) {
        logger.warn('Login failed - employee not found', { loginId });
        throw new AuthenticationError('Invalid credentials');
      }

      if (!employee.isActive) {
        logger.warn('Login failed - employee inactive', {
          loginId,
          employeeId: employee.id,
        });
        throw new AuthenticationError('Account is inactive');
      }

      // Verify password
      const isPasswordValid = await PasswordService.comparePassword(
        password,
        employee.passwordHash
      );

      if (!isPasswordValid) {
        logger.warn('Login failed - invalid password', {
          loginId,
          employeeId: employee.id,
        });
        throw new AuthenticationError('Invalid credentials');
      }

      // Check if password needs rehashing
      const newHash = await PasswordService.rehashIfNeeded(
        password,
        employee.passwordHash
      );

      if (newHash) {
        await prisma.employee.update({
          where: { id: employee.id },
          data: { passwordHash: newHash },
        });
        logger.info('Password rehashed for security upgrade', {
          employeeId: employee.id,
        });
      }

      // Create user profile for token generation
      const userProfile: UserProfile = {
        id: employee.id,
        loginId: employee.loginId,
        email: employee.email,
        firstName: employee.firstName,
        lastName: employee.lastName,
        role: employee.role as UserRole,
        isActive: employee.isActive,
        profilePicture: employee.profilePicture || undefined,
      };

      // Generate tokens and create auth response
      const authResponse = TokenService.createAuthResponse(userProfile);

      logger.info('Login successful', {
        employeeId: employee.id,
        loginId: employee.loginId,
      });

      const response: ApiResponse = {
        success: true,
        data: authResponse,
        message: 'Login successful',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/auth/refresh
   * Refresh access token using refresh token
   */
  static async refreshToken(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { refreshToken } = req.body;

      logger.info('Token refresh attempt');

      // Verify refresh token and get new access token
      const newAccessToken = TokenService.refreshAccessToken(refreshToken);

      // Decode the refresh token to get user info
      const decoded = TokenService.verifyRefreshToken(refreshToken);

      // Verify employee still exists and is active
      const employee = await prisma.employee.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          loginId: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          profilePicture: true,
        },
      });

      if (!employee || !employee.isActive) {
        logger.warn('Token refresh failed - employee not found or inactive', {
          userId: decoded.userId,
        });
        throw new AuthenticationError('Invalid refresh token');
      }

      logger.info('Token refresh successful', {
        employeeId: employee.id,
      });

      const response: ApiResponse = {
        success: true,
        data: {
          token: newAccessToken,
          expiresIn: TokenService['parseExpirationTime'](
            process.env.JWT_EXPIRES_IN || '15m'
          ),
        },
        message: 'Token refreshed successfully',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/auth/forgot-password
   * Initiate password reset process
   */
  static async forgotPassword(
    req: Request,
    res: Response,
    _next: NextFunction
  ): Promise<void> {
    try {
      const { email } = req.body;

      logger.info('Password reset requested', { email });

      // Initiate password reset (this handles security internally)
      await PasswordResetService.initiatePasswordReset(email);

      // Always return success to prevent email enumeration
      const response: ApiResponse = {
        success: true,
        message: 'If the email exists, a password reset link has been sent',
      };

      res.status(200).json(response);
    } catch (error) {
      // Log the actual error but return generic message
      logger.error('Password reset initiation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        email: req.body.email,
      });

      const response: ApiResponse = {
        success: true,
        message: 'If the email exists, a password reset link has been sent',
      };

      res.status(200).json(response);
    }
  }

  /**
   * POST /api/auth/reset-password
   * Reset password using token
   */
  static async resetPassword(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { token, newPassword } = req.body;

      logger.info('Password reset attempt', {
        token: token.substring(0, 8) + '...',
      });

      // Reset password using token
      await PasswordResetService.resetPassword(token, newPassword);

      logger.info('Password reset successful');

      const response: ApiResponse = {
        success: true,
        message: 'Password reset successfully',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/auth/change-password
   * Change password for authenticated user
   */
  static async changePassword(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = req.user?.userId;

      if (!userId) {
        throw new AuthenticationError('User not authenticated');
      }

      logger.info('Password change attempt', { userId });

      // Validate new password
      const validation = PasswordService.validatePassword(newPassword);
      if (!validation.isValid) {
        throw new ValidationError(
          'Invalid password',
          validation.errors.map(error => ({
            field: 'newPassword',
            message: error,
            code: 'INVALID_PASSWORD',
          }))
        );
      }

      // Get current employee
      const employee = await prisma.employee.findUnique({
        where: { id: userId },
        select: {
          id: true,
          passwordHash: true,
          isActive: true,
        },
      });

      if (!employee || !employee.isActive) {
        throw new AuthenticationError('Employee not found or inactive');
      }

      // Verify current password
      const isCurrentPasswordValid = await PasswordService.comparePassword(
        currentPassword,
        employee.passwordHash
      );

      if (!isCurrentPasswordValid) {
        logger.warn('Password change failed - invalid current password', {
          userId,
        });
        throw new AuthenticationError('Current password is incorrect');
      }

      // Check if new password is different from current
      const isSamePassword = await PasswordService.comparePassword(
        newPassword,
        employee.passwordHash
      );

      if (isSamePassword) {
        throw new ValidationError(
          'New password must be different from current password',
          [
            {
              field: 'newPassword',
              message: 'New password must be different from current password',
              code: 'SAME_PASSWORD',
            },
          ]
        );
      }

      // Hash new password
      const newPasswordHash = await PasswordService.hashPassword(newPassword);

      // Update password
      await prisma.employee.update({
        where: { id: userId },
        data: { passwordHash: newPasswordHash },
      });

      logger.info('Password change successful', { userId });

      const response: ApiResponse = {
        success: true,
        message: 'Password changed successfully',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/auth/logout
   * Logout user (client-side token removal)
   */
  static async logout(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user?.userId;

      if (userId) {
        logger.info('User logout', { userId });
      }

      const response: ApiResponse = {
        success: true,
        message: 'Logged out successfully',
      };

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/auth/validate-reset-token/:token
   * Validate password reset token
   */
  static async validateResetToken(
    req: Request,
    res: Response,
    _next: NextFunction
  ): Promise<void> {
    try {
      const { token } = req.params;

      const isValid = PasswordResetService.validateResetToken(token);

      const response: ApiResponse = {
        success: true,
        data: { isValid },
        message: isValid ? 'Token is valid' : 'Token is invalid or expired',
      };

      res.status(200).json(response);
    } catch (error) {
      const response: ApiResponse = {
        success: true,
        data: { isValid: false },
        message: 'Token is invalid or expired',
      };

      res.status(200).json(response);
    }
  }
}
