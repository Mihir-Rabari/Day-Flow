import { Router } from 'express';
import { attendanceController } from '../controllers/attendanceController';
import { authenticate, checkResourcePermission } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import Joi from 'joi';

const router = Router();

// Validation schemas
const checkInSchema = Joi.object({
  remarks: Joi.string().optional().max(500),
});

const checkOutSchema = Joi.object({
  remarks: Joi.string().optional().max(500),
});

const attendanceQuerySchema = Joi.object({
  employeeId: Joi.string().uuid().optional(),
  dateFrom: Joi.date().iso().optional(),
  dateTo: Joi.date().iso().optional(),
  status: Joi.string()
    .valid('PRESENT', 'ABSENT', 'HALF_DAY', 'LEAVE')
    .optional(),
  department: Joi.string().optional(),
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
  sortBy: Joi.string().valid('date', 'status', 'workingHours').optional(),
  sortOrder: Joi.string().valid('asc', 'desc').optional(),
});

const reportQuerySchema = Joi.object({
  employeeId: Joi.string().uuid().optional(),
  dateFrom: Joi.date().iso().optional(),
  dateTo: Joi.date().iso().optional(),
  department: Joi.string().optional(),
});

// Routes

/**
 * POST /api/attendance/checkin
 * Check in for the current user
 */
router.post(
  '/checkin',
  authenticate,
  checkResourcePermission('attendance', 'create'),
  validateRequest(checkInSchema),
  attendanceController.checkIn.bind(attendanceController)
);

/**
 * POST /api/attendance/checkout
 * Check out for the current user
 */
router.post(
  '/checkout',
  authenticate,
  checkResourcePermission('attendance', 'create'),
  validateRequest(checkOutSchema),
  attendanceController.checkOut.bind(attendanceController)
);

/**
 * GET /api/attendance
 * Get attendance records (with role-based filtering)
 */
router.get(
  '/',
  authenticate,
  checkResourcePermission('attendance', 'read'),
  validateRequest(attendanceQuerySchema, 'query'),
  attendanceController.getAttendance.bind(attendanceController)
);

/**
 * GET /api/attendance/status/:employeeId?
 * Get current attendance status
 */
router.get(
  '/status/:employeeId?',
  authenticate,
  checkResourcePermission('attendance', 'read'),
  attendanceController.getCurrentStatus.bind(attendanceController)
);

/**
 * GET /api/attendance/report
 * Get attendance report (Admin/HR only)
 */
router.get(
  '/report',
  authenticate,
  checkResourcePermission('attendance', 'read'),
  validateRequest(reportQuerySchema, 'query'),
  attendanceController.getAttendanceReport.bind(attendanceController)
);

export default router;
