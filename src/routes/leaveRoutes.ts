import { Router } from 'express';
import {
  LeaveController,
  leaveValidationSchemas,
} from '../controllers/leaveController';
import { authenticate, authorize } from '../middleware/auth';
import {
  validateRequest,
  sanitizeInput,
  validatePagination,
} from '../middleware/validation';
import { UserRole } from '../types';

const router = Router();

/**
 * Leave Management Routes
 */

// Apply authentication and input sanitization to all routes
router.use(authenticate);
router.use(sanitizeInput);

/**
 * GET /api/leaves/my-requests
 * Get current user's leave requests
 */
router.get(
  '/my-requests',
  validatePagination,
  validateRequest({
    query: leaveValidationSchemas.leaveFilters,
  }),
  LeaveController.getMyLeaveRequests
);

/**
 * GET /api/leaves/my-balance
 * Get current user's leave balance
 */
router.get(
  '/my-balance',
  validateRequest({
    query: leaveValidationSchemas.leaveBalance,
  }),
  LeaveController.getMyLeaveBalance
);

/**
 * GET /api/leaves/balance/:employeeId
 * Get leave balance for specific employee (HR/Admin only)
 */
router.get(
  '/balance/:employeeId',
  authorize([UserRole.HR_OFFICER, UserRole.ADMIN]),
  validateRequest({
    query: leaveValidationSchemas.leaveBalance,
  }),
  LeaveController.getLeaveBalance
);

/**
 * GET /api/leaves/balance
 * Get current user's leave balance (alternative endpoint)
 */
router.get(
  '/balance',
  validateRequest({
    query: leaveValidationSchemas.leaveBalance,
  }),
  LeaveController.getMyLeaveBalance
);

/**
 * GET /api/leaves
 * Get leave requests with filtering and pagination
 * Employees see only their own requests, HR/Admin see all
 */
router.get(
  '/',
  validatePagination,
  validateRequest({
    query: leaveValidationSchemas.leaveFilters,
  }),
  LeaveController.getLeaveRequests
);

/**
 * POST /api/leaves
 * Apply for leave
 */
router.post(
  '/',
  validateRequest({
    body: leaveValidationSchemas.createLeaveRequest,
  }),
  LeaveController.applyLeave
);

/**
 * GET /api/leaves/:id
 * Get leave request by ID
 * Access control handled in controller
 */
router.get(
  '/:id',
  validateRequest({
    params: leaveValidationSchemas.leaveId,
  }),
  LeaveController.getLeaveRequest
);

/**
 * PUT /api/leaves/:id/approve
 * Approve leave request
 * Requires HR_OFFICER or ADMIN role
 */
router.put(
  '/:id/approve',
  authorize([UserRole.HR_OFFICER, UserRole.ADMIN]),
  validateRequest({
    params: leaveValidationSchemas.leaveId,
    body: leaveValidationSchemas.updateLeaveStatus,
  }),
  LeaveController.approveLeave
);

/**
 * PUT /api/leaves/:id/reject
 * Reject leave request
 * Requires HR_OFFICER or ADMIN role
 */
router.put(
  '/:id/reject',
  authorize([UserRole.HR_OFFICER, UserRole.ADMIN]),
  validateRequest({
    params: leaveValidationSchemas.leaveId,
    body: leaveValidationSchemas.updateLeaveStatus,
  }),
  LeaveController.rejectLeave
);

/**
 * DELETE /api/leaves/:id
 * Cancel leave request (employees can cancel their own pending requests)
 */
router.delete(
  '/:id',
  validateRequest({
    params: leaveValidationSchemas.leaveId,
  }),
  LeaveController.cancelLeaveRequest
);

export default router;
