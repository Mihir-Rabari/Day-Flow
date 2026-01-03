import { Request, Response } from 'express';
import { BackupService } from '../services/backupService';
import { logger } from '../utils/logger';
import { ApiResponse } from '../utils/response';

/**
 * Controller for database backup and recovery operations
 * Only accessible by admin users
 */
export class BackupController {
  /**
   * Create a manual database backup
   */
  static async createBackup(req: Request, res: Response): Promise<void> {
    try {
      const { backupName } = req.body;

      logger.info('Manual backup requested', {
        requestedBy: req.user?.id,
        backupName,
      });

      const backupPath = await BackupService.createBackup(backupName);

      const response: ApiResponse<{ backupPath: string }> = {
        success: true,
        data: { backupPath },
        message: 'Backup created successfully',
      };

      res.status(201).json(response);
    } catch (error) {
      logger.error('Failed to create backup', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestedBy: req.user?.id,
      });

      const response: ApiResponse<null> = {
        success: false,
        message: 'Failed to create backup',
        errors: [
          {
            field: 'backup',
            message:
              error instanceof Error ? error.message : 'Unknown error occurred',
            code: 'BACKUP_FAILED',
          },
        ],
      };

      res.status(500).json(response);
    }
  }

  /**
   * List all available backup files
   */
  static async listBackups(req: Request, res: Response): Promise<void> {
    try {
      const backups = await BackupService.listBackups();

      const response: ApiResponse<typeof backups> = {
        success: true,
        data: backups,
        message: 'Backups retrieved successfully',
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Failed to list backups', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestedBy: req.user?.id,
      });

      const response: ApiResponse<null> = {
        success: false,
        message: 'Failed to retrieve backups',
        errors: [
          {
            field: 'backups',
            message:
              error instanceof Error ? error.message : 'Unknown error occurred',
            code: 'LIST_BACKUPS_FAILED',
          },
        ],
      };

      res.status(500).json(response);
    }
  }

  /**
   * Restore database from a backup file
   */
  static async restoreBackup(req: Request, res: Response): Promise<void> {
    try {
      const { backupPath, targetDatabase } = req.body;

      if (!backupPath) {
        const response: ApiResponse<null> = {
          success: false,
          message: 'Backup path is required',
          errors: [
            {
              field: 'backupPath',
              message: 'Backup path is required',
              code: 'MISSING_BACKUP_PATH',
            },
          ],
        };

        res.status(400).json(response);
        return;
      }

      logger.info('Database restore requested', {
        requestedBy: req.user?.id,
        backupPath,
        targetDatabase,
      });

      await BackupService.restoreBackup(backupPath, targetDatabase);

      const response: ApiResponse<null> = {
        success: true,
        message: 'Database restored successfully',
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Failed to restore backup', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestedBy: req.user?.id,
        backupPath: req.body.backupPath,
      });

      const response: ApiResponse<null> = {
        success: false,
        message: 'Failed to restore backup',
        errors: [
          {
            field: 'restore',
            message:
              error instanceof Error ? error.message : 'Unknown error occurred',
            code: 'RESTORE_FAILED',
          },
        ],
      };

      res.status(500).json(response);
    }
  }

  /**
   * Delete a specific backup file
   */
  static async deleteBackup(req: Request, res: Response): Promise<void> {
    try {
      const { filename } = req.params;

      if (!filename) {
        const response: ApiResponse<null> = {
          success: false,
          message: 'Backup filename is required',
          errors: [
            {
              field: 'filename',
              message: 'Backup filename is required',
              code: 'MISSING_FILENAME',
            },
          ],
        };

        res.status(400).json(response);
        return;
      }

      logger.info('Backup deletion requested', {
        requestedBy: req.user?.id,
        filename,
      });

      await BackupService.deleteBackup(filename);

      const response: ApiResponse<null> = {
        success: true,
        message: 'Backup deleted successfully',
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Failed to delete backup', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestedBy: req.user?.id,
        filename: req.params.filename,
      });

      const response: ApiResponse<null> = {
        success: false,
        message: 'Failed to delete backup',
        errors: [
          {
            field: 'delete',
            message:
              error instanceof Error ? error.message : 'Unknown error occurred',
            code: 'DELETE_FAILED',
          },
        ],
      };

      res.status(500).json(response);
    }
  }

  /**
   * Create a point-in-time backup
   */
  static async createPointInTimeBackup(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      logger.info('Point-in-time backup requested', {
        requestedBy: req.user?.id,
      });

      const result = await BackupService.createPointInTimeBackup();

      const response: ApiResponse<typeof result> = {
        success: true,
        data: result,
        message: 'Point-in-time backup created successfully',
      };

      res.status(201).json(response);
    } catch (error) {
      logger.error('Failed to create point-in-time backup', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestedBy: req.user?.id,
      });

      const response: ApiResponse<null> = {
        success: false,
        message: 'Failed to create point-in-time backup',
        errors: [
          {
            field: 'backup',
            message:
              error instanceof Error ? error.message : 'Unknown error occurred',
            code: 'PIT_BACKUP_FAILED',
          },
        ],
      };

      res.status(500).json(response);
    }
  }

  /**
   * Verify backup integrity
   */
  static async verifyBackup(req: Request, res: Response): Promise<void> {
    try {
      const { backupPath } = req.body;

      if (!backupPath) {
        const response: ApiResponse<null> = {
          success: false,
          message: 'Backup path is required',
          errors: [
            {
              field: 'backupPath',
              message: 'Backup path is required',
              code: 'MISSING_BACKUP_PATH',
            },
          ],
        };

        res.status(400).json(response);
        return;
      }

      logger.info('Backup verification requested', {
        requestedBy: req.user?.id,
        backupPath,
      });

      const isValid = await BackupService.verifyBackup(backupPath);

      const response: ApiResponse<{ isValid: boolean }> = {
        success: true,
        data: { isValid },
        message: isValid ? 'Backup is valid' : 'Backup verification failed',
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Failed to verify backup', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestedBy: req.user?.id,
        backupPath: req.body.backupPath,
      });

      const response: ApiResponse<null> = {
        success: false,
        message: 'Failed to verify backup',
        errors: [
          {
            field: 'verify',
            message:
              error instanceof Error ? error.message : 'Unknown error occurred',
            code: 'VERIFY_FAILED',
          },
        ],
      };

      res.status(500).json(response);
    }
  }

  /**
   * Get backup statistics
   */
  static async getBackupStatistics(req: Request, res: Response): Promise<void> {
    try {
      const statistics = await BackupService.getBackupStatistics();

      const response: ApiResponse<typeof statistics> = {
        success: true,
        data: statistics,
        message: 'Backup statistics retrieved successfully',
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Failed to get backup statistics', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestedBy: req.user?.id,
      });

      const response: ApiResponse<null> = {
        success: false,
        message: 'Failed to retrieve backup statistics',
        errors: [
          {
            field: 'statistics',
            message:
              error instanceof Error ? error.message : 'Unknown error occurred',
            code: 'STATISTICS_FAILED',
          },
        ],
      };

      res.status(500).json(response);
    }
  }

  /**
   * Create scheduled backup (for automated systems)
   */
  static async createScheduledBackup(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      logger.info('Scheduled backup requested', {
        requestedBy: req.user?.id || 'system',
      });

      const backupPath = await BackupService.createScheduledBackup();

      const response: ApiResponse<{ backupPath: string }> = {
        success: true,
        data: { backupPath },
        message: 'Scheduled backup created successfully',
      };

      res.status(201).json(response);
    } catch (error) {
      logger.error('Failed to create scheduled backup', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestedBy: req.user?.id || 'system',
      });

      const response: ApiResponse<null> = {
        success: false,
        message: 'Failed to create scheduled backup',
        errors: [
          {
            field: 'backup',
            message:
              error instanceof Error ? error.message : 'Unknown error occurred',
            code: 'SCHEDULED_BACKUP_FAILED',
          },
        ],
      };

      res.status(500).json(response);
    }
  }
}
