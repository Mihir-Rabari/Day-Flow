import { Router } from 'express';
import {
  AuthController,
  authValidationSchemas,
} from '../controllers/authController';
import {
  authenticate,
  loginRateLimit,
  passwordResetRateLimit,
  tokenRefreshRateLimit,
} from '../middleware/auth';
import { validateRequest, sanitizeInput } from '../middleware/validation';
import {
  securityHeaders,
  authRequestLogger,
  suspiciousActivityDetection,
  validateInputSize,
  bruteForceProtection,
} from '../middleware/security';

const router = Router();

/**
 * Authentication Routes
 */

// Apply security middleware to all routes
router.use(securityHeaders);
router.use(authRequestLogger);
router.use(suspiciousActivityDetection);
router.use(validateInputSize);
router.use(sanitizeInput);

/**
 * POST /api/auth/login
 * Authenticate user with login credentials
 * Rate limited to prevent brute force attacks
 */
router.post(
  '/login',
  bruteForceProtection,
  loginRateLimit,
  validateRequest({
    body: authValidationSchemas.login,
  }),
  AuthController.login
);

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 * Rate limited for security
 */
router.post(
  '/refresh',
  tokenRefreshRateLimit,
  validateRequest({
    body: authValidationSchemas.refreshToken,
  }),
  AuthController.refreshToken
);

/**
 * POST /api/auth/forgot-password
 * Initiate password reset process
 * Rate limited to prevent abuse
 */
router.post(
  '/forgot-password',
  passwordResetRateLimit,
  validateRequest({
    body: authValidationSchemas.forgotPassword,
  }),
  AuthController.forgotPassword
);

/**
 * POST /api/auth/reset-password
 * Reset password using token
 * Rate limited for security
 */
router.post(
  '/reset-password',
  passwordResetRateLimit,
  validateRequest({
    body: authValidationSchemas.resetPassword,
  }),
  AuthController.resetPassword
);

/**
 * POST /api/auth/change-password
 * Change password for authenticated user
 * Requires authentication
 */
router.post(
  '/change-password',
  authenticate,
  validateRequest({
    body: authValidationSchemas.changePassword,
  }),
  AuthController.changePassword
);

/**
 * POST /api/auth/logout
 * Logout user (client-side token removal)
 * Requires authentication
 */
router.post('/logout', authenticate, AuthController.logout);

/**
 * GET /api/auth/validate-reset-token/:token
 * Validate password reset token
 * No authentication required
 */
router.get(
  '/validate-reset-token/:token',
  validateRequest({
    params: authValidationSchemas.resetTokenParam,
  }),
  AuthController.validateResetToken
);

export default router;
