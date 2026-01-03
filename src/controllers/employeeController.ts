import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { EmployeeService } from '../services/employeeService';
import {
  CreateEmployeeRequest,
  UpdateEmployeeRequest,
  EmployeeFilters,
  UserRole,
  PaginationOptions,
} from '../types';
import { logger } from '../utils/logger';
import { ResponseUtil } from '../utils/response';

/**
 * Validation schemas for employee endpoints
 */
export const employeeValidationSchemas = {
  createEmployee: Joi.object({
    firstName: Joi.string().required().trim().min(1).max(50),
    lastName: Joi.string().required().trim().min(1).max(50),
    email: Joi.string().email().required().trim().lowercase(),
    role: Joi.string().valid('employee', 'hr_officer', 'admin').optional(),
    personalDetails: Joi.object({
      phone: Joi.string()
        .optional()
        .trim()
        .pattern(/^[+]?[\d\s\-()]+$/)
        .max(20),
      address: Joi.string().optional().trim().max(500),
      dateOfBirth: Joi.date().optional().max('now'),
      emergencyContact: Joi.object({
        name: Joi.string().required().trim().min(1).max(100),
        relationship: Joi.string().required().trim().min(1).max(50),
        phone: Joi.string()
          .required()
          .trim()
          .pattern(/^[+]?[\d\s\-()]+$/)
          .max(20),
      }).optional(),
    }).required(),
    jobDetails: Joi.object({
      department: Joi.string().required().trim().min(1).max(100),
      position: Joi.string().required().trim().min(1).max(100),
      joiningDate: Joi.date().required().max('now'),
      reportingManager: Joi.string().optional().trim().max(100),
      workingSchedule: Joi.object({
        startTime: Joi.string()
          .required()
          .pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
        endTime: Joi.string()
          .required()
          .pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
        workingDays: Joi.array()
          .items(
            Joi.string().valid(
              'monday',
              'tuesday',
              'wednesday',
              'thursday',
              'friday',
              'saturday',
              'sunday'
            )
          )
          .min(1)
          .max(7)
          .required(),
        breakDuration: Joi.number().integer().min(0).max(480).required(), // max 8 hours
      }).required(),
    }).required(),
    salaryInfo: Joi.object({
      monthlyWage: Joi.number().positive().required().max(10000000), // max 1 crore
    }).required(),
  }),

  updateEmployee: Joi.object({
    firstName: Joi.string().optional().trim().min(1).max(50),
    lastName: Joi.string().optional().trim().min(1).max(50),
    email: Joi.string().email().optional().trim().lowercase(),
    role: Joi.string().valid('employee', 'hr_officer', 'admin').optional(),
    isActive: Joi.boolean().optional(),
    profilePicture: Joi.string().uri().optional().allow(''),
    personalDetails: Joi.object({
      phone: Joi.string()
        .optional()
        .trim()
        .pattern(/^[+]?[\d\s\-()]+$/)
        .max(20)
        .allow(''),
      address: Joi.string().optional().trim().max(500).allow(''),
      dateOfBirth: Joi.date().optional().max('now').allow(null),
      emergencyContact: Joi.object({
        name: Joi.string().required().trim().min(1).max(100),
        relationship: Joi.string().required().trim().min(1).max(50),
        phone: Joi.string()
          .required()
          .trim()
          .pattern(/^[+]?[\d\s\-()]+$/)
          .max(20),
      })
        .optional()
        .allow(null),
    }).optional(),
    jobDetails: Joi.object({
      department: Joi.string().optional().trim().min(1).max(100),
      position: Joi.string().optional().trim().min(1).max(100),
      joiningDate: Joi.date().optional().max('now'),
      reportingManager: Joi.string().optional().trim().max(100).allow(''),
      workingSchedule: Joi.object({
        startTime: Joi.string()
          .required()
          .pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
        endTime: Joi.string()
          .required()
          .pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
        workingDays: Joi.array()
          .items(
            Joi.string().valid(
              'monday',
              'tuesday',
              'wednesday',
              'thursday',
              'friday',
              'saturday',
              'sunday'
            )
          )
          .min(1)
          .max(7)
          .required(),
        breakDuration: Joi.number().integer().min(0).max(480).required(),
      }).optional(),
    }).optional(),
    salaryInfo: Joi.object({
      monthlyWage: Joi.number().positive().optional().max(10000000),
    }).optional(),
  }),

  employeeFilters: Joi.object({
    department: Joi.string().optional().trim(),
    position: Joi.string().optional().trim(),
    role: Joi.string().valid('employee', 'hr_officer', 'admin').optional(),
    isActive: Joi.boolean().optional(),
    joiningDateFrom: Joi.date().optional(),
    joiningDateTo: Joi.date().optional(),
    search: Joi.string().optional().trim().max(100),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    sortBy: Joi.string()
      .optional()
      .valid(
        'firstName',
        'lastName',
        'email',
        'department',
        'position',
        'joiningDate',
        'createdAt'
      ),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
  }),

  employeeId: Joi.object({
    id: Joi.string().required(),
  }),
};

