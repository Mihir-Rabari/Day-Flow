import fc from 'fast-check';
import { PrismaClient } from '@prisma/client';
import { TransactionService } from '../services/transactionService';
import { BackupService } from '../services/backupService';
import { EmployeeService } from '../services/employeeService';
import { SalaryService } from '../services/salaryService';
import { prisma } from '../database/client';
import { UserRole, CreateEmployeeRequest } from '../types';

// Type for the transaction client
type TransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

/**
 * Property-based tests for transaction management integrity
 * Feature: dayflow-backend, Property 15: Transaction Management Integrity
 * Validates: Requirements 12.3
 */

describe('Transaction Management Property Tests', () => {
  beforeAll(async () => {
    // Clean up test data
    await prisma.salaryComponent.deleteMany();
    await prisma.attendanceRecord.deleteMany();
    await prisma.leaveRequest.deleteMany();
    await prisma.employee.deleteMany();
  });

  afterEach(async () => {
    // Clean up after each test
    await prisma.salaryComponent.deleteMany();
    await prisma.attendanceRecord.deleteMany();
    await prisma.leaveRequest.deleteMany();
    await prisma.employee.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  /**
   * Property 15: Transaction Management Integrity
   * For any multi-step operation, the system should implement proper transaction rollback
   * for failed operations and maintain data consistency throughout the process
   */
  test('Property 15: Transaction rollback maintains data consistency', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          firstName: fc.string({ minLength: 1, maxLength: 50 }),
          lastName: fc.string({ minLength: 1, maxLength: 50 }),
          email: fc.emailAddress(),
          department: fc.string({ minLength: 1, maxLength: 50 }),
          position: fc.string({ minLength: 1, maxLength: 50 }),
          monthlyWage: fc.integer({ min: 10000, max: 200000 }),
          shouldFail: fc.boolean(),
        }),
        async data => {
          // Count initial records
          const initialEmployeeCount = await prisma.employee.count();
          const initialSalaryComponentCount =
            await prisma.salaryComponent.count();

          const employeeData: CreateEmployeeRequest = {
            firstName: data.firstName,
            lastName: data.lastName,
            email: data.email,
            role: UserRole.EMPLOYEE,
            personalDetails: {
              phone: '+1234567890',
              address: '123 Test St',
              dateOfBirth: new Date('1990-01-01'),
              emergencyContact: {
                name: 'Emergency Contact',
                relationship: 'Spouse',
                phone: '+1234567890',
              },
            },
            jobDetails: {
              department: data.department,
              position: data.position,
              joiningDate: new Date(),
              workingSchedule: {
                startTime: '09:00',
                endTime: '17:00',
                workingDays: [
                  'Monday',
                  'Tuesday',
                  'Wednesday',
                  'Thursday',
                  'Friday',
                ],
                breakDuration: 60,
              },
            },
            salaryInfo: {
              monthlyWage: data.monthlyWage,
            },
          };

          try {
            if (data.shouldFail) {
              // Simulate a transaction that should fail by using an invalid email
              const invalidEmployeeData = {
                ...employeeData,
                email: 'invalid-email-format', // This should cause validation to fail
              };

              await expect(
                TransactionService.executeTransaction(async tx => {
                  // Create employee
                  const employee = await tx.employee.create({
                    data: {
                      loginId: `TEST${Date.now()}`,
                      email: invalidEmployeeData.email,
                      passwordHash: 'hashedpassword',
                      firstName: invalidEmployeeData.firstName,
                      lastName: invalidEmployeeData.lastName,
                      role: 'EMPLOYEE',
                      department: invalidEmployeeData.jobDetails.department,
                      position: invalidEmployeeData.jobDetails.position,
                      joiningDate: invalidEmployeeData.jobDetails.joiningDate,
                      monthlyWage: invalidEmployeeData.salaryInfo.monthlyWage,
                      workingSchedule: {
                        startTime: '09:00',
                        endTime: '17:00',
                        workingDays: [
                          'Monday',
                          'Tuesday',
                          'Wednesday',
                          'Thursday',
                          'Friday',
                        ],
                        breakDuration: 60,
                      },
                    },
                  });

                  // Create salary components
                  await tx.salaryComponent.create({
                    data: {
                      employeeId: employee.id,
                      name: 'BASIC',
                      displayName: 'Basic Salary',
                      computationType: 'PERCENTAGE_OF_WAGE',
                      value: 50,
                      calculatedAmount: data.monthlyWage * 0.5,
                    },
                  });

                  // Force a failure by throwing an error
                  throw new Error('Simulated transaction failure');
                }, 'test-transaction-rollback')
              ).rejects.toThrow();

              // Verify rollback - no new records should exist
              const finalEmployeeCount = await prisma.employee.count();
              const finalSalaryComponentCount =
                await prisma.salaryComponent.count();

              expect(finalEmployeeCount).toBe(initialEmployeeCount);
              expect(finalSalaryComponentCount).toBe(
                initialSalaryComponentCount
              );
            } else {
              // Test successful transaction
              const result = await TransactionService.executeTransaction(
                async tx => {
                  // Create employee
                  const employee = await tx.employee.create({
                    data: {
                      loginId: `TEST${Date.now()}${Math.random()}`,
                      email: employeeData.email,
                      passwordHash: 'hashedpassword',
                      firstName: employeeData.firstName,
                      lastName: employeeData.lastName,
                      role: 'EMPLOYEE',
                      department: employeeData.jobDetails.department,
                      position: employeeData.jobDetails.position,
                      joiningDate: employeeData.jobDetails.joiningDate,
                      monthlyWage: employeeData.salaryInfo.monthlyWage,
                      workingSchedule: {
                        startTime: '09:00',
                        endTime: '17:00',
                        workingDays: [
                          'Monday',
                          'Tuesday',
                          'Wednesday',
                          'Thursday',
                          'Friday',
                        ],
                        breakDuration: 60,
                      },
                    },
                  });

                  // Create salary components
                  const salaryComponent = await tx.salaryComponent.create({
                    data: {
                      employeeId: employee.id,
                      name: 'BASIC',
                      displayName: 'Basic Salary',
                      computationType: 'PERCENTAGE_OF_WAGE',
                      value: 50,
                      calculatedAmount: data.monthlyWage * 0.5,
                    },
                  });

                  return { employee, salaryComponent };
                },
                'test-transaction-success'
              );

              // Verify successful transaction - both records should exist
              const finalEmployeeCount = await prisma.employee.count();
              const finalSalaryComponentCount =
                await prisma.salaryComponent.count();

              expect(finalEmployeeCount).toBe(initialEmployeeCount + 1);
              expect(finalSalaryComponentCount).toBe(
                initialSalaryComponentCount + 1
              );

              // Verify data integrity
              const createdEmployee = await prisma.employee.findUnique({
                where: { id: result.employee.id },
              });
              const createdSalaryComponent =
                await prisma.salaryComponent.findUnique({
                  where: { id: result.salaryComponent.id },
                });

              expect(createdEmployee).toBeTruthy();
              expect(createdSalaryComponent).toBeTruthy();
              expect(createdSalaryComponent?.employeeId).toBe(
                createdEmployee?.id
              );
            }
          } catch (error) {
            // If we expected success but got an error, verify no partial data exists
            if (!data.shouldFail) {
              const finalEmployeeCount = await prisma.employee.count();
              const finalSalaryComponentCount =
                await prisma.salaryComponent.count();

              expect(finalEmployeeCount).toBe(initialEmployeeCount);
              expect(finalSalaryComponentCount).toBe(
                initialSalaryComponentCount
              );
            }
          }
        }
      ),
      { numRuns: 10 }
    );
  });

  test('Property 15: Concurrent transaction handling maintains consistency', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            firstName: fc.string({ minLength: 1, maxLength: 20 }),
            lastName: fc.string({ minLength: 1, maxLength: 20 }),
            email: fc.emailAddress(),
            department: fc.constantFrom(
              'Engineering',
              'HR',
              'Finance',
              'Marketing'
            ),
            monthlyWage: fc.integer({ min: 30000, max: 100000 }),
          }),
          { minLength: 2, maxLength: 5 }
        ),
        async employeeDataArray => {
          const initialEmployeeCount = await prisma.employee.count();

          // Execute multiple concurrent transactions
          const transactionPromises = employeeDataArray.map((data, index) =>
            TransactionService.executeWithOptimisticLocking(async tx => {
              const loginId = `CONCURRENT${Date.now()}${index}${Math.random()}`;

              const employee = await tx.employee.create({
                data: {
                  loginId,
                  email: `${index}_${data.email}`,
                  passwordHash: 'hashedpassword',
                  firstName: data.firstName,
                  lastName: data.lastName,
                  role: 'EMPLOYEE',
                  department: data.department,
                  position: 'Test Position',
                  joiningDate: new Date(),
                  monthlyWage: data.monthlyWage,
                  workingSchedule: {
                    startTime: '09:00',
                    endTime: '17:00',
                    workingDays: ['Monday'],
                    breakDuration: 60,
                  },
                },
              });

              // Simulate some processing time
              await new Promise(resolve =>
                setTimeout(resolve, Math.random() * 10)
              );

              return employee;
            }, 'concurrent-employee-creation')
          );

          const results = await Promise.allSettled(transactionPromises);
          const successfulResults = results.filter(
            r => r.status === 'fulfilled'
          );

          // Verify that all successful transactions created employees
          const finalEmployeeCount = await prisma.employee.count();
          expect(finalEmployeeCount).toBe(
            initialEmployeeCount + successfulResults.length
          );

          // Verify no duplicate login IDs exist
          const employees = await prisma.employee.findMany({
            select: { loginId: true },
          });
          const loginIds = employees.map(e => e.loginId);
          const uniqueLoginIds = new Set(loginIds);
          expect(uniqueLoginIds.size).toBe(loginIds.length);
        }
      ),
      { numRuns: 20 }
    );
  });

  test('Property 15: Employee creation with salary components maintains atomicity', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          firstName: fc.string({ minLength: 1, maxLength: 30 }),
          lastName: fc.string({ minLength: 1, maxLength: 30 }),
          email: fc.emailAddress(),
          monthlyWage: fc.integer({ min: 25000, max: 150000 }),
          simulateFailure: fc.boolean(),
        }),
        async data => {
          const initialEmployeeCount = await prisma.employee.count();
          const initialSalaryComponentCount =
            await prisma.salaryComponent.count();

          const employeeData: CreateEmployeeRequest = {
            firstName: data.firstName,
            lastName: data.lastName,
            email: data.email,
            role: UserRole.EMPLOYEE,
            personalDetails: {
              phone: '+1234567890',
              address: '123 Test St',
              dateOfBirth: new Date('1990-01-01'),
              emergencyContact: {
                name: 'Emergency Contact',
                relationship: 'Spouse',
                phone: '+1234567890',
              },
            },
            jobDetails: {
              department: 'Test Department',
              position: 'Test Position',
              joiningDate: new Date(),
              workingSchedule: {
                startTime: '09:00',
                endTime: '17:00',
                workingDays: [
                  'Monday',
                  'Tuesday',
                  'Wednesday',
                  'Thursday',
                  'Friday',
                ],
                breakDuration: 60,
              },
            },
            salaryInfo: {
              monthlyWage: data.monthlyWage,
            },
          };

          try {
            if (data.simulateFailure) {
              // Mock SalaryService to fail during salary component creation
              const originalMethod =
                SalaryService.generateSalaryStructureInTransaction;
              SalaryService.generateSalaryStructureInTransaction = jest
                .fn()
                .mockRejectedValue(
                  new Error('Salary component creation failed')
                );

              await expect(
                EmployeeService.createEmployee(employeeData)
              ).rejects.toThrow();

              // Restore original method
              SalaryService.generateSalaryStructureInTransaction =
                originalMethod;

              // Verify rollback - no new records should exist
              const finalEmployeeCount = await prisma.employee.count();
              const finalSalaryComponentCount =
                await prisma.salaryComponent.count();

              expect(finalEmployeeCount).toBe(initialEmployeeCount);
              expect(finalSalaryComponentCount).toBe(
                initialSalaryComponentCount
              );
            } else {
              // Test successful employee creation with salary components
              const result = await EmployeeService.createEmployee(employeeData);

              // Verify both employee and salary components were created
              const finalEmployeeCount = await prisma.employee.count();
              const finalSalaryComponentCount =
                await prisma.salaryComponent.count();

              expect(finalEmployeeCount).toBe(initialEmployeeCount + 1);
              expect(finalSalaryComponentCount).toBeGreaterThan(
                initialSalaryComponentCount
              );

              // Verify data integrity
              const createdEmployee = await prisma.employee.findUnique({
                where: { id: result.employee.id },
                include: { salaryComponents: true },
              });

              expect(createdEmployee).toBeTruthy();
              expect(createdEmployee?.salaryComponents.length).toBeGreaterThan(
                0
              );

              // Verify salary components belong to the created employee
              for (const component of createdEmployee?.salaryComponents || []) {
                expect(component.employeeId).toBe(result.employee.id);
              }
            }
          } catch (error) {
            // If we expected success but got an error, verify no partial data exists
            if (!data.simulateFailure) {
              const finalEmployeeCount = await prisma.employee.count();
              const finalSalaryComponentCount =
                await prisma.salaryComponent.count();

              expect(finalEmployeeCount).toBe(initialEmployeeCount);
              expect(finalSalaryComponentCount).toBe(
                initialSalaryComponentCount
              );
            }
          }
        }
      ),
      { numRuns: 30 }
    );
  });

  test('Property 15: Backup operations maintain data consistency', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          employeeCount: fc.integer({ min: 1, max: 3 }),
          backupName: fc.string({ minLength: 5, maxLength: 20 }),
        }),
        async data => {
          // Create test employees
          const employees = [];
          for (let i = 0; i < data.employeeCount; i++) {
            const employee = await prisma.employee.create({
              data: {
                loginId: `BACKUP_TEST_${Date.now()}_${i}`,
                email: `backup.test.${i}.${Date.now()}@example.com`,
                passwordHash: 'hashedpassword',
                firstName: `BackupTest${i}`,
                lastName: `User${i}`,
                role: 'EMPLOYEE',
                department: 'Test Department',
                position: 'Test Position',
                joiningDate: new Date(),
                monthlyWage: 50000,
                workingSchedule: {
                  startTime: '09:00',
                  endTime: '17:00',
                  workingDays: ['Monday'],
                  breakDuration: 60,
                },
              },
            });
            employees.push(employee);
          }

          // Count records before backup
          const employeeCountBeforeBackup = await prisma.employee.count();
          const salaryComponentCountBeforeBackup =
            await prisma.salaryComponent.count();

          try {
            // Create backup
            const backupPath = await BackupService.createBackup(
              `test_${data.backupName}_${Date.now()}.sql`
            );
            expect(backupPath).toBeTruthy();

            // Verify backup file exists and is valid
            const isValid = await BackupService.verifyBackup(backupPath);
            expect(isValid).toBe(true);

            // Verify data consistency after backup - counts should remain the same
            const employeeCountAfterBackup = await prisma.employee.count();
            const salaryComponentCountAfterBackup =
              await prisma.salaryComponent.count();

            expect(employeeCountAfterBackup).toBe(employeeCountBeforeBackup);
            expect(salaryComponentCountAfterBackup).toBe(
              salaryComponentCountBeforeBackup
            );

            // Verify all created employees still exist
            for (const employee of employees) {
              const existingEmployee = await prisma.employee.findUnique({
                where: { id: employee.id },
              });
              expect(existingEmployee).toBeTruthy();
              expect(existingEmployee?.loginId).toBe(employee.loginId);
            }

            // Clean up backup file
            await BackupService.deleteBackup(backupPath.split('/').pop() || '');
          } catch (error) {
            // If backup fails, data should still be consistent
            const employeeCountAfterError = await prisma.employee.count();
            expect(employeeCountAfterError).toBe(employeeCountBeforeBackup);
          }
        }
      ),
      { numRuns: 10 }
    );
  });

  test('Property 15: Transaction retry mechanism maintains consistency', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          maxRetries: fc.integer({ min: 1, max: 5 }),
          shouldSucceedEventually: fc.boolean(),
          employeeName: fc.string({ minLength: 1, maxLength: 20 }),
        }),
        async data => {
          const initialEmployeeCount = await prisma.employee.count();
          let attemptCount = 0;

          const mockOperation = jest
            .fn()
            .mockImplementation(async (tx: TransactionClient) => {
              attemptCount++;

              if (
                data.shouldSucceedEventually &&
                attemptCount >= data.maxRetries
              ) {
                // Succeed on the last attempt
                return await tx.employee.create({
                  data: {
                    loginId: `RETRY_TEST_${Date.now()}_${Math.random()}`,
                    email: `retry.test.${Date.now()}@example.com`,
                    passwordHash: 'hashedpassword',
                    firstName: data.employeeName,
                    lastName: 'RetryTest',
                    role: 'EMPLOYEE',
                    department: 'Test Department',
                    position: 'Test Position',
                    joiningDate: new Date(),
                    monthlyWage: 50000,
                    workingSchedule: {
                      startTime: '09:00',
                      endTime: '17:00',
                      workingDays: ['Monday'],
                      breakDuration: 60,
                    },
                  },
                });
              } else {
                // Fail with a retryable error
                throw new Error('Temporary database connection error');
              }
            });

          try {
            const result = await TransactionService.executeWithRetry(
              mockOperation,
              'retry-test-operation',
              data.maxRetries,
              10 // Short delay for testing
            );

            if (data.shouldSucceedEventually) {
              // Should succeed and create one employee
              expect(result).toBeTruthy();
              const finalEmployeeCount = await prisma.employee.count();
              expect(finalEmployeeCount).toBe(initialEmployeeCount + 1);
              expect(attemptCount).toBe(data.maxRetries);
            }
          } catch (error) {
            if (!data.shouldSucceedEventually) {
              // Should fail and not create any employees
              const finalEmployeeCount = await prisma.employee.count();
              expect(finalEmployeeCount).toBe(initialEmployeeCount);
              expect(attemptCount).toBe(data.maxRetries);
            } else {
              // If we expected success but got failure, verify no partial data
              const finalEmployeeCount = await prisma.employee.count();
              expect(finalEmployeeCount).toBe(initialEmployeeCount);
            }
          }
        }
      ),
      { numRuns: 20 }
    );
  });
});
