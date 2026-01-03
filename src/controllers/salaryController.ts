import { Request, Response, NextFunction } from 'express';
import { SalaryService } from '../services/salaryService';
import { ApiResponse, UpdateSalaryStructureRequest, UserRole } from '../types';
import { logger } from '../utils/logger';
import Joi from 'joi';

// Validation schemas
const updateSalaryStructureSchema = Joi.object({
  monthlyWage: Joi.number().positive().optional(),
  components: Joi.array().items(
    Joi.object({
      name: Joi.string().valid(
        'BASIC',
        'HRA',
        'STANDARD_ALLOWANCE',
        'PERFORMANCE_BONUS',
        'LTA',
        'FIXED_ALLOWANCE',
        'PF_DEDUCTION',
        'PROFESSIONAL_TAX'
      ).required(),
      displayName: Joi.string().required(),
      computationType: Joi.string().valid(
        'FIXED_AMOUNT',
        'PERCENTAGE_OF_WAGE',
        'PERCENTAGE_OF_BASIC'
      ).required(),
      value: Joi.number().min(0).required(),
      isActive: Joi.boolean().optional(),
    })
  ).optional(),
});

const payslipParamsSchema = Joi.object({
  employeeId: Joi.string().required(),
  month: Joi.number().integer().min(1).max(12).required(),
  year: Joi.number().integer().min(2000).max(2100).required(),
});