export class EmployeeController {
  /**
   * Create a new employee
   * POST /api/employees
   */
  static async createEmployee(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const requestData: CreateEmployeeRequest = req.body;
      const requestingUser = req.user!;

      // Log the creation attempt
      logger.info('Employee creation attempt', {
        requestingUserId: requestingUser.userId,
        requestingUserRole: requestingUser.role,
        targetEmail: requestData.email,
      });

      // Create employee
      const result = await EmployeeService.createEmployee(requestData);

      // Log successful creation (without password)
      logger.info('Employee created successfully', {
        employeeId: result.employee.id,
        loginId: result.employee.loginId,
        email: result.employee.email,
        createdBy: requestingUser.userId,
      });

      // Return response with temporary password
      ResponseUtil.created(
        res,
        {
          employee: result.employee,
          temporaryPassword: result.temporaryPassword,
        },
        'Employee created successfully. Please share the temporary password securely.'
      );
    } catch (error) {
      logger.error('Error in createEmployee controller', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestingUserId: req.user?.userId,
      });
      next(error);
    }
  }

  /**
   * Get employee by ID
   * GET /api/employees/:id
   */
  static async getEmployee(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const requestingUser = req.user!;

      const employee = await EmployeeService.getEmployee(
        id,
        requestingUser.userId,
        requestingUser.role
      );

      if (!employee) {
        ResponseUtil.notFound(res, 'Employee not found', 'EMPLOYEE_NOT_FOUND');
        return;
      }

      ResponseUtil.success(res, employee);
    } catch (error) {
      logger.error('Error in getEmployee controller', {
        error: error instanceof Error ? error.message : 'Unknown error',
        employeeId: req.params.id,
        requestingUserId: req.user?.userId,
      });
      next(error);
    }
  }

  /**
   * Update employee
   * PUT /api/employees/:id
   */
  static async updateEmployee(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const updateData: UpdateEmployeeRequest = req.body;
      const requestingUser = req.user!;

      // Log the update attempt
      logger.info('Employee update attempt', {
        targetEmployeeId: id,
        requestingUserId: requestingUser.userId,
        requestingUserRole: requestingUser.role,
        updateFields: Object.keys(updateData),
      });

      const updatedEmployee = await EmployeeService.updateEmployee(
        id,
        updateData,
        requestingUser.userId,
        requestingUser.role
      );

      logger.info('Employee updated successfully', {
        employeeId: id,
        updatedBy: requestingUser.userId,
      });

      ResponseUtil.success(res, updatedEmployee);
    } catch (error) {
      logger.error('Error in updateEmployee controller', {
        error: error instanceof Error ? error.message : 'Unknown error',
        employeeId: req.params.id,
        requestingUserId: req.user?.userId,
      });
      next(error);
    }
  }

  /**
   * Get employees with filtering and pagination
   * GET /api/employees
   */
  static async getEmployees(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const requestingUser = req.user!;

      // Parse and validate query parameters
      const filters: EmployeeFilters = {
        department: req.query.department as string,
        position: req.query.position as string,
        role: req.query.role as UserRole,
        isActive: req.query.isActive
          ? req.query.isActive === 'true'
          : undefined,
        joiningDateFrom: req.query.joiningDateFrom
          ? new Date(req.query.joiningDateFrom as string)
          : undefined,
        joiningDateTo: req.query.joiningDateTo
          ? new Date(req.query.joiningDateTo as string)
          : undefined,
        search: req.query.search as string,
      };

      const pagination: PaginationOptions = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 10,
        sortBy: (req.query.sortBy as string) || 'createdAt',
        sortOrder: (req.query.sortOrder as 'asc' | 'desc') || 'desc',
      };

      const result = await EmployeeService.getEmployees(
        filters,
        pagination,
        requestingUser.role
      );

      ResponseUtil.success(res, result);
    } catch (error) {
      logger.error('Error in getEmployees controller', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestingUserId: req.user?.userId,
      });
      next(error);
    }
  }

  /**
   * Get current user's profile
   * GET /api/employees/me
   */
  static async getCurrentUserProfile(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const requestingUser = req.user!;

      const employee = await EmployeeService.getEmployee(
        requestingUser.userId,
        requestingUser.userId,
        requestingUser.role
      );

      if (!employee) {
        ResponseUtil.notFound(res, 'Profile not found', 'PROFILE_NOT_FOUND');
        return;
      }

      ResponseUtil.success(res, employee);
    } catch (error) {
      logger.error('Error in getCurrentUserProfile controller', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestingUserId: req.user?.userId,
      });
      next(error);
    }
  }

  /**
   * Update current user's profile
   * PUT /api/employees/me
   */
  static async updateCurrentUserProfile(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const updateData: UpdateEmployeeRequest = req.body;
      const requestingUser = req.user!;

      // Log the profile update attempt
      logger.info('Profile update attempt', {
        requestingUserId: requestingUser.userId,
        updateFields: Object.keys(updateData),
      });

      const updatedEmployee = await EmployeeService.updateEmployee(
        requestingUser.userId,
        updateData,
        requestingUser.userId,
        requestingUser.role
      );

      logger.info('Profile updated successfully', {
        employeeId: requestingUser.userId,
      });

      ResponseUtil.success(res, updatedEmployee);
    } catch (error) {
      logger.error('Error in updateCurrentUserProfile controller', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestingUserId: req.user?.userId,
      });
      next(error);
    }
  }
}
