import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { config } from '../config/config';
import { logger } from '../utils/logger';

/**
 * Comprehensive security middleware using Helmet
 */
export const helmetSecurity = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Disable for API compatibility
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
});

/**
 * Rate limiting middleware for different endpoint types
 */
export const createRateLimit = (options: {
  windowMs?: number;
  max?: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
}) => {
  return rateLimit({
    windowMs: options.windowMs || config.security.rateLimitWindowMs,
    max: options.max || config.security.rateLimitMaxRequests,
    message: {
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message:
          options.message || 'Too many requests, please try again later.',
      },
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: options.skipSuccessfulRequests || false,
    handler: (req: Request, res: Response) => {
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        path: req.path,
        method: req.method,
        userAgent: req.get('User-Agent'),
      });

      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message:
            options.message || 'Too many requests, please try again later.',
        },
      });
    },
  });
};

/**
 * Strict rate limiting for authentication endpoints
 */
export const authRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: 'Too many authentication attempts, please try again in 15 minutes.',
  skipSuccessfulRequests: true,
});

/**
 * General API rate limiting
 */
export const apiRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: 'Too many API requests, please try again later.',
});

/**
 * Strict rate limiting for password reset endpoints
 */
export const passwordResetRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 attempts per hour
  message: 'Too many password reset attempts, please try again in 1 hour.',
});

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
      duration: duration,
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

/**
 * HTTPS redirect middleware for production
 */
export const httpsRedirect = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (
    config.server.nodeEnv === 'production' &&
    !req.secure &&
    req.get('x-forwarded-proto') !== 'https'
  ) {
    logger.info('Redirecting HTTP to HTTPS', {
      originalUrl: req.originalUrl,
      ip: req.ip,
    });

    return res.redirect(301, `https://${req.get('host')}${req.originalUrl}`);
  }
  next();
};

/**
 * IP whitelist middleware for admin endpoints
 */
export const createIPWhitelist = (allowedIPs: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const clientIP = req.ip || req.connection.remoteAddress || 'unknown';

    if (!allowedIPs.includes(clientIP) && !allowedIPs.includes('*')) {
      logger.warn('Unauthorized IP access attempt', {
        ip: clientIP,
        path: req.path,
        method: req.method,
        userAgent: req.get('User-Agent'),
      });

      res.status(403).json({
        success: false,
        error: {
          code: 'IP_NOT_ALLOWED',
          message: 'Access denied from this IP address.',
        },
      });
      return;
    }

    next();
  };
};

/**
 * Request signature validation middleware
 */
export const validateRequestSignature = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Skip signature validation in development
  if (config.server.nodeEnv === 'development') {
    return next();
  }

  const signature = req.get('X-Request-Signature');
  const timestamp = req.get('X-Request-Timestamp');

  if (!signature || !timestamp) {
    logger.warn('Missing request signature or timestamp', {
      ip: req.ip,
      path: req.path,
      hasSignature: !!signature,
      hasTimestamp: !!timestamp,
    });

    res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_REQUEST_SIGNATURE',
        message: 'Request signature validation failed.',
      },
    });
    return;
  }

  // Check timestamp to prevent replay attacks
  const requestTime = parseInt(timestamp, 10);
  const currentTime = Date.now();
  const maxAge = 5 * 60 * 1000; // 5 minutes

  if (currentTime - requestTime > maxAge) {
    logger.warn('Request timestamp too old', {
      ip: req.ip,
      path: req.path,
      requestTime,
      currentTime,
      age: currentTime - requestTime,
    });

    res.status(401).json({
      success: false,
      error: {
        code: 'REQUEST_EXPIRED',
        message: 'Request timestamp is too old.',
      },
    });
    return;
  }

  next();
};

/**
 * Content type validation middleware
 */
export const validateContentType = (allowedTypes: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const contentType = req.get('Content-Type');

    if (req.method !== 'GET' && req.method !== 'DELETE') {
      if (
        !contentType ||
        !allowedTypes.some(type => contentType.includes(type))
      ) {
        logger.warn('Invalid content type', {
          ip: req.ip,
          path: req.path,
          method: req.method,
          contentType,
          allowedTypes,
        });

        res.status(415).json({
          success: false,
          error: {
            code: 'UNSUPPORTED_MEDIA_TYPE',
            message: 'Unsupported content type.',
          },
        });
        return;
      }
    }

    next();
  };
};

/**
 * Security audit logging middleware
 */
export const securityAuditLogger = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const startTime = Date.now();

  // Log security-relevant request details
  const securityContext = {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    method: req.method,
    path: req.path,
    timestamp: new Date().toISOString(),
    headers: {
      authorization: req.get('Authorization') ? '[REDACTED]' : undefined,
      contentType: req.get('Content-Type'),
      origin: req.get('Origin'),
      referer: req.get('Referer'),
    },
  };

  // Log the request
  logger.info('Security audit - Request', securityContext);

  // Override response methods to log security events
  const originalSend = res.send;
  res.send = function (data) {
    const duration = Date.now() - startTime;

    logger.info('Security audit - Response', {
      ...securityContext,
      statusCode: res.statusCode,
      duration,
      success: res.statusCode < 400,
    });

    // Log security failures
    if (res.statusCode === 401 || res.statusCode === 403) {
      logger.warn('Security audit - Authentication/Authorization failure', {
        ...securityContext,
        statusCode: res.statusCode,
        duration,
      });
    }

    return originalSend.call(this, data);
  };

  next();
};
