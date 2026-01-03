import request from 'supertest';
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthController } from '../controllers/authController';
import { TokenService } from '../services/tokenService';
import { PasswordService } from '../services/passwordService';
import { PasswordResetService } from '../services/passwordResetService';
import { UserRole } from '../types';
import { validateRequest } from '../middleware/validation';
import { authValidationSchemas } from '../controllers/authController';
import { errorHandler } from '../middleware/errorHandler';

// Mock Prisma
jest.mock('@prisma/client');
const mockPrisma = {
  employee: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
} as unknown as PrismaClient;

// Mock services
jest.mock('../services/tokenService');
jest.mock('../services/passwordService');
jest.mock('../services/passwordResetService');
jest.mock('../utils/logger');

const MockedTokenService = TokenService as jest.Mocked<typeof TokenService>;
const MockedPasswordService = PasswordService as jest.Mocked<
  typeof PasswordService
>;
const MockedPasswordResetService = PasswordResetService as jest.Mocked<
  typeof PasswordResetService
>;

describe('Authentication Controller Unit Tests', () => {
  let app: express.Application;

  beforeEach(() => {
    // Create Express app for testing without rate limiting
    app = express();
    app.use(express.json());

    // Add routes without middleware that causes issues in tests
    app.post(
      '/api/auth/login',
      validateRequest({ body: authValidationSchemas.login }),
      AuthController.login
    );
    app.post(
      '/api/auth/refresh',
      validateRequest({ body: authValidationSchemas.refreshToken }),
      AuthController.refreshToken
    );
    app.post(
      '/api/auth/forgot-password',
      validateRequest({ body: authValidationSchemas.forgotPassword }),
      AuthController.forgotPassword
    );
    app.post(
      '/api/auth/reset-password',
      validateRequest({ body: authValidationSchemas.resetPassword }),
      AuthController.resetPassword
    );
    app.post(
      '/api/auth/change-password',
      // Mock authentication middleware
      (req, _res, next) => {
        req.user = {
          userId: 'emp-123',
          email: 'john.doe@company.com',
          role: UserRole.EMPLOYEE,
          loginId: 'OIJODO20240001',
          iat: 1234567890,
          exp: 1234567890,
        };
        next();
      },
      validateRequest({ body: authValidationSchemas.changePassword }),
      AuthController.changePassword
    );
    app.post(
      '/api/auth/logout',
      // Mock authentication middleware
      (req, _res, next) => {
        req.user = {
          userId: 'emp-123',
          email: 'john.doe@company.com',
          role: UserRole.EMPLOYEE,
          loginId: 'OIJODO20240001',
          iat: 1234567890,
          exp: 1234567890,
        };
        next();
      },
      AuthController.logout
    );
    app.get(
      '/api/auth/validate-reset-token/:token',
      validateRequest({ params: authValidationSchemas.resetTokenParam }),
      AuthController.validateResetToken
    );

    app.use(errorHandler);

    // Reset all mocks
    jest.clearAllMocks();

    // Replace the prisma instance in the controller
    // We need to mock the prisma import in the controller
    require('@prisma/client').PrismaClient = jest.fn(() => mockPrisma);
  });

  describe('POST /api/auth/login', () => {
    const validLoginData = {
      loginId: 'OIJODO20240001',
      password: 'TestPassword123!',
    };

    const mockEmployee = {
      id: 'emp-123',
      loginId: 'OIJODO20240001',
      email: 'john.doe@company.com',
      firstName: 'John',
      lastName: 'Doe',
      role: UserRole.EMPLOYEE,
      isActive: true,
      profilePicture: null,
      passwordHash: 'hashed-password',
    };

    const mockAuthResponse = {
      token: 'access-token',
      refreshToken: 'refresh-token',
      user: {
        id: mockEmployee.id,
        loginId: mockEmployee.loginId,
        email: mockEmployee.email,
        firstName: mockEmployee.firstName,
        lastName: mockEmployee.lastName,
        role: mockEmployee.role,
        isActive: mockEmployee.isActive,
      },
      expiresIn: 900,
    };

    it('should login successfully with valid credentials', async () => {
      // Setup mocks
      mockPrisma.employee.findUnique = jest
        .fn()
        .mockResolvedValue(mockEmployee);
      MockedPasswordService.comparePassword.mockResolvedValue(true);
      MockedPasswordService.rehashIfNeeded.mockResolvedValue(null);
      MockedTokenService.createAuthResponse.mockReturnValue(mockAuthResponse);

      const response = await request(app)
        .post('/api/auth/login')
        .send(validLoginData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockAuthResponse);
      expect(response.body.message).toBe('Login successful');

      // Verify service calls
      expect(mockPrisma.employee.findUnique).toHaveBeenCalledWith({
        where: { loginId: validLoginData.loginId },
        select: expect.any(Object),
      });
      expect(MockedPasswordService.comparePassword).toHaveBeenCalledWith(
        validLoginData.password,
        mockEmployee.passwordHash
      );
      expect(MockedTokenService.createAuthResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          id: mockEmployee.id,
          loginId: mockEmployee.loginId,
          email: mockEmployee.email,
        })
      );
    });

    it('should fail login with invalid credentials', async () => {
      // Setup mocks
      mockPrisma.employee.findUnique = jest
        .fn()
        .mockResolvedValue(mockEmployee);
      MockedPasswordService.comparePassword.mockResolvedValue(false);

      const response = await request(app)
        .post('/api/auth/login')
        .send(validLoginData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Invalid credentials');

      // Should not create auth response for invalid credentials
      expect(MockedTokenService.createAuthResponse).not.toHaveBeenCalled();
    });

    it('should fail login for non-existent employee', async () => {
      // Setup mocks
      mockPrisma.employee.findUnique = jest.fn().mockResolvedValue(null);

      const response = await request(app)
        .post('/api/auth/login')
        .send(validLoginData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Invalid credentials');

      // Should not check password for non-existent employee
      expect(MockedPasswordService.comparePassword).not.toHaveBeenCalled();
    });

    it('should fail login for inactive employee', async () => {
      // Setup mocks
      const inactiveEmployee = { ...mockEmployee, isActive: false };
      mockPrisma.employee.findUnique = jest
        .fn()
        .mockResolvedValue(inactiveEmployee);

      const response = await request(app)
        .post('/api/auth/login')
        .send(validLoginData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Account is inactive');

      // Should not check password for inactive employee
      expect(MockedPasswordService.comparePassword).not.toHaveBeenCalled();
    });

    it('should validate input data', async () => {
      const invalidData = {
        loginId: '', // Empty loginId
        password: 'test',
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_FAILED');
    });
  });

  describe('POST /api/auth/refresh', () => {
    const validRefreshData = {
      refreshToken: 'valid-refresh-token',
    };

    const mockDecodedToken = {
      userId: 'emp-123',
      email: 'john.doe@company.com',
      role: UserRole.EMPLOYEE,
      loginId: 'OIJODO20240001',
      iat: 1234567890,
      exp: 1234567890,
    };

    const mockEmployee = {
      id: 'emp-123',
      loginId: 'OIJODO20240001',
      email: 'john.doe@company.com',
      firstName: 'John',
      lastName: 'Doe',
      role: UserRole.EMPLOYEE,
      isActive: true,
      profilePicture: null,
    };

    it('should refresh token successfully', async () => {
      // Setup mocks
      MockedTokenService.refreshAccessToken.mockReturnValue('new-access-token');
      MockedTokenService.verifyRefreshToken.mockReturnValue(mockDecodedToken);
      mockPrisma.employee.findUnique = jest
        .fn()
        .mockResolvedValue(mockEmployee);

      const response = await request(app)
        .post('/api/auth/refresh')
        .send(validRefreshData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.token).toBe('new-access-token');
      expect(typeof response.body.data.expiresIn).toBe('number');

      // Verify service calls
      expect(MockedTokenService.refreshAccessToken).toHaveBeenCalledWith(
        validRefreshData.refreshToken
      );
      expect(MockedTokenService.verifyRefreshToken).toHaveBeenCalledWith(
        validRefreshData.refreshToken
      );
    });

    it('should fail refresh with invalid token', async () => {
      // Setup mocks
      MockedTokenService.refreshAccessToken.mockImplementation(() => {
        throw new Error('Invalid refresh token');
      });

      const response = await request(app)
        .post('/api/auth/refresh')
        .send(validRefreshData)
        .expect(500);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/forgot-password', () => {
    const validEmailData = {
      email: 'john.doe@company.com',
    };

    it('should initiate password reset successfully', async () => {
      // Setup mocks
      MockedPasswordResetService.initiatePasswordReset.mockResolvedValue();

      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send(validEmailData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe(
        'If the email exists, a password reset link has been sent'
      );

      expect(
        MockedPasswordResetService.initiatePasswordReset
      ).toHaveBeenCalledWith(validEmailData.email);
    });

    it('should return success even for non-existent email (security)', async () => {
      // Setup mocks to throw error
      MockedPasswordResetService.initiatePasswordReset.mockRejectedValue(
        new Error('Email not found')
      );

      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send(validEmailData)
        .expect(200);

      // Should still return success to prevent email enumeration
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe(
        'If the email exists, a password reset link has been sent'
      );
    });

    it('should validate email format', async () => {
      const invalidEmailData = {
        email: 'invalid-email',
      };

      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send(invalidEmailData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_FAILED');
    });
  });

  describe('POST /api/auth/reset-password', () => {
    const validResetData = {
      token: 'valid-reset-token',
      newPassword: 'NewPassword123!',
    };

    it('should reset password successfully', async () => {
      // Setup mocks
      MockedPasswordResetService.resetPassword.mockResolvedValue();

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send(validResetData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Password reset successfully');

      expect(MockedPasswordResetService.resetPassword).toHaveBeenCalledWith(
        validResetData.token,
        validResetData.newPassword
      );
    });

    it('should fail with invalid token', async () => {
      // Setup mocks
      MockedPasswordResetService.resetPassword.mockRejectedValue(
        new Error('Invalid or expired reset token')
      );

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send(validResetData)
        .expect(500);

      expect(response.body.success).toBe(false);
    });

    it('should validate password strength', async () => {
      const weakPasswordData = {
        token: 'valid-reset-token',
        newPassword: 'weak', // Too weak
      };

      const response = await request(app)
        .post('/api/auth/reset-password')
        .send(weakPasswordData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_FAILED');
    });
  });

  describe('POST /api/auth/change-password', () => {
    const validChangePasswordData = {
      currentPassword: 'CurrentPassword123!',
      newPassword: 'NewPassword123!',
    };

    const mockEmployee = {
      id: 'emp-123',
      passwordHash: 'current-hashed-password',
      isActive: true,
    };

    it('should change password successfully', async () => {
      // Setup mocks
      MockedPasswordService.validatePassword.mockReturnValue({
        isValid: true,
        errors: [],
      });
      mockPrisma.employee.findUnique = jest
        .fn()
        .mockResolvedValue(mockEmployee);
      MockedPasswordService.comparePassword
        .mockResolvedValueOnce(true) // Current password check
        .mockResolvedValueOnce(false); // New password different check
      MockedPasswordService.hashPassword.mockResolvedValue(
        'new-hashed-password'
      );
      mockPrisma.employee.update = jest.fn().mockResolvedValue(mockEmployee);

      const response = await request(app)
        .post('/api/auth/change-password')
        .send(validChangePasswordData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Password changed successfully');

      // Verify service calls
      expect(MockedPasswordService.validatePassword).toHaveBeenCalledWith(
        validChangePasswordData.newPassword
      );
      expect(MockedPasswordService.comparePassword).toHaveBeenCalledWith(
        validChangePasswordData.currentPassword,
        mockEmployee.passwordHash
      );
      expect(MockedPasswordService.hashPassword).toHaveBeenCalledWith(
        validChangePasswordData.newPassword
      );
      expect(mockPrisma.employee.update).toHaveBeenCalledWith({
        where: { id: 'emp-123' },
        data: { passwordHash: 'new-hashed-password' },
      });
    });

    it('should fail with incorrect current password', async () => {
      // Setup mocks
      MockedPasswordService.validatePassword.mockReturnValue({
        isValid: true,
        errors: [],
      });
      mockPrisma.employee.findUnique = jest
        .fn()
        .mockResolvedValue(mockEmployee);
      MockedPasswordService.comparePassword.mockResolvedValue(false);

      const response = await request(app)
        .post('/api/auth/change-password')
        .send(validChangePasswordData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toBe('Current password is incorrect');
    });

    it('should validate new password strength', async () => {
      // Setup mocks
      MockedPasswordService.validatePassword.mockReturnValue({
        isValid: false,
        errors: ['Password must be at least 8 characters long'],
      });

      const weakPasswordData = {
        currentPassword: 'CurrentPassword123!',
        newPassword: 'weak',
      };

      const response = await request(app)
        .post('/api/auth/change-password')
        .send(weakPasswordData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_FAILED');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout successfully', async () => {
      const response = await request(app).post('/api/auth/logout').expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Logged out successfully');
    });
  });

  describe('GET /api/auth/validate-reset-token/:token', () => {
    it('should validate reset token successfully', async () => {
      // Setup mocks
      MockedPasswordResetService.validateResetToken.mockReturnValue(true);

      const response = await request(app)
        .get('/api/auth/validate-reset-token/valid-token')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.isValid).toBe(true);
      expect(response.body.message).toBe('Token is valid');

      expect(
        MockedPasswordResetService.validateResetToken
      ).toHaveBeenCalledWith('valid-token');
    });

    it('should return invalid for expired token', async () => {
      // Setup mocks
      MockedPasswordResetService.validateResetToken.mockReturnValue(false);

      const response = await request(app)
        .get('/api/auth/validate-reset-token/expired-token')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.isValid).toBe(false);
      expect(response.body.message).toBe('Token is invalid or expired');
    });
  });
});
