import { PrismaClient } from '@prisma/client';
import { prisma } from '../database/client';
import { logger } from '../utils/logger';

// Type for the transaction client (without transaction methods)
type TransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

/**
 * Transaction management service for handling multi-step database operations
 * with proper rollback and data consistency
 */
export class TransactionService {
  /**
   * Execute a function within a database transaction
   * Automatically handles rollback on errors and ensures data consistency
   */
  static async executeTransaction<T>(
    operation: (tx: TransactionClient) => Promise<T>,
    operationName?: string
  ): Promise<T> {
    const startTime = Date.now();
    const txId = this.generateTransactionId();

    logger.info('Starting transaction', {
      transactionId: txId,
      operation: operationName || 'unknown',
    });

    try {
      const result = await prisma.$transaction(
        async tx => {
          logger.debug('Transaction started', {
            transactionId: txId,
            operation: operationName,
          });

          const operationResult = await operation(tx);

          logger.debug('Transaction operation completed', {
            transactionId: txId,
            operation: operationName,
          });

          return operationResult;
        },
        {
          maxWait: 5000, // Maximum time to wait for a transaction slot (5 seconds)
          timeout: 30000, // Maximum time for the transaction to complete (30 seconds)
          isolationLevel: 'ReadCommitted', // Prevent dirty reads while allowing concurrent access
        }
      );

      const duration = Date.now() - startTime;
      logger.info('Transaction completed successfully', {
        transactionId: txId,
        operation: operationName,
        durationMs: duration,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Transaction failed and rolled back', {
        transactionId: txId,
        operation: operationName,
        durationMs: duration,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });

      // Re-throw the error to maintain the original error handling flow
      throw error;
    }
  }

  /**
   * Execute multiple operations in a single transaction with retry logic
   * Useful for complex multi-step operations that may encounter temporary failures
   */
  static async executeWithRetry<T>(
    operation: (tx: TransactionClient) => Promise<T>,
    operationName: string,
    maxRetries: number = 3,
    retryDelay: number = 1000
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.executeTransaction(
          operation,
          `${operationName} (attempt ${attempt})`
        );
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');

        logger.warn('Transaction attempt failed', {
          operation: operationName,
          attempt,
          maxRetries,
          error: lastError.message,
        });

        // Don't retry on certain types of errors (validation, authorization, etc.)
        if (this.isNonRetryableError(lastError)) {
          logger.info('Non-retryable error encountered, not retrying', {
            operation: operationName,
            error: lastError.message,
          });
          throw lastError;
        }

        // Wait before retrying (exponential backoff)
        if (attempt < maxRetries) {
          const delay = retryDelay * Math.pow(2, attempt - 1);
          logger.info('Waiting before retry', {
            operation: operationName,
            attempt,
            delay: `${delay}ms`,
          });
          await this.sleep(delay);
        }
      }
    }

    logger.error('All transaction attempts failed', {
      operation: operationName,
      maxRetries,
      finalError: lastError!.message,
    });

    throw lastError!;
  }

  /**
   * Execute operations with optimistic locking to handle concurrent access
   * Useful for operations that modify data that might be updated by other processes
   */
  static async executeWithOptimisticLocking<T>(
    operation: (tx: TransactionClient) => Promise<T>,
    operationName: string,
    maxRetries: number = 5
  ): Promise<T> {
    return this.executeWithRetry(
      operation,
      `${operationName} (optimistic locking)`,
      maxRetries,
      100 // Shorter delay for optimistic locking retries
    );
  }

  /**
   * Batch operations within a transaction for better performance
   * Useful for bulk operations that need to be atomic
   */
  static async executeBatch<T>(
    operations: Array<(tx: TransactionClient) => Promise<T>>,
    operationName: string
  ): Promise<T[]> {
    return this.executeTransaction(async tx => {
      const results: T[] = [];

      for (let i = 0; i < operations.length; i++) {
        logger.debug('Executing batch operation', {
          operation: operationName,
          step: i + 1,
          totalSteps: operations.length,
        });

        const result = await operations[i](tx);
        results.push(result);
      }

      return results;
    }, `${operationName} (batch of ${operations.length})`);
  }

  /**
   * Execute a read-only transaction for consistent data retrieval
   * Useful for reports or complex queries that need consistent data
   */
  static async executeReadOnlyTransaction<T>(
    operation: (tx: TransactionClient) => Promise<T>,
    operationName?: string
  ): Promise<T> {
    const txId = this.generateTransactionId();

    logger.debug('Starting read-only transaction', {
      transactionId: txId,
      operation: operationName || 'read-only',
    });

    try {
      return await prisma.$transaction(operation, {
        maxWait: 5000,
        timeout: 15000, // Shorter timeout for read operations
        isolationLevel: 'ReadCommitted',
      });
    } catch (error) {
      logger.error('Read-only transaction failed', {
        transactionId: txId,
        operation: operationName,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Check if an error should not be retried
   */
  private static isNonRetryableError(error: Error): boolean {
    const nonRetryablePatterns = [
      'Validation failed',
      'Invalid input',
      'Unauthorized',
      'Forbidden',
      'Not found',
      'Duplicate key',
      'Foreign key constraint',
      'Check constraint',
      'Unique constraint',
    ];

    const errorMessage = error.message.toLowerCase();
    return nonRetryablePatterns.some(pattern =>
      errorMessage.includes(pattern.toLowerCase())
    );
  }

  /**
   * Generate a unique transaction ID for logging
   */
  private static generateTransactionId(): string {
    return `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Sleep utility for retry delays
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Validate transaction state before execution
   * Useful for checking preconditions
   */
  static async validateTransactionPreconditions(
    validations: Array<() => Promise<boolean>>,
    operationName: string
  ): Promise<void> {
    logger.debug('Validating transaction preconditions', {
      operation: operationName,
      validationCount: validations.length,
    });

    for (let i = 0; i < validations.length; i++) {
      const isValid = await validations[i]();
      if (!isValid) {
        const error = new Error(
          `Transaction precondition ${i + 1} failed for operation: ${operationName}`
        );
        logger.error('Transaction precondition validation failed', {
          operation: operationName,
          failedValidation: i + 1,
          error: error.message,
        });
        throw error;
      }
    }

    logger.debug('All transaction preconditions passed', {
      operation: operationName,
    });
  }

  /**
   * Execute transaction with deadlock detection and handling
   */
  static async executeWithDeadlockHandling<T>(
    operation: (tx: TransactionClient) => Promise<T>,
    operationName: string,
    maxRetries: number = 3
  ): Promise<T> {
    let attempt = 0;

    while (attempt < maxRetries) {
      attempt++;

      try {
        return await this.executeTransaction(
          operation,
          `${operationName} (deadlock handling, attempt ${attempt})`
        );
      } catch (error) {
        const isDeadlock =
          error instanceof Error &&
          (error.message.includes('deadlock') ||
            error.message.includes('lock timeout') ||
            error.message.includes('serialization failure'));

        if (isDeadlock && attempt < maxRetries) {
          const delay = Math.random() * 1000 + 500; // Random delay between 500-1500ms
          logger.warn('Deadlock detected, retrying transaction', {
            operation: operationName,
            attempt,
            maxRetries,
            delay: `${delay}ms`,
          });

          await this.sleep(delay);
          continue;
        }

        throw error;
      }
    }

    throw new Error(
      `Transaction failed after ${maxRetries} attempts due to deadlocks`
    );
  }
}
