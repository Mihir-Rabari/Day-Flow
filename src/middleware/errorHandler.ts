import { Request, Response, NextFunction } from 'express';
import { ErrorResponse } from '../types';
import { logger } from '../utils/logger';
import { Prisma } from '@prisma/client';

export class AppError extends Error {
  public statusCode: number;
  public code: string;
  public isOperational: boolean;

  constructor(message: string, statusCode: number, code: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  public details: any;

  constructor(message: string, details?: any) {
    super(message, 400, 'VALIDATION_FAILED');
    this.details = details;
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication failed') {
    super(message, 401, 'AUTH_FAILED');
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, code: string = 'DB_ERROR') {
    super(message, 500, code);
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Resource conflict') {
    super(message, 409, 'CONFLICT');
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Too many requests') {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
  }
}

const handlePrismaError = (error: Prisma.PrismaClientKnownRequestError): AppError => {
  switch (error.code) {
    case 'P2002': {
      // Unique constraint violation
      const field = error.meta?.target as string[] | undefined;
      const fieldName = field ? field[0] : 'field';
      return new ConflictError(`${fieldName} already exists`);
    }
    
    case 'P2025': {
      // Record not found
      return new NotFoundError('Record not found');
    }
    
    case 'P2003': {
      // Foreign key constraint violation
      return new ValidationError('Invalid reference to related record');
    }
    
    case 'P2014': {
      // Required relation violation
      return new ValidationError('Required relation missing');
    }
    
    case 'P1001': {
      // Database connection error
      return new DatabaseError('Database connection failed', 'DB_CONNECTION_ERROR');
    }
    
    case 'P1008': {
      // Database timeout
      return new DatabaseError('Database operation timed out', 'DB_TIMEOUT');
    }
    
    case 'P1017': {
      // Database connection lost
      return new DatabaseError('Database connection lost', 'DB_CONNECTION_LOST');
    }
    
    default:
      return new DatabaseError('Database operation failed', 'DB_QUERY_ERROR');
  }
};

const handlePrismaValidationError = (_error: Prisma.PrismaClientValidationError): AppError => {
  return new ValidationError('Invalid data provided to database operation');
};

const handlePrismaInitializationError = (_error: Prisma.PrismaClientInitializationError): AppError => {
  return new DatabaseError('Database initialization failed', 'DB_INIT_ERROR');
};

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  let statusCode = 500;
  let code = 'INTERNAL_SERVER_ERROR';
  let message = 'An unexpected error occurred';
  let details: any = undefined;

  // Handle Prisma errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const appError = handlePrismaError(error);
    statusCode = appError.statusCode;
    code = appError.code;
    message = appError.message;
  } else if (error instanceof Prisma.PrismaClientValidationError) {
    const appError = handlePrismaValidationError(error);
    statusCode = appError.statusCode;
    code = appError.code;
    message = appError.message;
  } else if (error instanceof Prisma.PrismaClientInitializationError) {
    const appError = handlePrismaInitializationError(error);
    statusCode = appError.statusCode;
    code = appError.code;
    message = appError.message;
  } else if (error instanceof AppError) {
    // Handle custom application errors
    statusCode = error.statusCode;
    code = error.code;
    message = error.message;

    if (error instanceof ValidationError) {
      details = error.details;
    }
  } else if (error.name === 'JsonWebTokenError') {
    // Handle JWT errors
    statusCode = 401;
    code = 'AUTH_TOKEN_INVALID';
    message = 'Invalid authentication token';
  } else if (error.name === 'TokenExpiredError') {
    // Handle JWT expiration
    statusCode = 401;
    code = 'AUTH_TOKEN_EXPIRED';
    message = 'Authentication token has expired';
  } else if (error.name === 'SyntaxError' && error.message.includes('JSON')) {
    // Handle JSON parsing errors
    statusCode = 400;
    code = 'INVALID_JSON';
    message = 'Invalid JSON format in request body';
  }

  // Log error with comprehensive context
  logger.error('API Error', {
    error: error.message,
    stack: error.stack,
    code,
    statusCode,
    url: req.url,
    method: req.method,
    userId: (req as any).user?.id,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    timestamp: new Date().toISOString(),
    ...(details && { details }),
  });

  // Prepare structured error response
  const errorResponse: ErrorResponse = {
    success: false,
    error: {
      code,
      message,
      ...(details && { details }),
      ...(process.env.NODE_ENV === 'development' && {
        stack: error.stack,
        originalError: error.message,
      }),
    },
  };

  res.status(statusCode).json(errorResponse);
};

// Global unhandled promise rejection handler
export const handleUnhandledRejection = (reason: any, promise: Promise<any>) => {
  logger.error('Unhandled Promise Rejection', {
    reason: reason?.message || reason,
    stack: reason?.stack,
    promise: promise.toString(),
    timestamp: new Date().toISOString(),
  });
  
  // In production, you might want to gracefully shutdown
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
};

// Global uncaught exception handler
export const handleUncaughtException = (error: Error) => {
  logger.error('Uncaught Exception', {
    error: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString(),
  });
  
  // Always exit on uncaught exceptions
  process.exit(1);
};
