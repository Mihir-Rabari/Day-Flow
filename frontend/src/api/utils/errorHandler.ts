// API Error Handling Utilities

import type { NetworkError, ValidationError } from '../types';

export class ApiErrorHandler {
  static isNetworkError(error: unknown): error is NetworkError {
    return (
      error instanceof Error &&
      'status' in error &&
      typeof (error as any).status === 'number'
    );
  }

  static isValidationError(error: unknown): error is ValidationError {
    return (
      error instanceof Error &&
      'field' in error &&
      typeof (error as any).field === 'string'
    );
  }

  static getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    
    if (typeof error === 'string') {
      return error;
    }
    
    return 'An unexpected error occurred';
  }

  static getErrorCode(error: unknown): string {
    if (this.isNetworkError(error) && 'code' in error) {
      return error.code;
    }
    
    if (this.isValidationError(error) && 'code' in error) {
      return error.code;
    }
    
    return 'UNKNOWN_ERROR';
  }

  static shouldRetry(error: unknown): boolean {
    if (this.isNetworkError(error)) {
      // Retry on 5xx server errors or network timeouts
      return (
        !error.status || 
        (error.status >= 500 && error.status < 600) ||
        error.code === 'NETWORK_TIMEOUT'
      );
    }
    
    return false;
  }

  static formatErrorForUser(error: unknown): string {
    if (this.isValidationError(error)) {
      return `Invalid ${error.field}: ${error.message}`;
    }
    
    if (this.isNetworkError(error)) {
      switch (error.status) {
        case 400:
          return 'Invalid request. Please check your input and try again.';
        case 401:
          return 'You are not authorized. Please log in and try again.';
        case 403:
          return 'You do not have permission to perform this action.';
        case 404:
          return 'The requested resource was not found.';
        case 409:
          return 'This action conflicts with existing data.';
        case 429:
          return 'Too many requests. Please wait a moment and try again.';
        case 500:
          return 'Server error. Please try again later.';
        case 503:
          return 'Service temporarily unavailable. Please try again later.';
        default:
          return this.getErrorMessage(error);
      }
    }
    
    return this.getErrorMessage(error);
  }

  static logError(error: unknown, context?: string): void {
    const errorMessage = this.getErrorMessage(error);
    const errorCode = this.getErrorCode(error);
    
    console.error(`API Error${context ? ` (${context})` : ''}:`, {
      message: errorMessage,
      code: errorCode,
      error
    });
    
    // In production, you might want to send this to an error reporting service
    if (import.meta.env.PROD) {
      // Example: Sentry.captureException(error);
    }
  }
}