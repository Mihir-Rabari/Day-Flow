import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

/**
 * Security headers middleware for authentication endpoints
 */
export const securityHeaders = (
  _req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Prevent caching of sensitive authentication responses
  res.setHeader(
    'Cache-Control',
    'no-store, no-cache, must-revalidate, private'
  );
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  // Additional security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  next();
};

/**
 * Request logging middleware for authentication endpoints
 */
export const authRequestLogger = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const startTime = Date.now();

  // Log authentication attempt
  logger.info('Authentication request', {
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('User-Agent') || 'Unknown',
    timestamp: new Date().toISOString(),
  });

  // Log response time
  const originalSend = _res.send;
  _res.send = function (data) {
    const duration = Date.now() - startTime;
    logger.info('Authentication response', {
      method: req.method,
      path: req.path,
      statusCode: _res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
    });
    return originalSend.call(this, data);
  };

  next();
};

/**
 * Suspicious activity detection middleware
 */
export const suspiciousActivityDetection = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const suspiciousPatterns = [
    // SQL injection patterns
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/i,
    // XSS patterns
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    // Path traversal patterns
    /\.\.[/\\]/,
    // Command injection patterns
    /[;&|`$(){}[\]]/,
  ];

  const requestData = JSON.stringify({
    body: req.body,
    query: req.query,
    params: req.params,
  });

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(requestData)) {
      logger.warn('Suspicious activity detected', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        method: req.method,
        path: req.path,
        pattern: pattern.toString(),
        timestamp: new Date().toISOString(),
      });
      break;
    }
  }

  next();
};

/**
 * Input size validation middleware
 */
export const validateInputSize = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const maxBodySize = 1024 * 1024; // 1MB
  const bodySize = JSON.stringify(req.body).length;

  if (bodySize > maxBodySize) {
    logger.warn('Request body too large', {
      ip: req.ip,
      path: req.path,
      bodySize,
      maxSize: maxBodySize,
    });

    res.status(413).json({
      success: false,
      error: {
        code: 'PAYLOAD_TOO_LARGE',
        message: 'Request body too large',
      },
    });
    return;
  }

  next();
};

/**
 * Brute force protection tracking
 */
const failedAttempts = new Map<
  string,
  { count: number; lastAttempt: number }
>();

export const bruteForceProtection = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const clientId = req.ip || 'unknown';
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const maxAttempts = 10;

  const attempts = failedAttempts.get(clientId);

  if (attempts) {
    // Reset counter if window has passed
    if (now - attempts.lastAttempt > windowMs) {
      failedAttempts.delete(clientId);
    } else if (attempts.count >= maxAttempts) {
      logger.warn('Brute force protection triggered', {
        ip: req.ip || 'unknown',
        attempts: attempts.count,
        path: req.path,
      });

      res.status(429).json({
        success: false,
        error: {
          code: 'TOO_MANY_ATTEMPTS',
          message: 'Too many failed attempts. Please try again later.',
        },
      });
      return;
    }
  }

  // Track failed attempts on response
  const originalSend = res.send;
  res.send = function (data) {
    if (res.statusCode === 401 || res.statusCode === 403) {
      const current = failedAttempts.get(clientId) || {
        count: 0,
        lastAttempt: 0,
      };
      failedAttempts.set(clientId, {
        count: current.count + 1,
        lastAttempt: now,
      });
    } else if (res.statusCode === 200) {
      // Clear failed attempts on successful login
      failedAttempts.delete(clientId);
    }
    return originalSend.call(this, data);
  };

  next();
};

/**
 * Clean up old failed attempt records periodically
 */
setInterval(
  () => {
    const now = Date.now();
    const windowMs = 15 * 60 * 1000; // 15 minutes

    for (const [clientId, attempts] of failedAttempts.entries()) {
      if (now - attempts.lastAttempt > windowMs) {
        failedAttempts.delete(clientId);
      }
    }
  },
  5 * 60 * 1000
); // Clean up every 5 minutes
