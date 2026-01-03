import { ComponentType, ComputationType } from '@prisma/client';
import { prisma } from '../database/client';
import {
  SalaryCalculation,
  SalaryComponent,
  UpdateSalaryStructureRequest,
  Payslip,
  Allowance,
  Deduction,
} from '../types';
import { TransactionService } from './transactionService';
import { logger } from '../utils/logger';

// Type for the transaction client
type TransactionClient = Omit<
  import('@prisma/client').PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

// Internal type for salary component input using Prisma enums
interface SalaryComponentInput {
  name: ComponentType;
  displayName: string;
  computationType: ComputationType;
  value: number;
  isActive?: boolean;
}

export class SalaryService {
  /**
   * Calculate salary components based on monthly wage
   * According to requirements: Basic 50%, HRA 50% of Basic, etc.
   */
  static calculateSalaryComponents(
    monthlyWage: number
  ): SalaryComponentInput[] {
    const basic = monthlyWage * 0.5; // 50% of wage
    const hra = basic * 0.5; // 50% of basic
    const standardAllowance = 4167; // Fixed amount
    const performanceBonus = monthlyWage * 0.0833; // 8.33% of wage
    const lta = monthlyWage * 0.08333; // 8.333% of wage

    // Calculate fixed allowance as remainder
    const totalCalculatedAllowances =
      basic + hra + standardAllowance + performanceBonus + lta;
    const fixedAllowance = Math.max(0, monthlyWage - totalCalculatedAllowances);

    return [
      {
        name: ComponentType.BASIC,
        displayName: 'Basic Salary',
        computationType: ComputationType.PERCENTAGE_OF_WAGE,
        value: 50,
      },
      {
        name: ComponentType.HRA,
        displayName: 'House Rent Allowance',
        computationType: ComputationType.PERCENTAGE_OF_BASIC,
        value: 50,
      },
      {
        name: ComponentType.STANDARD_ALLOWANCE,
        displayName: 'Standard Allowance',
        computationType: ComputationType.FIXED_AMOUNT,
        value: 4167,
      },
      {
        name: ComponentType.PERFORMANCE_BONUS,
        displayName: 'Performance Bonus',
        computationType: ComputationType.PERCENTAGE_OF_WAGE,
        value: 8.33,
      },
      {
        name: ComponentType.LTA,
        displayName: 'Leave Travel Allowance',
        computationType: ComputationType.PERCENTAGE_OF_WAGE,
        value: 8.333,
      },
      {
        name: ComponentType.FIXED_ALLOWANCE,
        displayName: 'Fixed Allowance',
        computationType: ComputationType.FIXED_AMOUNT,
        value: fixedAllowance,
      },
    ];
  }

  /**
   * Calculate deductions based on basic salary
   * PF 12% of basic, Professional Tax ₹200
   */
  static calculateDeductions(_basicSalary: number): SalaryComponentInput[] {
    return [
      {
        name: ComponentType.PF_DEDUCTION,
        displayName: 'Provident Fund',
        computationType: ComputationType.PERCENTAGE_OF_BASIC,
        value: 12,
      },
      {
        name: ComponentType.PROFESSIONAL_TAX,
        displayName: 'Professional Tax',
        computationType: ComputationType.FIXED_AMOUNT,
        value: 200,
      },
    ];
  }

  /**
   * Calculate the actual amount for a salary component
   */
  static calculateComponentAmount(
    component: SalaryComponentInput,
    monthlyWage: number,
    basicSalary: number
  ): number {
    switch (component.computationType) {
      case ComputationType.FIXED_AMOUNT:
        return component.value;
      case ComputationType.PERCENTAGE_OF_WAGE:
        return (monthlyWage * component.value) / 100;
      case ComputationType.PERCENTAGE_OF_BASIC:
        return (basicSalary * component.value) / 100;
      default:
        return 0;
    }
  }

  /**
   * Validate that total salary components don't exceed wage
   */
  static validateSalaryStructure(
    monthlyWage: number,
    components: SalaryComponentInput[]
  ): boolean {
    const basicComponent = components.find(c => c.name === ComponentType.BASIC);
    if (!basicComponent) {
      throw new Error('Basic salary component is required');
    }

    const basicSalary = this.calculateComponentAmount(
      basicComponent,
      monthlyWage,
      0
    );

    let totalAllowances = 0;

    for (const component of components) {
      const amount = this.calculateComponentAmount(
        component,
        monthlyWage,
        basicSalary
      );

      if (!this.isDeduction(component.name)) {
        totalAllowances += amount;
      }
    }

    // Allowances should not exceed wage
    return totalAllowances <= monthlyWage;
  }

  /**
   * Check if a component type is a deduction
   */
  static isDeduction(componentType: ComponentType): boolean {
    const deductionTypes: ComponentType[] = [
      ComponentType.PF_DEDUCTION,
      ComponentType.PROFESSIONAL_TAX,
    ];
    return deductionTypes.includes(componentType);
  }

