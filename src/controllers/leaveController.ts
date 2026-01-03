import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { LeaveService } from '../services/leaveService';
import {
  CreateLeaveRequest,
  LeaveFilters,
  LeaveType,
  LeaveStatus,
  PaginationOptions,
  UserRole,
} from '../types';
import { logger } from '../utils/logger';
import { ResponseUtil } from '../utils/response';

/**
 * Validation schemas for leave endpoints
 */
export const leaveValidationSchemas = {
  createLeaveRequest: Joi.object({
    type: Joi.string()
      .valid('PAID', 'SICK', 'UNPAID', 'CASUAL', 'MATERNITY', 'PATERNITY')
      .required(),
    startDate: Joi.date().required().min('now'),
    endDate: Joi.date().required().min(Joi.ref('startDate')),
    reason: Joi.string().required().trim().min(5).max(500),
    halfDay: Joi.boolean().optional().default(false),
  }),

  updateLeaveStatus: Joi.object({
    status: Joi.string().valid('APPROVED', 'REJECTED').required(),
    comments: Joi.string().optional().trim().max(500),
  }),

  leaveFilters: Joi.object({
    employeeId: Joi.string().optional(),
    type: Joi.string()
      .valid('PAID', 'SICK', 'UNPAID', 'CASUAL', 'MATERNITY', 'PATERNITY')
      .optional(),
    status: Joi.string().valid('PENDING', 'APPROVED', 'REJECTED').optional(),
    startDate: Joi.date().optional(),
    endDate: Joi.date().optional(),
    appliedDateFrom: Joi.date().optional(),
    appliedDateTo: Joi.date().optional(),
    approvedBy: Joi.string().optional(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    sortBy: Joi.string()
      .optional()
      .valid('appliedDate', 'startDate', 'endDate', 'status', 'type'),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
  }),

  leaveId: Joi.object({
    id: Joi.string().required(),
  }),

  leaveBalance: Joi.object({
    year: Joi.number()
      .integer()
      .min(2020)
      .max(new Date().getFullYear() + 1)
      .default(new Date().getFullYear()),
  }),
};

export class LeaveController {
  /**
   * Apply for leave
   * POST /api/leaves
   */
  static async applyLeave(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const requestData: CreateLeaveRequest = req.body;
      const requestingUser = req.user!;

      // Log the leave application attempt
      logger.info('Leave application attempt', {
        employeeId: requestingUser.userId,
        type: requestData.type,
        startDate: requestData.startDate,
        endDate: requestData.endDate,
      });

      // Apply for leave
      const leaveRequest = await LeaveService.applyLeave(
        requestingUser.userId,
        requestData
      );

      logger.info('Leave request created successfully', {
        leaveRequestId: leaveRequest.id,
        employeeId: requestingUser.userId,
        type: requestData.type,
      });

      ResponseUtil.created(
        res,
        leaveRequest,
        'Leave request submitted successfully'
      );
    } catch (error) {
      logger.error('Error in applyLeave controller', {
        error: error instanceof Error ? error.message : 'Unknown error',
        employeeId: req.user?.userId,
      });
      next(error);
    }
  }

  /**
   * Get leave requests with filtering and pagination
   * GET /api/leaves
   */
  static async getLeaveRequests(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const requestingUser = req.user!;

      // Parse and validate query parameters
      const filters: LeaveFilters = {
        type: req.query.type as LeaveType,
        status: req.query.status as LeaveStatus,
        startDate: req.query.startDate
          ? new Date(req.query.startDate as string)
          : undefined,
        endDate: req.query.endDate
          ? new Date(req.query.endDate as string)
          : undefined,
        appliedDateFrom: req.query.appliedDateFrom
          ? new Date(req.query.appliedDateFrom as string)
          : undefined,
        appliedDateTo: req.query.appliedDateTo
          ? new Date(req.query.appliedDateTo as string)
          : undefined,
        approvedBy: req.query.approvedBy as string,
      };

      // Role-based filtering: employees can only see their own requests
      if (requestingUser.role === UserRole.EMPLOYEE) {
        filters.employeeId = requestingUser.userId;
      } else if (req.query.employeeId) {
        // HR officers and admins can filter by specific employee
        filters.employeeId = req.query.employeeId as string;
      }

      const pagination: PaginationOptions = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 10,
        sortBy: (req.query.sortBy as string) || 'appliedDate',
        sortOrder: (req.query.sortOrder as 'asc' | 'desc') || 'desc',
      };

      const result = await LeaveService.getLeaveRequests(filters, pagination);

      ResponseUtil.success(res, result);
    } catch (error) {
      logger.error('Error in getLeaveRequests controller', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestingUserId: req.user?.userId,
      });
      next(error);
    }
  }

  /**
   * Get leave request by ID
   * GET /api/leaves/:id
   */
  static async getLeaveRequest(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const requestingUser = req.user!;

      const leaveRequest = await LeaveService.getLeaveRequestById(id);

      if (!leaveRequest) {
        ResponseUtil.notFound(
          res,
          'Leave request not found',
          'LEAVE_REQUEST_NOT_FOUND'
        );
        return;
      }

      // Check authorization: employees can only view their own requests
      if (
        requestingUser.role === UserRole.EMPLOYEE &&
        leaveRequest.employeeId !== requestingUser.userId
      ) {
        ResponseUtil.forbidden(
          res,
          'Access denied to this leave request',
          'LEAVE_REQUEST_ACCESS_DENIED'
        );
        return;
      }

      ResponseUtil.success(res, leaveRequest);
    } catch (error) {
      logger.error('Error in getLeaveRequest controller', {
        error: error instanceof Error ? error.message : 'Unknown error',
        leaveRequestId: req.params.id,
        requestingUserId: req.user?.userId,
      });
      next(error);
    }
  }

  /**
   * Approve leave request
   * PUT /api/leaves/:id/approve
   */
  static async approveLeave(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const { comments } = req.body;
      const requestingUser = req.user!;

      // Check authorization: only HR officers and admins can approve
      if (!['HR_OFFICER', 'ADMIN'].includes(requestingUser.role)) {
        ResponseUtil.forbidden(
          res,
          'Insufficient permissions to approve leave',
          'LEAVE_APPROVAL_PERMISSION_DENIED'
        );
        return;
      }

      logger.info('Leave approval attempt', {
        leaveRequestId: id,
        approverId: requestingUser.userId,
        approverRole: requestingUser.role,
      });

      const updatedLeave = await LeaveService.approveLeave(
        id,
        requestingUser.userId,
        comments
      );

      logger.info('Leave request approved successfully', {
        leaveRequestId: id,
        approverId: requestingUser.userId,
        employeeId: updatedLeave.employeeId,
      });

      ResponseUtil.success(
        res,
        updatedLeave,
        'Leave request approved successfully'
      );
    } catch (error) {
      logger.error('Error in approveLeave controller', {
        error: error instanceof Error ? error.message : 'Unknown error',
        leaveRequestId: req.params.id,
        approverId: req.user?.userId,
      });
      next(error);
    }
  }

  /**
   * Reject leave request
   * PUT /api/leaves/:id/reject
   */
  static async rejectLeave(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const { comments } = req.body;
      const requestingUser = req.user!;

      // Check authorization: only HR officers and admins can reject
      if (!['HR_OFFICER', 'ADMIN'].includes(requestingUser.role)) {
        ResponseUtil.forbidden(
          res,
          'Insufficient permissions to reject leave',
          'LEAVE_REJECTION_PERMISSION_DENIED'
        );
        return;
      }

      // Comments are required for rejection
      if (!comments || comments.trim().length === 0) {
        ResponseUtil.badRequest(
          res,
          'Comments are required when rejecting leave',
          'REJECTION_COMMENTS_REQUIRED'
        );
        return;
      }

      logger.info('Leave rejection attempt', {
        leaveRequestId: id,
        approverId: requestingUser.userId,
        approverRole: requestingUser.role,
      });

      const updatedLeave = await LeaveService.rejectLeave(
        id,
        requestingUser.userId,
        comments.trim()
      );

      logger.info('Leave request rejected successfully', {
        leaveRequestId: id,
        approverId: requestingUser.userId,
        employeeId: updatedLeave.employeeId,
      });

      ResponseUtil.success(
        res,
        updatedLeave,
        'Leave request rejected successfully'
      );
    } catch (error) {
      logger.error('Error in rejectLeave controller', {
        error: error instanceof Error ? error.message : 'Unknown error',
        leaveRequestId: req.params.id,
        approverId: req.user?.userId,
      });
      next(error);
    }
  }

  /**
   * Cancel leave request (for employees to cancel their own pending requests)
   * DELETE /api/leaves/:id
   */
  static async cancelLeaveRequest(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const requestingUser = req.user!;

      logger.info('Leave cancellation attempt', {
        leaveRequestId: id,
        employeeId: requestingUser.userId,
      });

      const cancelledLeave = await LeaveService.cancelLeaveRequest(
        id,
        requestingUser.userId
      );

      logger.info('Leave request cancelled successfully', {
        leaveRequestId: id,
        employeeId: requestingUser.userId,
      });

      ResponseUtil.success(
        res,
        cancelledLeave,
        'Leave request cancelled successfully'
      );
    } catch (error) {
      logger.error('Error in cancelLeaveRequest controller', {
        error: error instanceof Error ? error.message : 'Unknown error',
        leaveRequestId: req.params.id,
        employeeId: req.user?.userId,
      });
      next(error);
    }
  }

  /**
   * Get leave balance for an employee
   * GET /api/leaves/balance
   * GET /api/leaves/balance/:employeeId (for HR/Admin)
   */
  static async getLeaveBalance(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const requestingUser = req.user!;
      const targetEmployeeId = req.params.employeeId || requestingUser.userId;
      const year =
        parseInt(req.query.year as string) || new Date().getFullYear();

      // Check authorization: employees can only view their own balance
      if (
        requestingUser.role === UserRole.EMPLOYEE &&
        targetEmployeeId !== requestingUser.userId
      ) {
        ResponseUtil.forbidden(
          res,
          'Access denied to this employee leave balance',
          'LEAVE_BALANCE_ACCESS_DENIED'
        );
        return;
      }

      const leaveBalance = await LeaveService.getLeaveBalance(
        targetEmployeeId,
        year
      );

      ResponseUtil.success(res, leaveBalance);
    } catch (error) {
      logger.error('Error in getLeaveBalance controller', {
        error: error instanceof Error ? error.message : 'Unknown error',
        targetEmployeeId: req.params.employeeId || req.user?.userId,
        requestingUserId: req.user?.userId,
      });
      next(error);
    }
  }

  /**
   * Get my leave requests (convenience endpoint for employees)
   * GET /api/leaves/my-requests
   */
  static async getMyLeaveRequests(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const requestingUser = req.user!;

      // Parse query parameters
      const filters: LeaveFilters = {
        employeeId: requestingUser.userId, // Always filter by current user
        type: req.query.type as LeaveType,
        status: req.query.status as LeaveStatus,
        startDate: req.query.startDate
          ? new Date(req.query.startDate as string)
          : undefined,
        endDate: req.query.endDate
          ? new Date(req.query.endDate as string)
          : undefined,
      };

      const pagination: PaginationOptions = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 10,
        sortBy: (req.query.sortBy as string) || 'appliedDate',
        sortOrder: (req.query.sortOrder as 'asc' | 'desc') || 'desc',
      };

      const result = await LeaveService.getLeaveRequests(filters, pagination);

      ResponseUtil.success(res, result);
    } catch (error) {
      logger.error('Error in getMyLeaveRequests controller', {
        error: error instanceof Error ? error.message : 'Unknown error',
        employeeId: req.user?.userId,
      });
      next(error);
    }
  }

  /**
   * Get my leave balance (convenience endpoint for employees)
   * GET /api/leaves/my-balance
   */
  static async getMyLeaveBalance(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const requestingUser = req.user!;
      const year =
        parseInt(req.query.year as string) || new Date().getFullYear();

      const leaveBalance = await LeaveService.getLeaveBalance(
        requestingUser.userId,
        year
      );

      ResponseUtil.success(res, leaveBalance);
    } catch (error) {
      logger.error('Error in getMyLeaveBalance controller', {
        error: error instanceof Error ? error.message : 'Unknown error',
        employeeId: req.user?.userId,
      });
      next(error);
    }
  }
}
