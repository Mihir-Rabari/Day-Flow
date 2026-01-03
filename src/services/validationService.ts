import Joi from 'joi';
import { Request, Response, NextFunction } from 'express';
import { ValidationError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

/**
 * Comprehensive validation schemas for all API endpoints
 */
export class ValidationService {
  // Common validation patterns
  private static readonly patterns = {
    email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
    phone: /^[+]?[1-9][\d]{0,15}$/,
    loginId: /^OI[A-Z]{2,4}\d{4}\d{4}$/,
    password:
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
    name: /^[a-zA-Z\s'-]{1,50}$/,
    alphanumeric: /^[a-zA-Z0-9\s]{1,100}$/,
    uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  };

  // Authentication schemas
  static readonly loginSchema = Joi.object({
    loginId: Joi.string().pattern(this.patterns.loginId).required().messages({
      'string.pattern.base': 'Invalid login ID format',
      'any.required': 'Login ID is required',
    }),
    password: Joi.string().min(8).max(128).required().messages({
      'string.min': 'Password must be at least 8 characters',
      'string.max': 'Password must not exceed 128 characters',
      'any.required': 'Password is required',
    }),
  });

  static readonly changePasswordSchema = Joi.object({
    currentPassword: Joi.string().min(8).max(128).required().messages({
      'string.min': 'Current password must be at least 8 characters',
      'any.required': 'Current password is required',
    }),
    newPassword: Joi.string()
      .pattern(this.patterns.password)
      .min(8)
      .max(128)
      .required()
      .messages({
        'string.pattern.base':
          'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
        'string.min': 'New password must be at least 8 characters',
        'string.max': 'New password must not exceed 128 characters',
        'any.required': 'New password is required',
      }),
  });

  static readonly forgotPasswordSchema = Joi.object({
    email: Joi.string().pattern(this.patterns.email).required().messages({
      'string.pattern.base': 'Invalid email format',
      'any.required': 'Email is required',
    }),
  });

  static readonly resetPasswordSchema = Joi.object({
    token: Joi.string().min(32).max(256).required().messages({
      'string.min': 'Invalid reset token',
      'any.required': 'Reset token is required',
    }),
    newPassword: Joi.string()
      .pattern(this.patterns.password)
      .min(8)
      .max(128)
      .required()
      .messages({
        'string.pattern.base':
          'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
        'any.required': 'New password is required',
      }),
  });

  // Employee schemas
  static readonly createEmployeeSchema = Joi.object({
    firstName: Joi.string()
      .pattern(this.patterns.name)
      .min(1)
      .max(50)
      .required()
      .messages({
        'string.pattern.base':
          'First name can only contain letters, spaces, hyphens, and apostrophes',
        'any.required': 'First name is required',
      }),
    lastName: Joi.string()
      .pattern(this.patterns.name)
      .min(1)
      .max(50)
      .required()
      .messages({
        'string.pattern.base':
          'Last name can only contain letters, spaces, hyphens, and apostrophes',
        'any.required': 'Last name is required',
      }),
    email: Joi.string().pattern(this.patterns.email).required().messages({
      'string.pattern.base': 'Invalid email format',
      'any.required': 'Email is required',
    }),
    phone: Joi.string()
      .pattern(this.patterns.phone)
      .optional()
      .allow('')
      .messages({
        'string.pattern.base': 'Invalid phone number format',
      }),
    address: Joi.string().max(500).optional().allow('').messages({
      'string.max': 'Address must not exceed 500 characters',
    }),
    dateOfBirth: Joi.date().max('now').optional().messages({
      'date.max': 'Date of birth cannot be in the future',
    }),
    department: Joi.string()
      .pattern(this.patterns.alphanumeric)
      .min(1)
      .max(100)
      .required()
      .messages({
        'string.pattern.base':
          'Department name can only contain letters, numbers, and spaces',
        'any.required': 'Department is required',
      }),
    position: Joi.string()
      .pattern(this.patterns.alphanumeric)
      .min(1)
      .max(100)
      .required()
      .messages({
        'string.pattern.base':
          'Position can only contain letters, numbers, and spaces',
        'any.required': 'Position is required',
      }),
    joiningDate: Joi.date().max('now').required().messages({
      'date.max': 'Joining date cannot be in the future',
      'any.required': 'Joining date is required',
    }),
    monthlyWage: Joi.number().positive().max(10000000).required().messages({
      'number.positive': 'Monthly wage must be positive',
      'number.max': 'Monthly wage cannot exceed 10,000,000',
      'any.required': 'Monthly wage is required',
    }),
    role: Joi.string()
      .valid('EMPLOYEE', 'HR_OFFICER', 'ADMIN')
      .default('EMPLOYEE')
      .messages({
        'any.only': 'Role must be EMPLOYEE, HR_OFFICER, or ADMIN',
      }),
  });

  static readonly updateEmployeeSchema = Joi.object({
    firstName: Joi.string()
      .pattern(this.patterns.name)
      .min(1)
      .max(50)
      .optional()
      .messages({
        'string.pattern.base':
          'First name can only contain letters, spaces, hyphens, and apostrophes',
      }),
    lastName: Joi.string()
      .pattern(this.patterns.name)
      .min(1)
      .max(50)
      .optional()
      .messages({
        'string.pattern.base':
          'Last name can only contain letters, spaces, hyphens, and apostrophes',
      }),
    phone: Joi.string()
      .pattern(this.patterns.phone)
      .optional()
      .allow('')
      .messages({
        'string.pattern.base': 'Invalid phone number format',
      }),
    address: Joi.string().max(500).optional().allow('').messages({
      'string.max': 'Address must not exceed 500 characters',
    }),
    department: Joi.string()
      .pattern(this.patterns.alphanumeric)
      .min(1)
      .max(100)
      .optional()
      .messages({
        'string.pattern.base':
          'Department name can only contain letters, numbers, and spaces',
      }),
    position: Joi.string()
      .pattern(this.patterns.alphanumeric)
      .min(1)
      .max(100)
      .optional()
      .messages({
        'string.pattern.base':
          'Position can only contain letters, numbers, and spaces',
      }),
    monthlyWage: Joi.number().positive().max(10000000).optional().messages({
      'number.positive': 'Monthly wage must be positive',
      'number.max': 'Monthly wage cannot exceed 10,000,000',
    }),
  });

  // Attendance schemas
  static readonly attendanceQuerySchema = Joi.object({
    startDate: Joi.date().optional().messages({
      'date.base': 'Start date must be a valid date',
    }),
    endDate: Joi.date().optional().min(Joi.ref('startDate')).messages({
      'date.base': 'End date must be a valid date',
      'date.min': 'End date must be after start date',
    }),
    employeeId: Joi.string().pattern(this.patterns.uuid).optional().messages({
      'string.pattern.base': 'Invalid employee ID format',
    }),
  });

  // Leave schemas
  static readonly createLeaveSchema = Joi.object({
    type: Joi.string()
      .valid('PAID', 'SICK', 'UNPAID', 'CASUAL', 'MATERNITY', 'PATERNITY')
      .required()
      .messages({
        'any.only':
          'Leave type must be one of: PAID, SICK, UNPAID, CASUAL, MATERNITY, PATERNITY',
        'any.required': 'Leave type is required',
      }),
    startDate: Joi.date().min('now').required().messages({
      'date.min': 'Start date cannot be in the past',
      'any.required': 'Start date is required',
    }),
    endDate: Joi.date().min(Joi.ref('startDate')).required().messages({
      'date.min': 'End date must be after or equal to start date',
      'any.required': 'End date is required',
    }),
    reason: Joi.string().min(10).max(500).required().messages({
      'string.min': 'Reason must be at least 10 characters',
      'string.max': 'Reason must not exceed 500 characters',
      'any.required': 'Reason is required',
    }),
  });

  static readonly updateLeaveStatusSchema = Joi.object({
    status: Joi.string().valid('APPROVED', 'REJECTED').required().messages({
      'any.only': 'Status must be APPROVED or REJECTED',
      'any.required': 'Status is required',
    }),
    comments: Joi.string().max(500).optional().allow('').messages({
      'string.max': 'Comments must not exceed 500 characters',
    }),
  });

  // Pagination schemas
  static readonly paginationSchema = Joi.object({
    page: Joi.number().integer().min(1).default(1).messages({
      'number.integer': 'Page must be an integer',
      'number.min': 'Page must be at least 1',
    }),
    limit: Joi.number().integer().min(1).max(100).default(10).messages({
      'number.integer': 'Limit must be an integer',
      'number.min': 'Limit must be at least 1',
      'number.max': 'Limit cannot exceed 100',
    }),
    sortBy: Joi.string()
      .valid(
        'createdAt',
        'updatedAt',
        'firstName',
        'lastName',
        'email',
        'department',
        'position',
        'joiningDate'
      )
      .default('createdAt')
      .messages({
        'any.only': 'Invalid sort field',
      }),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc').messages({
      'any.only': 'Sort order must be asc or desc',
    }),
  });

  // Salary schemas
  static readonly updateSalarySchema = Joi.object({
    monthlyWage: Joi.number().positive().max(10000000).required().messages({
      'number.positive': 'Monthly wage must be positive',
      'number.max': 'Monthly wage cannot exceed 10,000,000',
      'any.required': 'Monthly wage is required',
    }),
  });

  /**
   * Middleware factory for request validation
   */
  static validate(schema: Joi.ObjectSchema) {
    return (req: Request, res: Response, next: NextFunction): void => {
      const { error, value } = schema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true,
        convert: true,
      });

      if (error) {
        const validationErrors = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
          code: detail.type,
        }));

        logger.warn('Validation failed', {
          path: req.path,
          method: req.method,
          errors: validationErrors,
          ip: req.ip,
        });

        throw new ValidationError('Validation failed', validationErrors);
      }

      // Replace request body with validated and sanitized data
      req.body = value;
      next();
    };
  }

  /**
   * Middleware factory for query parameter validation
   */
  static validateQuery(schema: Joi.ObjectSchema) {
    return (req: Request, res: Response, next: NextFunction): void => {
      const { error, value } = schema.validate(req.query, {
        abortEarly: false,
        stripUnknown: true,
        convert: true,
      });

      if (error) {
        const validationErrors = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
          code: detail.type,
        }));

        logger.warn('Query validation failed', {
          path: req.path,
          method: req.method,
          errors: validationErrors,
          ip: req.ip,
        });

        throw new ValidationError('Query validation failed', validationErrors);
      }

      // Replace request query with validated and sanitized data
      req.query = value;
      next();
    };
  }

  /**
   * Sanitize string input to prevent XSS and injection attacks
   */
  static sanitizeString(input: string): string {
    if (typeof input !== 'string') {
      return '';
    }

    return input
      .replace(/[<>]/g, '') // Remove angle brackets
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+=/gi, '') // Remove event handlers
      .replace(/script/gi, '') // Remove script tags
      .trim();
  }

  /**
   * Validate and sanitize file uploads
   */
  static validateFileUpload(file: any): boolean {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif'];
    const maxSize = 5 * 1024 * 1024; // 5MB

    if (!file) {
      return false;
    }

    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new ValidationError(
        'Invalid file type. Only JPEG, PNG, and GIF are allowed.'
      );
    }

    if (file.size > maxSize) {
      throw new ValidationError('File size too large. Maximum size is 5MB.');
    }

    return true;
  }
}