export class SalaryController {
  /**
   * Get salary structure for an employee
   * GET /api/salary/structure/:employeeId
   */
  static async getSalaryStructure(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { employeeId } = req.params;
      const currentUser = req.user;

      if (!currentUser) {
        res.status(401).json({
          success: false,
          error: {
            code: 'AUTH_REQUIRED',
            message: 'Authentication required',
          },
        });
        return;
      }

      // Check permissions: employees can only view their own, admins/HR can view all
      if (
        currentUser.role === UserRole.EMPLOYEE &&
        currentUser.userId !== employeeId
      ) {
        res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN_INSUFFICIENT_PERMISSIONS',
            message: 'You can only view your own salary structure',
          },
        });
        return;
      }

      const salaryCalculation = await SalaryService.calculateSalary(employeeId);

      const response: ApiResponse = {
        success: true,
        data: salaryCalculation,
        message: 'Salary structure retrieved successfully',
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Error getting salary structure', { employeeId: req.params.employeeId, error });
      next(error);
    }
  }

  /**
   * Update salary structure for an employee
   * PUT /api/salary/structure/:employeeId
   */
  static async updateSalaryStructure(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { employeeId } = req.params;
      const currentUser = req.user;

      if (!currentUser) {
        res.status(401).json({
          success: false,
          error: {
            code: 'AUTH_REQUIRED',
            message: 'Authentication required',
          },
        });
        return;
      }

      // Only admins and HR officers can update salary structures
      if (![UserRole.ADMIN, UserRole.HR_OFFICER].includes(currentUser.role)) {
        res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN_INSUFFICIENT_PERMISSIONS',
            message: 'Only admins and HR officers can update salary structures',
          },
        });
        return;
      }

      // Validate request body
      const { error, value } = updateSalaryStructureSchema.validate(req.body);
      if (error) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid request data',
            details: error.details.map(detail => ({
              field: detail.path.join('.'),
              message: detail.message,
              code: detail.type,
            })),
          },
        });
        return;
      }

      const updateData: UpdateSalaryStructureRequest = value;
      const updatedComponents = await SalaryService.updateSalaryStructure(employeeId, updateData);

      const response: ApiResponse = {
        success: true,
        data: updatedComponents,
        message: 'Salary structure updated successfully',
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Error updating salary structure', { 
        employeeId: req.params.employeeId, 
        updateData: req.body, 
        error 
      });
      next(error);
    }
  }

  /**
   * Get salary components for an employee
   * GET /api/salary/components/:employeeId
   */
  static async getSalaryComponents(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { employeeId } = req.params;
      const currentUser = req.user;

      if (!currentUser) {
        res.status(401).json({
          success: false,
          error: {
            code: 'AUTH_REQUIRED',
            message: 'Authentication required',
          },
        });
        return;
      }

      // Check permissions: employees can only view their own, admins/HR can view all
      if (
        currentUser.role === UserRole.EMPLOYEE &&
        currentUser.userId !== employeeId
      ) {
        res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN_INSUFFICIENT_PERMISSIONS',
            message: 'You can only view your own salary components',
          },
        });
        return;
      }

      const components = await SalaryService.getSalaryComponents(employeeId);

      const response: ApiResponse = {
        success: true,
        data: components,
        message: 'Salary components retrieved successfully',
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Error getting salary components', { employeeId: req.params.employeeId, error });
      next(error);
    }
  }

  /**
   * Generate payslip for an employee
   * GET /api/salary/payslip/:employeeId/:month/:year
   */
  static async generatePayslip(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const currentUser = req.user;

      if (!currentUser) {
        res.status(401).json({
          success: false,
          error: {
            code: 'AUTH_REQUIRED',
            message: 'Authentication required',
          },
        });
        return;
      }

      // Validate parameters
      const { error, value } = payslipParamsSchema.validate(req.params);
      if (error) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid parameters',
            details: error.details.map(detail => ({
              field: detail.path.join('.'),
              message: detail.message,
              code: detail.type,
            })),
          },
        });
        return;
      }

      const { employeeId, month, year } = value;

      // Check permissions: employees can only view their own, admins/HR can view all
      if (
        currentUser.role === UserRole.EMPLOYEE &&
        currentUser.userId !== employeeId
      ) {
        res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN_INSUFFICIENT_PERMISSIONS',
            message: 'You can only view your own payslip',
          },
        });
        return;
      }

      const payslip = await SalaryService.generatePayslip(employeeId, parseInt(month), parseInt(year));

      const response: ApiResponse = {
        success: true,
        data: payslip,
        message: 'Payslip generated successfully',
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Error generating payslip', { 
        employeeId: req.params.employeeId, 
        month: req.params.month, 
        year: req.params.year, 
        error 
      });
      next(error);
    }
  }

  /**
   * Get current user's salary structure
   * GET /api/salary/me/structure
   */
  static async getMySalaryStructure(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const currentUser = req.user;

      if (!currentUser) {
        res.status(401).json({
          success: false,
          error: {
            code: 'AUTH_REQUIRED',
            message: 'Authentication required',
          },
        });
        return;
      }

      const salaryCalculation = await SalaryService.calculateSalary(currentUser.userId);

      const response: ApiResponse = {
        success: true,
        data: salaryCalculation,
        message: 'Your salary structure retrieved successfully',
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Error getting user salary structure', { userId: req.user?.userId, error });
      next(error);
    }
  }

  /**
   * Get current user's salary components
   * GET /api/salary/me/components
   */
  static async getMySalaryComponents(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const currentUser = req.user;

      if (!currentUser) {
        res.status(401).json({
          success: false,
          error: {
            code: 'AUTH_REQUIRED',
            message: 'Authentication required',
          },
        });
        return;
      }

      const components = await SalaryService.getSalaryComponents(currentUser.userId);

      const response: ApiResponse = {
        success: true,
        data: components,
        message: 'Your salary components retrieved successfully',
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Error getting user salary components', { userId: req.user?.userId, error });
      next(error);
    }
  }

  /**
   * Generate current user's payslip
   * GET /api/salary/me/payslip/:month/:year
   */
  static async getMyPayslip(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const currentUser = req.user;

      if (!currentUser) {
        res.status(401).json({
          success: false,
          error: {
            code: 'AUTH_REQUIRED',
            message: 'Authentication required',
          },
        });
        return;
      }

      // Validate parameters
      const monthYearSchema = Joi.object({
        month: Joi.number().integer().min(1).max(12).required(),
        year: Joi.number().integer().min(2000).max(2100).required(),
      });

      const { error, value } = monthYearSchema.validate(req.params);
      if (error) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid parameters',
            details: error.details.map(detail => ({
              field: detail.path.join('.'),
              message: detail.message,
              code: detail.type,
            })),
          },
        });
        return;
      }

      const { month, year } = value;
      const payslip = await SalaryService.generatePayslip(currentUser.userId, parseInt(month), parseInt(year));

      const response: ApiResponse = {
        success: true,
        data: payslip,
        message: 'Your payslip generated successfully',
      };

      res.status(200).json(response);
    } catch (error) {
      logger.error('Error generating user payslip', { 
        userId: req.user?.userId, 
        month: req.params.month, 
        year: req.params.year, 
        error 
      });
      next(error);
    }
  }
}