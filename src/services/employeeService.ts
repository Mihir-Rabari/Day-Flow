import { UserRole as PrismaUserRole } from '@prisma/client';
import { prisma } from '../database/client';
import {
  CreateEmployeeRequest,
  UpdateEmployeeRequest,
  EmployeeFilters,
  Employee,
  PaginatedResponse,
  PaginationOptions,
  UserRole,
} from '../types';
import { LoginIdService } from './loginIdService';
import { PasswordService } from './passwordService';
import { emailService } from './emailService';
import { SalaryService } from './salaryService';
import { PaginationService } from './paginationService';
import { TransactionService } from './transactionService';
import { logger } from '../utils/logger';

export class EmployeeService {
  /**
   * Creates a new employee with auto-generated Login ID and temporary password
   */
  static async createEmployee(data: CreateEmployeeRequest): Promise<{
    employee: Employee;
    temporaryPassword: string;
  }> {
    try {
      // Validate required fields
      this.validateCreateEmployeeData(data);

      // Generate unique Login ID
      const joiningYear = new Date(data.jobDetails.joiningDate).getFullYear();
      const loginId = await LoginIdService.generateUniqueLoginId(
        data.firstName,
        data.lastName,
        joiningYear
      );

      // Generate temporary password
      const temporaryPassword = PasswordService.generateTemporaryPassword();
      const passwordHash =
        await PasswordService.hashPassword(temporaryPassword);

      // Execute employee creation in a transaction to ensure data consistency
      const result = await TransactionService.executeTransaction(async tx => {
        // Create employee in database
        const employee = await tx.employee.create({
          data: {
            loginId,
            email: data.email.toLowerCase().trim(),
            passwordHash,
            firstName: data.firstName.trim(),
            lastName: data.lastName.trim(),
            role: this.mapUserRoleToPrisma(data.role || UserRole.EMPLOYEE),
            phone: data.personalDetails.phone?.trim(),
            address: data.personalDetails.address?.trim(),
            dateOfBirth: data.personalDetails.dateOfBirth,
            emergencyContact: data.personalDetails.emergencyContact,
            department: data.jobDetails.department.trim(),
            position: data.jobDetails.position.trim(),
            joiningDate: new Date(data.jobDetails.joiningDate),
            reportingManager: data.jobDetails.reportingManager?.trim(),
            workingSchedule: data.jobDetails.workingSchedule,
            monthlyWage: data.salaryInfo.monthlyWage,
          },
        });

        // Generate salary structure within the same transaction
        await SalaryService.generateSalaryStructureInTransaction(
          tx,
          employee.id,
          data.salaryInfo.monthlyWage
        );

        return employee;
      }, 'createEmployee');

      logger.info('Employee created successfully', {
        employeeId: result.id,
        loginId: result.loginId,
        email: result.email,
      });

      // Send welcome email asynchronously (outside transaction)
      try {
        await emailService.sendWelcomeEmail(
          result.email,
          `${result.firstName} ${result.lastName}`,
          result.loginId,
          temporaryPassword
        );
        logger.info('Welcome email sent successfully', {
          employeeId: result.id,
          email: result.email,
        });
      } catch (emailError) {
        // Log email error but don't fail employee creation
        logger.error('Failed to send welcome email', {
          employeeId: result.id,
          email: result.email,
          error:
            emailError instanceof Error ? emailError.message : 'Unknown error',
        });
      }

      return {
        employee: this.mapPrismaEmployeeToEmployee(result),
        temporaryPassword,
      };
    } catch (error) {
      logger.error('Error creating employee', {
        error: error instanceof Error ? error.message : 'Unknown error',
        email: data.email,
      });
      throw error;
    }
  }

  /**
   * Retrieves an employee by ID with role-based field access
   */
  static async getEmployee(
    employeeId: string,
    requestingUserId: string,
    requestingUserRole: UserRole
  ): Promise<Employee | null> {
    try {
      const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
      });

      if (!employee) {
        return null;
      }

      // Check access permissions
      if (
        !this.canAccessEmployee(
          employeeId,
          requestingUserId,
          requestingUserRole
        )
      ) {
        throw new Error('Insufficient permissions to access employee data');
      }

      const mappedEmployee = this.mapPrismaEmployeeToEmployee(employee);