  /**
   * Generate complete salary structure for an employee within a transaction
   */
  static async generateSalaryStructureInTransaction(
    tx: TransactionClient,
    employeeId: string,
    monthlyWage: number
  ): Promise<void> {
    try {
      // Calculate allowance components
      const allowanceComponents = this.calculateSalaryComponents(monthlyWage);

      // Calculate basic salary for deductions
      const basicComponent = allowanceComponents.find(
        c => c.name === ComponentType.BASIC
      );
      const basicSalary = basicComponent
        ? this.calculateComponentAmount(basicComponent, monthlyWage, 0)
        : 0;

      // Calculate deduction components
      const deductionComponents = this.calculateDeductions(basicSalary);

      // Combine all components
      const allComponents = [...allowanceComponents, ...deductionComponents];

      // Validate structure
      if (!this.validateSalaryStructure(monthlyWage, allComponents)) {
        throw new Error(
          'Invalid salary structure: components exceed monthly wage'
        );
      }

      // Delete existing components for this employee
      await tx.salaryComponent.deleteMany({
        where: { employeeId },
      });

      // Create new components
      const componentsToCreate = allComponents.map(component => ({
        employeeId,
        name: component.name,
        displayName: component.displayName,
        computationType: component.computationType,
        value: component.value,
        calculatedAmount: this.calculateComponentAmount(
          component,
          monthlyWage,
          basicSalary
        ),
        isActive: component.isActive ?? true,
      }));

      await tx.salaryComponent.createMany({
        data: componentsToCreate,
      });

      logger.info(
        `Salary structure generated for employee ${employeeId} in transaction`,
        {
          employeeId,
          monthlyWage,
          componentsCount: allComponents.length,
        }
      );
    } catch (error) {
      logger.error('Error generating salary structure in transaction', {
        employeeId,
        monthlyWage,
        error,
      });
      throw error;
    }
  }

  /**
   * Generate complete salary structure for an employee
   */
  static async generateSalaryStructure(
    employeeId: string,
    monthlyWage: number
  ): Promise<void> {
    return TransactionService.executeTransaction(async tx => {
      await this.generateSalaryStructureInTransaction(
        tx,
        employeeId,
        monthlyWage
      );
    }, 'generateSalaryStructure');
  }

  /**
   * Get salary calculation for an employee
   */
  static async calculateSalary(employeeId: string): Promise<SalaryCalculation> {
    try {
      const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        include: { salaryComponents: true },
      });

      if (!employee) {
        throw new Error('Employee not found');
      }

      // If no salary components exist, generate them
      if (employee.salaryComponents.length === 0) {
        await this.generateSalaryStructure(
          employeeId,
          Number(employee.monthlyWage)
        );

        // Refetch employee with components
        const updatedEmployee = await prisma.employee.findUnique({
          where: { id: employeeId },
          include: { salaryComponents: true },
        });

        if (!updatedEmployee) {
          throw new Error('Employee not found after salary generation');
        }

        employee.salaryComponents = updatedEmployee.salaryComponents;
      }

      const allowances: Allowance[] = [];
      const deductions: Deduction[] = [];
      let basicSalary = 0;

      // Process each component
      for (const component of employee.salaryComponents.filter(
        c => c.isActive
      )) {
        const componentData = {
          name: component.name as ComponentType,
          displayName: component.displayName,
          amount: Number(component.calculatedAmount),
          computationType: component.computationType as ComputationType,
          value: Number(component.value),
        };

        if (component.name === ComponentType.BASIC) {
          basicSalary = Number(component.calculatedAmount);
        }

        if (this.isDeduction(component.name as ComponentType)) {
          deductions.push(componentData);
        } else {
          allowances.push(componentData);
        }
      }

      const totalAllowances = allowances.reduce(
        (sum, allowance) => sum + allowance.amount,
        0
      );
      const totalDeductions = deductions.reduce(
        (sum, deduction) => sum + deduction.amount,
        0
      );
      const grossSalary = totalAllowances;
      const netSalary = grossSalary - totalDeductions;

