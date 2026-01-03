import { Request, Response, NextFunction } from 'express';
import { attendanceService } from '../services/attendanceService';
import {
  AttendanceFilters,
  CheckInRequest,
  CheckOutRequest,
  PaginationOptions,
  UserRole,
} from '../types';
import { logger } from '../utils/logger';
import { formatSuccessResponse, formatErrorResponse } from '../utils/response';

export class AttendanceController {
  /**
   * Check in an employee
   */
  async checkIn(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user?.userId;
      const { remarks } = req.body as CheckInRequest;

      if (!userId) {
        res
          .status(401)
          .json(formatErrorResponse('Unauthorized', 'AUTH_REQUIRED'));
        return;
      }

      const attendanceRecord = await attendanceService.checkIn(userId, {
        remarks,
      });

      res
        .status(200)
        .json(
          formatSuccessResponse(attendanceRecord, 'Successfully checked in')
        );
    } catch (error: any) {
      logger.error('Check-in error:', error);

      if (error.message.includes('already checked in')) {
        res
          .status(400)
          .json(formatErrorResponse(error.message, 'ALREADY_CHECKED_IN'));
        return;
      }

      if (error.message.includes('not found')) {
        res
          .status(404)
          .json(formatErrorResponse(error.message, 'EMPLOYEE_NOT_FOUND'));
        return;
      }

      next(error);
    }
  }

  /**
   * Check out an employee
   */
  async checkOut(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user?.userId;
      const { remarks } = req.body as CheckOutRequest;

      if (!userId) {
        res
          .status(401)
          .json(formatErrorResponse('Unauthorized', 'AUTH_REQUIRED'));
        return;
      }

      const attendanceRecord = await attendanceService.checkOut(userId, {
        remarks,
      });

      res
        .status(200)
        .json(
          formatSuccessResponse(attendanceRecord, 'Successfully checked out')
        );
    } catch (error: any) {
      logger.error('Check-out error:', error);

      if (error.message.includes('No check-in record')) {
        res
          .status(400)
          .json(formatErrorResponse(error.message, 'NO_CHECKIN_RECORD'));
        return;
      }

      if (error.message.includes('not checked in')) {
        res
          .status(400)
          .json(formatErrorResponse(error.message, 'NOT_CHECKED_IN'));
        return;
      }

      if (error.message.includes('already checked out')) {
        res
          .status(400)
          .json(formatErrorResponse(error.message, 'ALREADY_CHECKED_OUT'));
        return;
      }

      next(error);
    }
  }

  /**
   * Get attendance records
   */
  async getAttendance(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user?.userId;
      const userRole = req.user?.role;

      if (!userId || !userRole) {
        res
          .status(401)
          .json(formatErrorResponse('Unauthorized', 'AUTH_REQUIRED'));
        return;
      }

      // Parse query parameters
      const {
        employeeId,
        dateFrom,
        dateTo,
        status,
        department,
        page = '1',
        limit = '10',
        sortBy = 'date',
        sortOrder = 'desc',
      } = req.query;

      // Build filters based on user role
      const filters: AttendanceFilters = {};

      // Role-based access control
      if (userRole === UserRole.EMPLOYEE) {
        // Employees can only see their own records
        filters.employeeId = userId;
      } else if (
        userRole === UserRole.HR_OFFICER ||
        userRole === UserRole.ADMIN
      ) {
        // HR Officers and Admins can see all records or filter by employee
        if (employeeId && typeof employeeId === 'string') {
          filters.employeeId = employeeId;
        }
      }

      // Apply other filters
      if (dateFrom && typeof dateFrom === 'string') {
        filters.dateFrom = new Date(dateFrom);
      }
      if (dateTo && typeof dateTo === 'string') {
        filters.dateTo = new Date(dateTo);
      }
      if (status && typeof status === 'string') {
        filters.status = status as any;
      }
      if (
        department &&
        typeof department === 'string' &&
        userRole !== UserRole.EMPLOYEE
      ) {
        filters.department = department;
      }

      const pagination: PaginationOptions = {
        page: parseInt(page as string, 10),
        limit: parseInt(limit as string, 10),
        sortBy: sortBy as string,
        sortOrder: sortOrder as 'asc' | 'desc',
      };

      const result = await attendanceService.getAttendance(filters, pagination);

      res
        .status(200)
        .json(
          formatSuccessResponse(
            result.data,
            'Attendance records retrieved successfully',
            result.pagination
          )
        );
    } catch (error: any) {
      logger.error('Get attendance error:', error);
      next(error);
    }
  }

  /**
   * Get current attendance status
   */
  async getCurrentStatus(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user?.userId;
      const userRole = req.user?.role;
      const { employeeId } = req.params;

      if (!userId || !userRole) {
        res
          .status(401)
          .json(formatErrorResponse('Unauthorized', 'AUTH_REQUIRED'));
        return;
      }

      // Determine which employee's status to get
      let targetEmployeeId = userId;

      if (employeeId) {
        // Check if user has permission to view other employee's status
        if (userRole === UserRole.EMPLOYEE && employeeId !== userId) {
          res
            .status(403)
            .json(
              formatErrorResponse(
                'Forbidden: Cannot view other employee status',
                'FORBIDDEN'
              )
            );
          return;
        }
        targetEmployeeId = employeeId;
      }

      const currentStatus =
        await attendanceService.getCurrentStatus(targetEmployeeId);

      res
        .status(200)
        .json(
          formatSuccessResponse(
            currentStatus,
            'Current attendance status retrieved successfully'
          )
        );
    } catch (error: any) {
      logger.error('Get current status error:', error);
      next(error);
    }
  }

  /**
   * Get attendance report (Admin/HR only)
   */
  async getAttendanceReport(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userRole = req.user?.role;

      if (
        !userRole ||
        (userRole !== UserRole.ADMIN && userRole !== UserRole.HR_OFFICER)
      ) {
        res
          .status(403)
          .json(
            formatErrorResponse(
              'Forbidden: Insufficient permissions',
              'FORBIDDEN'
            )
          );
        return;
      }

      // Parse query parameters
      const { employeeId, dateFrom, dateTo, department } = req.query;

      const filters: AttendanceFilters = {};

      if (employeeId && typeof employeeId === 'string') {
        filters.employeeId = employeeId;
      }
      if (dateFrom && typeof dateFrom === 'string') {
        filters.dateFrom = new Date(dateFrom);
      }
      if (dateTo && typeof dateTo === 'string') {
        filters.dateTo = new Date(dateTo);
      }
      if (department && typeof department === 'string') {
        filters.department = department;
      }

      const report = await attendanceService.getAttendanceReport(filters);

      res
        .status(200)
        .json(
          formatSuccessResponse(
            report,
            'Attendance report generated successfully'
          )
        );
    } catch (error: any) {
      logger.error('Get attendance report error:', error);
      next(error);
    }
  }
}

export const attendanceController = new AttendanceController();
