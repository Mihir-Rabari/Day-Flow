import { Router } from 'express';
import { BackupController } from '../controllers/backupController';
import { authenticate, authorize } from '../middleware/auth';
import { UserRole } from '../types';

const router = Router();

// All backup routes require admin authentication
router.use(authenticate);
router.use(authorize([UserRole.ADMIN]));

/**
 * @route POST /api/backup
 * @desc Create a manual database backup
 * @access Admin only
 */
router.post('/', BackupController.createBackup);

/**
 * @route GET /api/backup
 * @desc List all available backup files
 * @access Admin only
 */
router.get('/', BackupController.listBackups);

/**
 * @route POST /api/backup/restore
 * @desc Restore database from backup file
 * @access Admin only
 */
router.post('/restore', BackupController.restoreBackup);

/**
 * @route DELETE /api/backup/:filename
 * @desc Delete a specific backup file
 * @access Admin only
 */
router.delete('/:filename', BackupController.deleteBackup);

/**
 * @route POST /api/backup/point-in-time
 * @desc Create a point-in-time backup
 * @access Admin only
 */
router.post('/point-in-time', BackupController.createPointInTimeBackup);

/**
 * @route POST /api/backup/verify
 * @desc Verify backup integrity
 * @access Admin only
 */
router.post('/verify', BackupController.verifyBackup);

/**
 * @route GET /api/backup/statistics
 * @desc Get backup statistics
 * @access Admin only
 */
router.get('/statistics', BackupController.getBackupStatistics);

/**
 * @route POST /api/backup/scheduled
 * @desc Create scheduled backup (for automated systems)
 * @access Admin only
 */
router.post('/scheduled', BackupController.createScheduledBackup);

export default router;
