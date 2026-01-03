import { PaginationOptions, PaginatedResponse } from '../types';
import { config } from '../config/config';
import { logger } from '../utils/logger';
import { PaginationUtil } from '../utils/pagination';

export class PaginationService {
  /**
   * Generic pagination service for Prisma models
   * Includes query optimization and performance monitoring
   */
  static async paginate<T>(
    model: any,
    options: Partial<PaginationOptions>,
    where?: any,
    include?: any,
    select?: any
  ): Promise<PaginatedResponse<T>> {
    const startTime = Date.now();

    // Validate and sanitize pagination options
    const validatedOptions = PaginationUtil.validateOptions(options);

    // Enforce maximum page size for performance
    if (validatedOptions.limit > config.performance.maxPageSize) {
      validatedOptions.limit = config.performance.maxPageSize;
      logger.warn('Page size exceeded maximum, capped to maximum allowed', {
        requestedLimit: options.limit,
        cappedLimit: validatedOptions.limit,
      });
    }

    const skip = PaginationUtil.calculateSkip(
      validatedOptions.page,
      validatedOptions.limit
    );

    try {
      // Build the query configuration
      const queryConfig: any = {
        where,
        skip,
        take: validatedOptions.limit,
        orderBy: {
          [validatedOptions.sortBy as string]: validatedOptions.sortOrder,
        },
      };

      // Add include or select if provided
      if (include) {
        queryConfig.include = include;
      } else if (select) {
        queryConfig.select = select;
      }

      // Execute queries in parallel for better performance
      const [data, total] = await Promise.all([
        model.findMany(queryConfig),
        model.count({ where }),
      ]);

      const duration = Date.now() - startTime;

      // Log slow queries for optimization
      if (duration > 1000) {
        logger.warn('Slow pagination query detected', {
          model: model.name || 'unknown',
          duration,
          page: validatedOptions.page,
          limit: validatedOptions.limit,
          total,
          where: JSON.stringify(where),
        });
      }

      // Log performance metrics in development
      if (config.server.nodeEnv === 'development') {
        logger.debug('Pagination query completed', {
          model: model.name || 'unknown',
          duration,
          page: validatedOptions.page,
          limit: validatedOptions.limit,
          total,
          resultCount: data.length,
        });
      }

      return PaginationUtil.createResponse(
        data,
        validatedOptions.page,
        validatedOptions.limit,
        total
      );
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Pagination query failed', {
        model: model.name || 'unknown',
        duration,
        error: error instanceof Error ? error.message : 'Unknown error',
        page: validatedOptions.page,
        limit: validatedOptions.limit,
        where: JSON.stringify(where),
      });
      throw error;
    }
  }

  /**
   * Optimized pagination for large datasets with cursor-based pagination
   * More efficient for large offsets
   */
  static async paginateWithCursor<T>(
    model: any,
    options: {
      cursor?: string;
      limit?: number;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    },
    where?: any,
    include?: any,
    select?: any
  ): Promise<{
    data: T[];
    nextCursor?: string;
    hasMore: boolean;
  }> {
    const startTime = Date.now();
    const limit = Math.min(
      options.limit || config.performance.defaultPageSize,
      config.performance.maxPageSize
    );
    const sortBy = options.sortBy || 'id';
    const sortOrder = options.sortOrder || 'desc';

    try {
      const queryConfig: any = {
        where,
        take: limit + 1, // Take one extra to check if there are more results
        orderBy: { [sortBy as string]: sortOrder },
      };

      // Add cursor if provided
      if (options.cursor) {
        queryConfig.cursor = { [sortBy]: options.cursor };
        queryConfig.skip = 1; // Skip the cursor item
      }

      // Add include or select if provided
      if (include) {
        queryConfig.include = include;
      } else if (select) {
        queryConfig.select = select;
      }

      const results = await model.findMany(queryConfig);

      const hasMore = results.length > limit;
      const data = hasMore ? results.slice(0, -1) : results;
      const nextCursor =
        hasMore && data.length > 0 ? data[data.length - 1][sortBy] : undefined;

      const duration = Date.now() - startTime;

      // Log performance metrics
      if (config.server.nodeEnv === 'development') {
        logger.debug('Cursor pagination query completed', {
          model: model.name || 'unknown',
          duration,
          limit,
          cursor: options.cursor,
          resultCount: data.length,
          hasMore,
        });
      }

      return {
        data,
        nextCursor,
        hasMore,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Cursor pagination query failed', {
        model: model.name || 'unknown',
        duration,
        error: error instanceof Error ? error.message : 'Unknown error',
        cursor: options.cursor,
        limit,
      });
      throw error;
    }
  }
}
