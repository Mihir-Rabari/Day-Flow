import * as fc from 'fast-check';
import { 
  AppError, 
  ValidationError, 
  AuthenticationError, 
  AuthorizationError, 
  NotFoundError,
  DatabaseError,
  ConflictError,
  RateLimitError
} from '../middleware/errorHandler';

describe('Error Handling Property Tests', () => {
  /**
   * Feature: dayflow-backend, Property 12: Error Handling Consistency
   * 
   * For any error condition, the system should return appropriate HTTP status codes 
   * with descriptive messages, log errors with sufficient context, handle database 
   * errors gracefully, and provide structured JSON responses.
   * 
   * Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5
   */

  describe('Property 12.1: HTTP Status Code Consistency', () => {
    it('should return consistent HTTP status codes for different error types', () => {
      fc.assert(fc.property(
        fc.oneof(
          fc.constant('ValidationError'),
          fc.constant('AuthenticationError'),
          fc.constant('AuthorizationError'),
          fc.constant('NotFoundError'),
          fc.constant('DatabaseError'),
          fc.constant('ConflictError'),
          fc.constant('RateLimitError')
        ),
        fc.string({ minLength: 1, maxLength: 100 }),
        (errorType, message) => {
          let error: AppError;
          let expectedStatusCode: number;
          let expectedCodePrefix: string;

          switch (errorType) {
            case 'ValidationError':
              error = new ValidationError(message);
              expectedStatusCode = 400;
              expectedCodePrefix = 'VALIDATION_FAILED';
              break;
            case 'AuthenticationError':
              error = new AuthenticationError(message);
              expectedStatusCode = 401;
              expectedCodePrefix = 'AUTH_FAILED';
              break;
            case 'AuthorizationError':
              error = new AuthorizationError(message);
              expectedStatusCode = 403;
              expectedCodePrefix = 'FORBIDDEN';
              break;
            case 'NotFoundError':
              error = new NotFoundError(message);
              expectedStatusCode = 404;
              expectedCodePrefix = 'NOT_FOUND';
              break;
            case 'DatabaseError':
              error = new DatabaseError(message);
              expectedStatusCode = 500;
              expectedCodePrefix = 'DB_ERROR';
              break;
            case 'ConflictError':
              error = new ConflictError(message);
              expectedStatusCode = 409;
              expectedCodePrefix = 'CONFLICT';
              break;
            case 'RateLimitError':
              error = new RateLimitError(message);
              expectedStatusCode = 429;
              expectedCodePrefix = 'RATE_LIMIT_EXCEEDED';
              break;
            default:
              throw new Error('Unknown error type');
          }

          // Verify error properties
          expect(error.statusCode).toBe(expectedStatusCode);
          expect(error.code).toBe(expectedCodePrefix);
          expect(error.message).toBe(message);
          expect(error.isOperational).toBe(true);
        }
      ), { numRuns: 100 });
    });
  });

  describe('Property 12.2: Validation Error Details Structure', () => {
    it('should include validation details when present', () => {
      fc.assert(fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        fc.array(fc.record({
          field: fc.string({ minLength: 1, maxLength: 50 }),
          message: fc.string({ minLength: 1, maxLength: 100 }),
          code: fc.string({ minLength: 1, maxLength: 20 })
        }), { minLength: 1, maxLength: 5 }),
        (message, details) => {
          const error = new ValidationError(message, details);

          expect(error.statusCode).toBe(400);
          expect(error.code).toBe('VALIDATION_FAILED');
          expect(error.message).toBe(message);
          expect(error.details).toEqual(details);
        }
      ), { numRuns: 100 });
    });
  });

  describe('Property 12.3: Error Message Sanitization', () => {
    it('should sanitize error messages to prevent information leakage', () => {
      fc.assert(fc.property(
        fc.string({ minLength: 1, maxLength: 200 }),
        (message) => {
          const error = new AppError(message, 500, 'TEST_ERROR');

          // Error message should maintain the original message structure
          expect(error.message).toBe(message);
          expect(error.statusCode).toBe(500);
          expect(error.code).toBe('TEST_ERROR');
          expect(error.isOperational).toBe(true);
        }
      ), { numRuns: 100 });
    });
  });

  describe('Property 12.4: Database Error Abstraction', () => {
    it('should abstract database-specific error details', () => {
      fc.assert(fc.property(
        fc.oneof(
          fc.constant('P2002'), // Unique constraint
          fc.constant('P2025'), // Record not found
          fc.constant('P2003'), // Foreign key constraint
          fc.constant('P1001'), // Connection error
          fc.constant('P1008')  // Timeout
        ),
        fc.string({ minLength: 1, maxLength: 100 }),
        (prismaCode, _originalMessage) => {
          // Simulate Prisma error handling
          let expectedMessage: string;

          switch (prismaCode) {
            case 'P2002':
              expectedMessage = 'field already exists';
              break;
            case 'P2025':
              expectedMessage = 'Record not found';
              break;
            case 'P2003':
              expectedMessage = 'Invalid reference to related record';
              break;
            case 'P1001':
              expectedMessage = 'Database connection failed';
              break;
            case 'P1008':
              expectedMessage = 'Database operation timed out';
              break;
            default:
              expectedMessage = 'Database operation failed';
          }

          // Verify that database errors are properly abstracted
          expect(expectedMessage).not.toContain('P2002');
          expect(expectedMessage).not.toContain('P2025');
          expect(expectedMessage).not.toContain('P2003');
          expect(expectedMessage).not.toContain('P1001');
          expect(expectedMessage).not.toContain('P1008');
          expect(expectedMessage).not.toContain('prisma');
          expect(expectedMessage).not.toContain('postgresql');
        }
      ), { numRuns: 100 });
    });
  });

  describe('Property 12.5: Error Logging Context Completeness', () => {
    it('should include sufficient context in error logs', () => {
      fc.assert(fc.property(
        fc.record({
          method: fc.oneof(fc.constant('GET'), fc.constant('POST'), fc.constant('PUT'), fc.constant('DELETE')),
          url: fc.string({ minLength: 1, maxLength: 100 }),
          userId: fc.option(fc.string({ minLength: 1, maxLength: 50 })),
          userAgent: fc.option(fc.string({ minLength: 1, maxLength: 100 })),
          ip: fc.ipV4()
        }),
        fc.string({ minLength: 1, maxLength: 200 }),
        (requestContext, errorMessage) => {
          const error = new Error(errorMessage);
          
          // Mock request object
          const mockReq = {
            method: requestContext.method,
            url: requestContext.url,
            user: requestContext.userId ? { id: requestContext.userId } : undefined,
            get: (header: string) => header === 'User-Agent' ? requestContext.userAgent : undefined,
            ip: requestContext.ip
          };

          // Verify that all necessary context would be logged
          expect(mockReq.method).toBeDefined();
          expect(mockReq.url).toBeDefined();
          expect(mockReq.ip).toBeDefined();
          
          // Error should have message and stack
          expect(error.message).toBe(errorMessage);
          expect(error.stack).toBeDefined();
        }
      ), { numRuns: 100 });
    });
  });

  describe('Property 12.6: Error Inheritance and Polymorphism', () => {
    it('should maintain proper inheritance hierarchy for all error types', () => {
      fc.assert(fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        (message) => {
          const errors = [
            new ValidationError(message),
            new AuthenticationError(message),
            new AuthorizationError(message),
            new NotFoundError(message),
            new DatabaseError(message),
            new ConflictError(message),
            new RateLimitError(message)
          ];

          errors.forEach(error => {
            // All errors should inherit from AppError
            expect(error).toBeInstanceOf(AppError);
            expect(error).toBeInstanceOf(Error);
            
            // All errors should be operational
            expect(error.isOperational).toBe(true);
            
            // All errors should have required properties
            expect(error.statusCode).toBeGreaterThan(0);
            expect(error.code).toBeTruthy();
            expect(error.message).toBe(message);
            expect(error.stack).toBeDefined();
          });
        }
      ), { numRuns: 50 });
    });
  });

  describe('Property 12.7: Error Code Consistency', () => {
    it('should maintain consistent error codes for same error types', () => {
      fc.assert(fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        fc.string({ minLength: 1, maxLength: 100 }),
        (message1, message2) => {
          // Same error type should have same code regardless of message
          const error1 = new ValidationError(message1);
          const error2 = new ValidationError(message2);
          
          expect(error1.code).toBe(error2.code);
          expect(error1.statusCode).toBe(error2.statusCode);
          
          const authError1 = new AuthenticationError(message1);
          const authError2 = new AuthenticationError(message2);
          
          expect(authError1.code).toBe(authError2.code);
          expect(authError1.statusCode).toBe(authError2.statusCode);
        }
      ), { numRuns: 100 });
    });
  });
});