import * as fs from 'fs/promises';
import { BackupService } from '../services/backupService';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';

jest.mock('fs/promises');
jest.mock('child_process', () => ({
  exec: jest.fn(),
}));
jest.mock('../config/config', () => ({
  config: {
    database: {
      url: 'postgresql://user:pass@localhost:5432/db',
    },
  },
}));

// Mock promisify to return the mocked exec
const mockedExec = exec as unknown as jest.Mock;

describe('BackupService Security', () => {
  const BACKUP_DIR = './backups';
  const resolvedBackupDir = path.resolve(BACKUP_DIR);

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.BACKUP_DIR = BACKUP_DIR;
  });

  describe('restoreBackup', () => {
    it('should NOT allow restoration from a path outside the backup directory', async () => {
      const maliciousPath = '/etc/passwd';

      // Currently, it only checks if the file exists
      (fs.access as jest.Mock).mockResolvedValue(undefined);
      mockedExec.mockImplementation((cmd, options, callback) => {
        callback(null, { stdout: '', stderr: '' });
      });

      // This is expected to FAIL before the fix
      // But we want it to THROW after the fix
      await expect(BackupService.restoreBackup(maliciousPath)).rejects.toThrow('Invalid backup file path');
    });

    it('should NOT allow restoration from a path with traversal', async () => {
      const maliciousPath = path.join(BACKUP_DIR, '../../etc/passwd');

      (fs.access as jest.Mock).mockResolvedValue(undefined);
      mockedExec.mockImplementation((cmd, options, callback) => {
        callback(null, { stdout: '', stderr: '' });
      });

      await expect(BackupService.restoreBackup(maliciousPath)).rejects.toThrow('Invalid backup file path');
    });
  });

  describe('verifyBackup', () => {
    it('should NOT allow verification of a file outside the backup directory', async () => {
      const maliciousPath = '/etc/passwd';

      (fs.access as jest.Mock).mockResolvedValue(undefined);
      (fs.stat as jest.Mock).mockResolvedValue({ size: 1024 });
      mockedExec.mockImplementation((cmd, options, callback) => {
        callback(null, { stdout: 'employees', stderr: '' });
      });

      const result = await BackupService.verifyBackup(maliciousPath);
      expect(result).toBe(false);
    });
  });

  describe('deleteBackup', () => {
    it('should NOT allow deletion of a file outside the backup directory via filename traversal', async () => {
      const maliciousFilename = '../../etc/passwd';

      (fs.access as jest.Mock).mockResolvedValue(undefined);
      (fs.unlink as jest.Mock).mockResolvedValue(undefined);

      await expect(BackupService.deleteBackup(maliciousFilename)).rejects.toThrow('Invalid backup file path');
    });
  });
});
