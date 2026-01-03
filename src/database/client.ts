import { PrismaClient } from '@prisma/client';
import { config } from '../config/config';

// Create a singleton Prisma client with optimized configuration
class DatabaseClient {
  private static instance: PrismaClient;

  public static getInstance(): PrismaClient {
    if (!DatabaseClient.instance) {
      DatabaseClient.instance = new PrismaClient({
        datasources: {
          db: {
            url: config.database.url,
          },
        },
        log:
          config.server.nodeEnv === 'development'
            ? ['query', 'info', 'warn', 'error']
            : ['error'],
      });

      // Handle graceful shutdown
      process.on('beforeExit', async () => {
        await DatabaseClient.instance.$disconnect();
      });

      process.on('SIGINT', async () => {
        await DatabaseClient.instance.$disconnect();
        process.exit(0);
      });

      process.on('SIGTERM', async () => {
        await DatabaseClient.instance.$disconnect();
        process.exit(0);
      });
    }

    return DatabaseClient.instance;
  }

  public static async disconnect(): Promise<void> {
    if (DatabaseClient.instance) {
      await DatabaseClient.instance.$disconnect();
    }
  }
}

// Export the singleton instance
export const prisma = DatabaseClient.getInstance();

// Export the class for testing purposes
export { DatabaseClient };
