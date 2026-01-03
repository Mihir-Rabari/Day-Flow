import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { config } from '../config/config';
import { logger } from '../utils/logger';

const execAsync = promisify(exec);

/**
 * Database backup and recovery service
 * Provides functionality for automated backups, restore operations, and point-in-time recovery
 */
export class BackupService {
  private static readonly BACKUP_DIR = process.env.BACKUP_DIR || './backups';
  private static readonly MAX_BACKUP_AGE_DAYS = parseInt(
    process.env.MAX_BACKUP_AGE_DAYS || '30'
  );
  private static readonly MAX_BACKUP_COUNT = parseInt(
    process.env.MAX_BACKUP_COUNT || '50'
  );

  /**
   * Create a full database backup
   */
  static async createBackup(backupName?: string): Promise<string> {
    try {
      // Ensure backup directory exists
      await this.ensureBackupDirectory();

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = backupName || `dayflow_backup_${timestamp}.sql`;
      const backupPath = path.join(this.BACKUP_DIR, filename);

      logger.info('Starting database backup', {
        filename,
        backupPath,
      });

      // Extract database connection details
      const dbUrl = new URL(config.database.url);
      const dbName = dbUrl.pathname.slice(1); // Remove leading slash
      const host = dbUrl.hostname;
      const port = dbUrl.port || '5432';
      const username = dbUrl.username;
      const password = dbUrl.password;

      // Create pg_dump command
      const dumpCommand = [
        'pg_dump',
        `--host=${host}`,
        `--port=${port}`,
        `--username=${username}`,
        `--dbname=${dbName}`,
        '--verbose',
        '--clean',
        '--no-owner',
        '--no-privileges',
        '--format=custom',
        `--file=${backupPath}`,
      ].join(' ');

      // Set password environment variable
      const env = { ...process.env, PGPASSWORD: password };

      // Execute backup
      const { stderr } = await execAsync(dumpCommand, { env });

      if (stderr && !stderr.includes('NOTICE')) {
        logger.warn('Backup completed with warnings', {
          filename,
          warnings: stderr,
        });
      }

      // Verify backup file was created
      const stats = await fs.stat(backupPath);
      if (stats.size === 0) {
        throw new Error('Backup file is empty');
      }

      logger.info('Database backup completed successfully', {
        filename,
        backupPath,
        size: `${(stats.size / 1024 / 1024).toFixed(2)} MB`,
      });

      // Clean up old backups
      await this.cleanupOldBackups();

      return backupPath;
    } catch (error) {
      logger.error('Database backup failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        backupName,
      });
      throw new Error(
        `Backup failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Restore database from backup file
   */
  static async restoreBackup(
    backupPath: string,
    targetDatabase?: string
  ): Promise<void> {
    try {
      // Verify backup file exists
      await fs.access(backupPath);

      logger.info('Starting database restore', {
        backupPath,
        targetDatabase,
      });

      // Extract database connection details
      const dbUrl = new URL(config.database.url);
      const dbName = targetDatabase || dbUrl.pathname.slice(1);
      const host = dbUrl.hostname;
      const port = dbUrl.port || '5432';
      const username = dbUrl.username;
      const password = dbUrl.password;

      // Create pg_restore command
      const restoreCommand = [
        'pg_restore',
        `--host=${host}`,
        `--port=${port}`,
        `--username=${username}`,
        `--dbname=${dbName}`,
        '--verbose',
        '--clean',
        '--if-exists',
        '--no-owner',
        '--no-privileges',
        backupPath,
      ].join(' ');

      // Set password environment variable
      const env = { ...process.env, PGPASSWORD: password };

      // Execute restore
      const { stderr } = await execAsync(restoreCommand, { env });

      if (stderr && !stderr.includes('NOTICE')) {
        logger.warn('Restore completed with warnings', {
          backupPath,
          warnings: stderr,
        });
      }

      logger.info('Database restore completed successfully', {
        backupPath,
        targetDatabase: dbName,
      });
    } catch (error) {
      logger.error('Database restore failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        backupPath,
        targetDatabase,
      });
      throw new Error(
        `Restore failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Create automated backup with scheduling support
   */
  static async createScheduledBackup(): Promise<string> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `scheduled_backup_${timestamp}.sql`;

      logger.info('Creating scheduled backup', { filename });

      const backupPath = await this.createBackup(filename);

      // Log backup completion for monitoring
      logger.info('Scheduled backup completed', {
        filename,
        backupPath,
        timestamp: new Date().toISOString(),
      });

      return backupPath;
    } catch (error) {
      logger.error('Scheduled backup failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * List available backup files
   */
  static async listBackups(): Promise<
    Array<{
      filename: string;
      path: string;
      size: number;
      created: Date;
    }>
  > {
    try {
      await this.ensureBackupDirectory();

      const files = await fs.readdir(this.BACKUP_DIR);
      const backupFiles = files.filter(file => file.endsWith('.sql'));

      const backups = await Promise.all(
        backupFiles.map(async filename => {
          const filePath = path.join(this.BACKUP_DIR, filename);
          const stats = await fs.stat(filePath);

          return {
            filename,
            path: filePath,
            size: stats.size,
            created: stats.birthtime,
          };
        })
      );

      // Sort by creation date (newest first)
      return backups.sort((a, b) => b.created.getTime() - a.created.getTime());
    } catch (error) {
      logger.error('Failed to list backups', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Delete a specific backup file
   */
  static async deleteBackup(filename: string): Promise<void> {
    try {
      const backupPath = path.join(this.BACKUP_DIR, filename);

      // Verify file exists and is in backup directory
      await fs.access(backupPath);

      if (!backupPath.startsWith(path.resolve(this.BACKUP_DIR))) {
        throw new Error('Invalid backup file path');
      }

      await fs.unlink(backupPath);

      logger.info('Backup file deleted', {
        filename,
        backupPath,
      });
    } catch (error) {
      logger.error('Failed to delete backup', {
        error: error instanceof Error ? error.message : 'Unknown error',
        filename,
      });
      throw error;
    }
  }

  /**
   * Create point-in-time recovery backup
   * This creates a backup with transaction log information for precise recovery
   */
  static async createPointInTimeBackup(): Promise<{
    backupPath: string;
    timestamp: Date;
    lsn: string;
  }> {
    try {
      const timestamp = new Date();
      const filename = `pit_backup_${timestamp.toISOString().replace(/[:.]/g, '-')}.sql`;

      logger.info('Creating point-in-time backup', { filename });

      // Get current LSN (Log Sequence Number) for point-in-time recovery
      const lsn = await this.getCurrentLSN();

      const backupPath = await this.createBackup(filename);

      // Store metadata for point-in-time recovery
      const metadataPath = backupPath.replace('.sql', '.metadata.json');
      const metadata = {
        timestamp: timestamp.toISOString(),
        lsn,
        backupPath,
        type: 'point-in-time',
      };

      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

      logger.info('Point-in-time backup completed', {
        filename,
        backupPath,
        lsn,
        timestamp: timestamp.toISOString(),
      });

      return {
        backupPath,
        timestamp,
        lsn,
      };
    } catch (error) {
      logger.error('Point-in-time backup failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Verify backup integrity
   */
  static async verifyBackup(backupPath: string): Promise<boolean> {
    try {
      // Check if file exists and is readable
      await fs.access(backupPath, fs.constants.R_OK);

      // Check file size
      const stats = await fs.stat(backupPath);
      if (stats.size === 0) {
        logger.error('Backup verification failed: file is empty', {
          backupPath,
        });
        return false;
      }

      // For custom format backups, we can use pg_restore --list to verify
      const dbUrl = new URL(config.database.url);
      const password = dbUrl.password;

      const listCommand = `pg_restore --list ${backupPath}`;
      const env = { ...process.env, PGPASSWORD: password };

      try {
        const { stdout } = await execAsync(listCommand, { env });

        // Check if backup contains expected tables
        const expectedTables = [
          'employees',
          'attendance_records',
          'leave_requests',
          'salary_components',
        ];
        const hasAllTables = expectedTables.every(table =>
          stdout.includes(table)
        );

        if (!hasAllTables) {
          logger.error('Backup verification failed: missing expected tables', {
            backupPath,
            expectedTables,
          });
          return false;
        }

        logger.info('Backup verification successful', {
          backupPath,
          size: `${(stats.size / 1024 / 1024).toFixed(2)} MB`,
        });

        return true;
      } catch (listError) {
        logger.error('Backup verification failed: cannot list contents', {
          backupPath,
          error:
            listError instanceof Error ? listError.message : 'Unknown error',
        });
        return false;
      }
    } catch (error) {
      logger.error('Backup verification failed', {
        backupPath,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Clean up old backup files based on retention policy
   */
  private static async cleanupOldBackups(): Promise<void> {
    try {
      const backups = await this.listBackups();
      const now = new Date();

      // Remove backups older than MAX_BACKUP_AGE_DAYS
      const oldBackups = backups.filter(backup => {
        const ageInDays =
          (now.getTime() - backup.created.getTime()) / (1000 * 60 * 60 * 24);
        return ageInDays > this.MAX_BACKUP_AGE_DAYS;
      });

      // Remove excess backups if we have more than MAX_BACKUP_COUNT
      const excessBackups = backups.slice(this.MAX_BACKUP_COUNT);

      const backupsToDelete = [...oldBackups, ...excessBackups];

      for (const backup of backupsToDelete) {
        try {
          await this.deleteBackup(backup.filename);
          logger.info('Old backup cleaned up', {
            filename: backup.filename,
            age: `${((now.getTime() - backup.created.getTime()) / (1000 * 60 * 60 * 24)).toFixed(1)} days`,
          });
        } catch (error) {
          logger.warn('Failed to delete old backup', {
            filename: backup.filename,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      if (backupsToDelete.length > 0) {
        logger.info('Backup cleanup completed', {
          deletedCount: backupsToDelete.length,
          remainingCount: backups.length - backupsToDelete.length,
        });
      }
    } catch (error) {
      logger.error('Backup cleanup failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Ensure backup directory exists
   */
  private static async ensureBackupDirectory(): Promise<void> {
    try {
      await fs.access(this.BACKUP_DIR);
    } catch {
      await fs.mkdir(this.BACKUP_DIR, { recursive: true });
      logger.info('Created backup directory', { path: this.BACKUP_DIR });
    }
  }

  /**
   * Get current Log Sequence Number for point-in-time recovery
   */
  private static async getCurrentLSN(): Promise<string> {
    try {
      const dbUrl = new URL(config.database.url);
      const host = dbUrl.hostname;
      const port = dbUrl.port || '5432';
      const username = dbUrl.username;
      const password = dbUrl.password;
      const dbName = dbUrl.pathname.slice(1);

      const lsnCommand = [
        'psql',
        `--host=${host}`,
        `--port=${port}`,
        `--username=${username}`,
        `--dbname=${dbName}`,
        '--tuples-only',
        '--no-align',
        '--command=SELECT pg_current_wal_lsn();',
      ].join(' ');

      const env = { ...process.env, PGPASSWORD: password };
      const { stdout } = await execAsync(lsnCommand, { env });

      return stdout.trim();
    } catch (error) {
      logger.warn('Failed to get current LSN', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return 'unknown';
    }
  }

  /**
   * Get backup statistics
   */
  static async getBackupStatistics(): Promise<{
    totalBackups: number;
    totalSize: number;
    oldestBackup?: Date;
    newestBackup?: Date;
    averageSize: number;
  }> {
    try {
      const backups = await this.listBackups();

      if (backups.length === 0) {
        return {
          totalBackups: 0,
          totalSize: 0,
          averageSize: 0,
        };
      }

      const totalSize = backups.reduce((sum, backup) => sum + backup.size, 0);
      const averageSize = totalSize / backups.length;

      return {
        totalBackups: backups.length,
        totalSize,
        oldestBackup: backups[backups.length - 1]?.created,
        newestBackup: backups[0]?.created,
        averageSize,
      };
    } catch (error) {
      logger.error('Failed to get backup statistics', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }
}
