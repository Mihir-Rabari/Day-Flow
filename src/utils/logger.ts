export interface LogLevel {
  ERROR: 'error';
  WARN: 'warn';
  INFO: 'info';
  DEBUG: 'debug';
}

export const LOG_LEVELS: LogLevel = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  DEBUG: 'debug',
};

interface LogContext {
  userId?: string;
  requestId?: string;
  method?: string;
  url?: string;
  statusCode?: number;
  duration?: number;
  ip?: string;
  userAgent?: string;
  [key: string]: any;
}

class Logger {
  private formatMessage(level: string, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` ${JSON.stringify(context)}` : '';
    return `[${timestamp}] ${level.toUpperCase()}: ${message}${contextStr}`;
  }

  error(message: string, context?: LogContext): void {
    console.error(this.formatMessage('error', message, context));
  }

  warn(message: string, context?: LogContext): void {
    console.warn(this.formatMessage('warn', message, context));
  }

  info(message: string, context?: LogContext): void {
    console.log(this.formatMessage('info', message, context));
  }

  debug(message: string, context?: LogContext): void {
    if (process.env.NODE_ENV === 'development') {
      console.log(this.formatMessage('debug', message, context));
    }
  }

  // Request logging
  logRequest(method: string, url: string, statusCode: number, duration: number, context?: Partial<LogContext>): void {
    const logContext: LogContext = {
      method,
      url,
      statusCode,
      duration,
      ...context,
    };

    if (statusCode >= 500) {
      this.error('Request failed with server error', logContext);
    } else if (statusCode >= 400) {
      this.warn('Request failed with client error', logContext);
    } else {
      this.info('Request completed', logContext);
    }
  }

  // Performance logging
  logPerformance(operation: string, duration: number, context?: LogContext): void {
    const logContext: LogContext = {
      operation,
      duration,
      ...context,
    };

    if (duration > 1000) {
      this.warn('Slow operation detected', logContext);
    } else {
      this.debug('Operation completed', logContext);
    }
  }

  // Database operation logging
  logDatabaseOperation(operation: string, table: string, duration: number, context?: LogContext): void {
    const logContext: LogContext = {
      operation,
      table,
      duration,
      type: 'database',
      ...context,
    };

    if (duration > 500) {
      this.warn('Slow database query', logContext);
    } else {
      this.debug('Database operation completed', logContext);
    }
  }

  // Authentication logging
  logAuth(event: string, userId?: string, success: boolean = true, context?: LogContext): void {
    const logContext: LogContext = {
      event,
      userId,
      success,
      type: 'authentication',
      ...context,
    };

    if (success) {
      this.info('Authentication event', logContext);
    } else {
      this.warn('Authentication failed', logContext);
    }
  }

  // Security logging
  logSecurity(event: string, severity: 'low' | 'medium' | 'high', context?: LogContext): void {
    const logContext: LogContext = {
      event,
      severity,
      type: 'security',
      ...context,
    };

    if (severity === 'high') {
      this.error('High severity security event', logContext);
    } else if (severity === 'medium') {
      this.warn('Medium severity security event', logContext);
    } else {
      this.info('Low severity security event', logContext);
    }
  }
}

export const logger = new Logger();