      return {
        basicSalary,
        allowances,
        deductions,
        grossSalary,
        netSalary,
        totalAllowances,
        totalDeductions,
      };
    } catch (error) {
      logger.error('Error calculating salary', { employeeId, error });
      throw error;
    }
  }

  /**
   * Update salary structure for an employee
   */
  static async updateSalaryStructure(
    employeeId: string,
    updateData: UpdateSalaryStructureRequest
  ): Promise<SalaryComponent[]> {
    return TransactionService.executeTransaction(async tx => {
      const employee = await tx.employee.findUnique({
        where: { id: employeeId },
      });

      if (!employee) {
        throw new Error('Employee not found');
      }

      let monthlyWage = Number(employee.monthlyWage);

      // Update monthly wage if provided
      if (updateData.monthlyWage !== undefined) {
        monthlyWage = updateData.monthlyWage;

        await tx.employee.update({
          where: { id: employeeId },
          data: { monthlyWage: updateData.monthlyWage },
        });
      }

      // If components are provided, use them; otherwise regenerate default structure
      if (updateData.components) {
        // Validate the provided structure
        if (!this.validateSalaryStructure(monthlyWage, updateData.components)) {
          throw new Error(
            'Invalid salary structure: components exceed monthly wage'
          );
        }

        // Calculate basic salary for deductions
        const basicComponent = updateData.components.find(
          c => c.name === ComponentType.BASIC
        );
        const basicSalary = basicComponent
          ? this.calculateComponentAmount(basicComponent, monthlyWage, 0)
          : 0;

        // Delete existing components
        await tx.salaryComponent.deleteMany({
          where: { employeeId },
        });

        // Create new components with calculated amounts
        const componentsToCreate = updateData.components.map(component => ({
          employeeId,
          name: component.name,
          displayName: component.displayName,
          computationType: component.computationType,
          value: component.value,
          calculatedAmount: this.calculateComponentAmount(
            component,
            monthlyWage,
            basicSalary
          ),
          isActive: component.isActive ?? true,
        }));

        await tx.salaryComponent.createMany({
          data: componentsToCreate,
        });
      } else {
        // Regenerate default structure with new wage
        await this.generateSalaryStructureInTransaction(
          tx,
          employeeId,
          monthlyWage
        );
      }

      // Return updated components
      const updatedComponents = await tx.salaryComponent.findMany({
        where: { employeeId },
        orderBy: { name: 'asc' },
      });

      logger.info(`Salary structure updated for employee ${employeeId}`, {
        employeeId,
        monthlyWage,
        componentsCount: updatedComponents.length,
      });

      return updatedComponents.map((component: any) => ({
        id: component.id,
        employeeId: component.employeeId,
        name: component.name as ComponentType,
        displayName: component.displayName,
        computationType: component.computationType as ComputationType,
        value: Number(component.value),
        calculatedAmount: Number(component.calculatedAmount),
        isActive: component.isActive,
        createdAt: component.createdAt,
        updatedAt: component.updatedAt,
      }));
    }, 'updateSalaryStructure');
  }

  /**
   * Generate payslip for an employee for a specific month/year
   */
  static async generatePayslip(
    employeeId: string,
    month: number,
    year: number
  ): Promise<Payslip> {
    try {
      const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
      });

      if (!employee) {
        throw new Error('Employee not found');
      }

      const salaryCalculation = await this.calculateSalary(employeeId);

      return {
        employeeId: employee.id,
        employeeName: `${employee.firstName} ${employee.lastName}`,
        loginId: employee.loginId,
        department: employee.department,
        position: employee.position,
        month,
        year,
        monthlyWage: Number(employee.monthlyWage),
        salaryCalculation,
        generatedDate: new Date(),
      };
    } catch (error) {
      logger.error('Error generating payslip', {
        employeeId,
        month,
        year,
        error,
      });
      throw error;
    }
  }

  /**
   * Get all salary components for an employee
   */
  static async getSalaryComponents(
    employeeId: string
  ): Promise<SalaryComponent[]> {
    try {
      const components = await prisma.salaryComponent.findMany({
        where: { employeeId },
        orderBy: { name: 'asc' },
      });

      return components.map(component => ({
        id: component.id,
        employeeId: component.employeeId,
        name: component.name as ComponentType,
        displayName: component.displayName,
        computationType: component.computationType as ComputationType,
        value: Number(component.value),
        calculatedAmount: Number(component.calculatedAmount),
        isActive: component.isActive,
        createdAt: component.createdAt,
        updatedAt: component.updatedAt,
      }));
    } catch (error) {
      logger.error('Error getting salary components', { employeeId, error });
      throw error;
    }
  }

  /**
   * Recalculate all salary components when wage changes
   */
  static async recalculateComponents(employeeId: string): Promise<void> {
    return TransactionService.executeTransaction(async tx => {
      const employee = await tx.employee.findUnique({
        where: { id: employeeId },
        include: { salaryComponents: true },
      });

      if (!employee) {
        throw new Error('Employee not found');
      }

      const monthlyWage = Number(employee.monthlyWage);

      // Get basic salary for deduction calculations
      const basicComponent = employee.salaryComponents.find(
        c => c.name === ComponentType.BASIC
      );
      const basicSalary = basicComponent
        ? this.calculateComponentAmount(
            {
              name: basicComponent.name as ComponentType,
              displayName: basicComponent.displayName,
              computationType:
                basicComponent.computationType as ComputationType,
              value: Number(basicComponent.value),
            },
            monthlyWage,
            0
          )
        : 0;

      // Recalculate each component
      for (const component of employee.salaryComponents) {
        const componentInput: SalaryComponentInput = {
          name: component.name as ComponentType,
          displayName: component.displayName,
          computationType: component.computationType as ComputationType,
          value: Number(component.value),
        };

        const newAmount = this.calculateComponentAmount(
          componentInput,
          monthlyWage,
          basicSalary
        );

        await tx.salaryComponent.update({
          where: { id: component.id },
          data: { calculatedAmount: newAmount },
        });
      }

      logger.info(`Salary components recalculated for employee ${employeeId}`, {
        employeeId,
        monthlyWage,
        componentsCount: employee.salaryComponents.length,
      });
    }, 'recalculateComponents');
  }
}
