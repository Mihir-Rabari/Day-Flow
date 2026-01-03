import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { config } from '../config/config';
import { AuthenticationError, AuthorizationError } from './errorHandler';
import { JWTPayload, UserRole } from '../types';
import { TokenService } from '../services/tokenService';

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

/**
 * Authentication middleware to verify JWT tokens
 */
export const authenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = TokenService.extractTokenFromHeader(authHeader);

    if (!token) {
      throw new AuthenticationError('No token provided');
    }

    const decoded = TokenService.verifyAccessToken(token);
    req.user = decoded;

    next();
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Token expired') {
        next(new AuthenticationError('Token expired'));
      } else if (error.message === 'Invalid token') {
        next(new AuthenticationError('Invalid token'));
      } else {
        next(new AuthenticationError('Authentication failed'));
      }
    } else {
      next(error);
    }
  }
};

/**
 * Authorization middleware to check user roles
 */
export const authorize = (roles: UserRole[]) => {
  return (_req: Request, _res: Response, next: NextFunction): void => {
    if (!_req.user) {
      return next(new AuthenticationError('User not authenticated'));
    }

    if (!roles.includes(_req.user.role)) {
      return next(new AuthorizationError('Insufficient permissions'));
    }

    next();
  };
};

/**
 * Optional authentication middleware (doesn't fail if no token)
 */
export const optionalAuthenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = TokenService.extractTokenFromHeader(authHeader);

    if (token) {
      const decoded = TokenService.verifyAccessToken(token);
      req.user = decoded;
    }

    next();
  } catch (error) {
    // For optional auth, we don't fail on invalid tokens
    // Just proceed without setting req.user
    next();
  }
};

/**
 * Rate limiting middleware for authentication endpoints
 */
export const authRateLimit = rateLimit({
  windowMs: config.security.rateLimitWindowMs, // 15 minutes
  max: config.security.rateLimitMaxRequests, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later',
    },
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

/**
 * Stricter rate limiting for login attempts
 */
export const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login attempts per windowMs
  message: {
    success: false,
    error: {
      code: 'LOGIN_RATE_LIMIT_EXCEEDED',
      message: 'Too many login attempts, please try again later',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
});

/**
 * Rate limiting for password reset attempts
 */
export const passwordResetRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 password reset attempts per hour
  message: {
    success: false,
    error: {
      code: 'PASSWORD_RESET_RATE_LIMIT_EXCEEDED',
      message: 'Too many password reset attempts, please try again later',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiting for token refresh
 */
export const tokenRefreshRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // Limit each IP to 10 token refresh attempts per 5 minutes
  message: {
    success: false,
    error: {
      code: 'TOKEN_REFRESH_RATE_LIMIT_EXCEEDED',
      message: 'Too many token refresh attempts, please try again later',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Check if user has specific permission for resource
 */
export const checkResourcePermission = (
  resourceType: 'profile' | 'attendance' | 'leave' | 'salary',
  action: 'read' | 'create' | 'update' | 'delete',
  resourceOwnerId?: string
) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AuthenticationError('User not authenticated'));
    }

    const { role, userId } = req.user;

    // Admin has full access to everything
    if (role === UserRole.ADMIN) {
      return next();
    }

    // HR Officer permissions
    if (role === UserRole.HR_OFFICER) {
      // HR can read/update most resources, create employees
      if (
        resourceType === 'profile' &&
        ['read', 'update', 'create'].includes(action)
      ) {
        return next();
      }
      if (
        resourceType === 'attendance' &&
        ['read', 'update'].includes(action)
      ) {
        return next();
      }
      if (resourceType === 'leave' && ['read', 'update'].includes(action)) {
        return next();
      }
      if (resourceType === 'salary' && ['read', 'update'].includes(action)) {
        return next();
      }
    }

    // Employee permissions - can only access their own resources
    if (role === UserRole.EMPLOYEE) {
      const isOwnResource = !resourceOwnerId || resourceOwnerId === userId;

      if (!isOwnResource) {
        return next(
          new AuthorizationError("Cannot access other users' resources")
        );
      }

      if (resourceType === 'profile' && ['read'].includes(action)) {
        return next();
      }
      if (resourceType === 'profile' && action === 'update') {
        // Employees can only update limited profile fields
        return next();
      }
      if (
        resourceType === 'attendance' &&
        ['read', 'create'].includes(action)
      ) {
        return next();
      }
      if (resourceType === 'leave' && ['read', 'create'].includes(action)) {
        return next();
      }
      if (resourceType === 'salary' && action === 'read') {
        return next();
      }
    }

    return next(
      new AuthorizationError('Insufficient permissions for this action')
    );
  };
};