      // Apply field-level access control
      return this.applyFieldAccessControl(
        mappedEmployee,
        requestingUserId,
        requestingUserRole
      );
    } catch (error) {
      logger.error('Error retrieving employee', {
        error: error instanceof Error ? error.message : 'Unknown error',
        employeeId,
        requestingUserId,
      });
      throw error;
    }
  }

  /**
   * Updates an employee with role-based field access permissions
   */
  static async updateEmployee(
    employeeId: string,
    data: UpdateEmployeeRequest,
    requestingUserId: string,
    requestingUserRole: UserRole
  ): Promise<Employee> {
    try {
      // Check if employee exists
      const existingEmployee = await prisma.employee.findUnique({
        where: { id: employeeId },
      });

      if (!existingEmployee) {
        throw new Error('Employee not found');
      }

      // Check access permissions
      if (
        !this.canUpdateEmployee(
          employeeId,
          requestingUserId,
          requestingUserRole
        )
      ) {
        throw new Error('Insufficient permissions to update employee data');
      }

      // Filter allowed fields based on role
      const allowedData = this.filterUpdateDataByRole(
        data,
        requestingUserId,
        requestingUserRole,
        employeeId
      );

      // Prepare update data
      const updateData: any = {};

      if (allowedData.firstName)
        updateData.firstName = allowedData.firstName.trim();
      if (allowedData.lastName)
        updateData.lastName = allowedData.lastName.trim();
      if (allowedData.email)
        updateData.email = allowedData.email.toLowerCase().trim();
      if (allowedData.role)
        updateData.role = this.mapUserRoleToPrisma(allowedData.role);
      if (allowedData.isActive !== undefined)
        updateData.isActive = allowedData.isActive;
      if (allowedData.profilePicture !== undefined)
        updateData.profilePicture = allowedData.profilePicture;

      // Personal details
      if (allowedData.personalDetails) {
        if (allowedData.personalDetails.phone !== undefined) {
          updateData.phone = allowedData.personalDetails.phone?.trim();
        }
        if (allowedData.personalDetails.address !== undefined) {
          updateData.address = allowedData.personalDetails.address?.trim();
        }
        if (allowedData.personalDetails.dateOfBirth !== undefined) {
          updateData.dateOfBirth = allowedData.personalDetails.dateOfBirth;
        }
        if (allowedData.personalDetails.emergencyContact !== undefined) {
          updateData.emergencyContact =
            allowedData.personalDetails.emergencyContact;
        }
      }

      // Job details
      if (allowedData.jobDetails) {
        if (allowedData.jobDetails.department) {
          updateData.department = allowedData.jobDetails.department.trim();
        }
        if (allowedData.jobDetails.position) {
          updateData.position = allowedData.jobDetails.position.trim();
        }
        if (allowedData.jobDetails.joiningDate) {
          updateData.joiningDate = new Date(allowedData.jobDetails.joiningDate);
        }
        if (allowedData.jobDetails.reportingManager !== undefined) {
          updateData.reportingManager =
            allowedData.jobDetails.reportingManager?.trim();
        }
        if (allowedData.jobDetails.workingSchedule) {
          updateData.workingSchedule = allowedData.jobDetails.workingSchedule;
        }
      }

      // Salary info
      if (allowedData.salaryInfo?.monthlyWage) {
        updateData.monthlyWage = allowedData.salaryInfo.monthlyWage;
      }

      // Update employee
      const updatedEmployee = await prisma.employee.update({
        where: { id: employeeId },
        data: updateData,
      });

      // Recalculate salary components if monthly wage was updated
      if (allowedData.salaryInfo?.monthlyWage) {
        try {
          await SalaryService.recalculateComponents(employeeId);
          logger.info('Salary components recalculated after wage update', {
            employeeId,
            newMonthlyWage: allowedData.salaryInfo.monthlyWage,
          });
        } catch (salaryError) {
          // Log salary error but don't fail employee update
          logger.error(
            'Failed to recalculate salary components after wage update',
            {
              employeeId,
              newMonthlyWage: allowedData.salaryInfo.monthlyWage,
              error:
                salaryError instanceof Error
                  ? salaryError.message
                  : 'Unknown error',
            }
          );
        }
      }

      logger.info('Employee updated successfully', {
        employeeId,
        updatedFields: Object.keys(updateData),
        updatedBy: requestingUserId,
      });

      return this.mapPrismaEmployeeToEmployee(updatedEmployee);
    } catch (error) {
      logger.error('Error updating employee', {
        error: error instanceof Error ? error.message : 'Unknown error',
        employeeId,
        requestingUserId,
      });
      throw error;
    }
  }

  /**
   * Retrieves employees with filtering and pagination
   */
  static async getEmployees(
    filters: EmployeeFilters,
    pagination: PaginationOptions,
    requestingUserRole: UserRole
  ): Promise<PaginatedResponse<Employee>> {
    try {
      // Check permissions - only HR and Admin can list all employees
      if (requestingUserRole === UserRole.EMPLOYEE) {
        throw new Error('Insufficient permissions to list employees');
      }

      // Build where clause
      const where: any = {};

      if (filters.department) {
        where.department = {
          contains: filters.department,
          mode: 'insensitive',
        };
      }

      if (filters.position) {
        where.position = { contains: filters.position, mode: 'insensitive' };
      }

      if (filters.role) {
        where.role = this.mapUserRoleToPrisma(filters.role);
      }

      if (filters.isActive !== undefined) {
        where.isActive = filters.isActive;
      }

      if (filters.joiningDateFrom || filters.joiningDateTo) {
        where.joiningDate = {};
        if (filters.joiningDateFrom) {
          where.joiningDate.gte = filters.joiningDateFrom;
        }
        if (filters.joiningDateTo) {
          where.joiningDate.lte = filters.joiningDateTo;
        }
      }

      if (filters.search) {
        where.OR = [
          { firstName: { contains: filters.search, mode: 'insensitive' } },
          { lastName: { contains: filters.search, mode: 'insensitive' } },
          { email: { contains: filters.search, mode: 'insensitive' } },
          { loginId: { contains: filters.search, mode: 'insensitive' } },
        ];
      }

      // Use enhanced pagination service for better performance
      const result = await PaginationService.paginate(
        prisma.employee,
        pagination,
        where
      );

      const mappedEmployees = result.data.map(emp =>
        this.mapPrismaEmployeeToEmployee(emp)
      );

      return {
        data: mappedEmployees,
        pagination: result.pagination,
      };
    } catch (error) {
      logger.error('Error retrieving employees', {
        error: error instanceof Error ? error.message : 'Unknown error',
        filters,
        pagination,
      });
      throw error;
    }
  }

  /**
   * Validates create employee data
   * Made public for testing
   */
  public static validateCreateEmployeeData(data: CreateEmployeeRequest): void {
    if (!data.firstName?.trim()) {
      throw new Error('First name is required');
    }

    if (!data.lastName?.trim()) {
      throw new Error('Last name is required');
    }

    if (!data.email?.trim()) {
      throw new Error('Email is required');
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email.trim())) {
      throw new Error('Invalid email format');
    }

    if (!data.jobDetails.department?.trim()) {
      throw new Error('Department is required');
    }

    if (!data.jobDetails.position?.trim()) {
      throw new Error('Position is required');
    }

    if (!data.jobDetails.joiningDate) {
      throw new Error('Joining date is required');
    }

    if (!data.salaryInfo.monthlyWage || data.salaryInfo.monthlyWage <= 0) {
      throw new Error('Valid monthly wage is required');
    }

    if (!data.jobDetails.workingSchedule) {
      throw new Error('Working schedule is required');
    }
  }

  /**
   * Checks if user can access employee data
   * Made public for testing
   */
  public static canAccessEmployee(
    employeeId: string,
    requestingUserId: string,
    requestingUserRole: UserRole
  ): boolean {
    // Admin and HR can access all employees
    if (
      requestingUserRole === UserRole.ADMIN ||
      requestingUserRole === UserRole.HR_OFFICER
    ) {
      return true;
    }

    // Employees can only access their own data
    return employeeId === requestingUserId;
  }

  /**
   * Checks if user can update employee data
   * Made public for testing
   */
  public static canUpdateEmployee(
    employeeId: string,
    requestingUserId: string,
    requestingUserRole: UserRole
  ): boolean {
    // Admin and HR can update all employees
    if (
      requestingUserRole === UserRole.ADMIN ||
      requestingUserRole === UserRole.HR_OFFICER
    ) {
      return true;
    }

    // Employees can only update their own limited fields
    return employeeId === requestingUserId;
  }

  /**
   * Filters update data based on user role and permissions
   * Made public for testing
   */
  public static filterUpdateDataByRole(
    data: UpdateEmployeeRequest,
    requestingUserId: string,
    requestingUserRole: UserRole,
    targetEmployeeId: string
  ): UpdateEmployeeRequest {
    const isOwnProfile = requestingUserId === targetEmployeeId;
    const isAdmin = requestingUserRole === UserRole.ADMIN;
    const isHR = requestingUserRole === UserRole.HR_OFFICER;

    // Admin can update everything
    if (isAdmin) {
      return data;
    }

    // HR can update most fields but not admin-specific ones
    if (isHR) {
      const filtered = { ...data };
      // HR cannot change role to ADMIN or change admin users
      if (data.role === UserRole.ADMIN) {
        delete filtered.role;
      }
      return filtered;
    }

    // Employees can only update limited fields on their own profile
    if (isOwnProfile) {
      return {
        personalDetails: {
          phone: data.personalDetails?.phone,
          address: data.personalDetails?.address,
          emergencyContact: data.personalDetails?.emergencyContact,
        },
        profilePicture: data.profilePicture,
      };
    }

    // No access
    return {};
  }

  /**
   * Applies field-level access control based on user role
   */
  private static applyFieldAccessControl(
    employee: Employee,
    requestingUserId: string,
    requestingUserRole: UserRole
  ): Employee {
    const isOwnProfile = requestingUserId === employee.id;
    const isAdmin = requestingUserRole === UserRole.ADMIN;
    const isHR = requestingUserRole === UserRole.HR_OFFICER;

    // Admin and HR can see all fields
    if (isAdmin || isHR) {
      return employee;
    }

    // Employees can only see their own full profile
    if (isOwnProfile) {
      return employee;
    }

    // Limited view for other employees
    return {
      ...employee,
      email: '', // Hide email
      phone: '', // Hide phone
      address: '', // Hide address
      dateOfBirth: undefined, // Hide DOB
      emergencyContact: undefined, // Hide emergency contact
      monthlyWage: 0, // Hide salary
    };
  }

  /**
   * Maps Prisma UserRole to application UserRole
   */
  private static mapPrismaUserRoleToUserRole(role: PrismaUserRole): UserRole {
    switch (role) {
      case PrismaUserRole.ADMIN:
        return UserRole.ADMIN;
      case PrismaUserRole.HR_OFFICER:
        return UserRole.HR_OFFICER;
      case PrismaUserRole.EMPLOYEE:
        return UserRole.EMPLOYEE;
      default:
        return UserRole.EMPLOYEE;
    }
  }

  /**
   * Maps application UserRole to Prisma UserRole
   */
  private static mapUserRoleToPrisma(role: UserRole): PrismaUserRole {
    switch (role) {
      case UserRole.ADMIN:
        return PrismaUserRole.ADMIN;
      case UserRole.HR_OFFICER:
        return PrismaUserRole.HR_OFFICER;
      case UserRole.EMPLOYEE:
        return PrismaUserRole.EMPLOYEE;
      default:
        return PrismaUserRole.EMPLOYEE;
    }
  }

  /**
   * Maps Prisma Employee to application Employee type
   */
  private static mapPrismaEmployeeToEmployee(prismaEmployee: any): Employee {
    return {
      id: prismaEmployee.id,
      loginId: prismaEmployee.loginId,
      email: prismaEmployee.email,
      firstName: prismaEmployee.firstName,
      lastName: prismaEmployee.lastName,
      role: this.mapPrismaUserRoleToUserRole(prismaEmployee.role),
      isActive: prismaEmployee.isActive,
      profilePicture: prismaEmployee.profilePicture,
      phone: prismaEmployee.phone,
      address: prismaEmployee.address,
      dateOfBirth: prismaEmployee.dateOfBirth,
      emergencyContact: prismaEmployee.emergencyContact,
      department: prismaEmployee.department,
      position: prismaEmployee.position,
      joiningDate: prismaEmployee.joiningDate,
      reportingManager: prismaEmployee.reportingManager,
      workingSchedule: prismaEmployee.workingSchedule,
      monthlyWage: Number(prismaEmployee.monthlyWage),
      createdAt: prismaEmployee.createdAt,
      updatedAt: prismaEmployee.updatedAt,
    };
  }
}
