import { prisma } from '../database/client';
import { logger } from '../utils/logger';
import { config } from '../config/config';

export class QueryOptimizationService {
  /**
   * Analyze and optimize common query patterns
   */
  static async analyzeQueryPerformance(): Promise<void> {
    if (!config.performance.enableQueryOptimization) {
      return;
    }

    try {
      logger.info('Starting query performance analysis');

      // Check for missing indexes on frequently queried columns
      await this.checkIndexUsage();

      // Analyze slow queries
      await this.analyzeSlowQueries();

      logger.info('Query performance analysis completed');
    } catch (error) {
      logger.error('Query performance analysis failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Check index usage and suggest optimizations
   */
  private static async checkIndexUsage(): Promise<void> {
    try {
      // Get table statistics
      const tableStats = await prisma.$queryRaw`
        SELECT 
          schemaname,
          tablename,
          attname,
          n_distinct,
          correlation
        FROM pg_stats 
        WHERE schemaname = 'public'
        ORDER BY tablename, attname;
      `;

      logger.debug('Database table statistics', { tableStats });

      // Check for unused indexes
      const unusedIndexes = await prisma.$queryRaw`
        SELECT 
          schemaname,
          tablename,
          indexname,
          idx_tup_read,
          idx_tup_fetch
        FROM pg_stat_user_indexes 
        WHERE idx_tup_read = 0 AND idx_tup_fetch = 0;
      `;

      if (Array.isArray(unusedIndexes) && unusedIndexes.length > 0) {
        logger.warn('Unused indexes detected', { unusedIndexes });
      }
    } catch (error) {
      logger.error('Index usage analysis failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Analyze slow queries and log recommendations
   */
  private static async analyzeSlowQueries(): Promise<void> {
    try {
      // Get slow queries from pg_stat_statements if available
      const slowQueries = await prisma.$queryRaw`
        SELECT 
          query,
          calls,
          total_time,
          mean_time,
          rows
        FROM pg_stat_statements 
        WHERE mean_time > 100
        ORDER BY mean_time DESC 
        LIMIT 10;
      `.catch(() => {
        // pg_stat_statements extension might not be available
        logger.debug(
          'pg_stat_statements extension not available for slow query analysis'
        );
        return [];
      });

      if (Array.isArray(slowQueries) && slowQueries.length > 0) {
        logger.warn('Slow queries detected', { slowQueries });
      }
    } catch (error) {
      logger.error('Slow query analysis failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get database connection pool statistics
   */
  static async getConnectionPoolStats(): Promise<any> {
    try {
      const poolStats = await prisma.$queryRaw`
        SELECT 
          state,
          count(*) as connection_count
        FROM pg_stat_activity 
        WHERE datname = current_database()
        GROUP BY state;
      `;

      return poolStats;
    } catch (error) {
      logger.error('Failed to get connection pool statistics', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Optimize query execution plans
   */
  static async explainQuery(query: string, _params?: any[]): Promise<any> {
    if (config.server.nodeEnv !== 'development') {
      return null;
    }

    try {
      const plan =
        await prisma.$queryRaw`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`;
      logger.debug('Query execution plan', { query, plan });
      return plan;
    } catch (error) {
      logger.error('Query explain failed', {
        query,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Monitor database performance metrics
   */
  static async getPerformanceMetrics(): Promise<{
    connectionCount: number;
    activeQueries: number;
    cacheHitRatio: number;
    indexUsage: any[];
  }> {
    try {
      // Get active connection count
      const connectionStats = await prisma.$queryRaw`
        SELECT count(*) as active_connections
        FROM pg_stat_activity 
        WHERE state = 'active' AND datname = current_database();
      `;

      // Get cache hit ratio
      const cacheStats = await prisma.$queryRaw`
        SELECT 
          sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)) * 100 as cache_hit_ratio
        FROM pg_statio_user_tables;
      `;

      // Get index usage statistics
      const indexStats = await prisma.$queryRaw`
        SELECT 
          schemaname,
          tablename,
          indexname,
          idx_tup_read,
          idx_tup_fetch
        FROM pg_stat_user_indexes 
        ORDER BY idx_tup_read DESC 
        LIMIT 10;
      `;

      return {
        connectionCount:
          Array.isArray(connectionStats) && connectionStats[0]
            ? (connectionStats[0] as any).active_connections
            : 0,
        activeQueries: 0, // Will be populated by monitoring middleware
        cacheHitRatio:
          Array.isArray(cacheStats) && cacheStats[0]
            ? (cacheStats[0] as any).cache_hit_ratio || 0
            : 0,
        indexUsage: Array.isArray(indexStats) ? indexStats : [],
      };
    } catch (error) {
      logger.error('Failed to get performance metrics', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        connectionCount: 0,
        activeQueries: 0,
        cacheHitRatio: 0,
        indexUsage: [],
      };
    }
  }
}
