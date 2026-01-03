import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

// Simple UUID v4 generator
const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// Extend Request interface to include custom properties
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      startTime?: number;
    }
  }
}

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  // Generate unique request ID
  req.requestId = generateUUID();
  req.startTime = Date.now();

  // Log incoming request
  logger.info('Incoming request', {
    requestId: req.requestId,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: (req as any).user?.id,
  });

  // Override res.end to log response
  const originalEnd = res.end.bind(res);
  res.end = function(chunk?: any, encoding?: any, cb?: () => void) {
    const duration = Date.now() - (req.startTime || 0);
    
    // Log request completion
    logger.logRequest(req.method, req.originalUrl, res.statusCode, duration, {
      requestId: req.requestId,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: (req as any).user?.id,
    });

    // Call original end method
    return originalEnd(chunk, encoding, cb);
  };

  next();
};

export const performanceLogger = (operation: string) => {
  return (target: any, propertyName: string, descriptor: PropertyDescriptor) => {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const startTime = Date.now();
      
      try {
        const result = await method.apply(this, args);
        const duration = Date.now() - startTime;
        
        logger.logPerformance(operation, duration, {
          method: propertyName,
          class: target.constructor.name,
        });
        
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        
        logger.error(`${operation} failed`, {
          method: propertyName,
          class: target.constructor.name,
          duration,
          error: (error as Error).message,
        });
        
        throw error;
      }
    };

    return descriptor;
  };
};

export const databaseLogger = (table: string, operation: string) => {
  return (target: any, propertyName: string, descriptor: PropertyDescriptor) => {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const startTime = Date.now();
      
      try {
        const result = await method.apply(this, args);
        const duration = Date.now() - startTime;
        
        logger.logDatabaseOperation(operation, table, duration, {
          method: propertyName,
          class: target.constructor.name,
        });
        
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        
        logger.error(`Database ${operation} failed`, {
          table,
          method: propertyName,
          class: target.constructor.name,
          duration,
          error: (error as Error).message,
        });
        
        throw error;
      }
    };

    return descriptor;
  };
};