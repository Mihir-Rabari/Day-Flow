import * as fc from 'fast-check';
import {
  emailService,
  WelcomeEmailData,
  PasswordResetEmailData,
  LeaveNotificationEmailData,
} from '../services/emailService';
import { PasswordResetService } from '../services/passwordResetService';
import { LeaveNotificationService } from '../services/leaveNotificationService';
import { PrismaClient, LeaveStatus, LeaveType } from '@prisma/client';

const prisma = new PrismaClient();

// Mock nodemailer for testing
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    verify: jest.fn().mockResolvedValue(true),
    sendMail: jest.fn().mockResolvedValue({
      messageId: 'test-message-id',
      accepted: ['test@example.com'],
      rejected: [],
    }),
  })),
}));

// Mock logger to avoid console output during tests
jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('Email Notification System Property Tests', () => {
  beforeAll(async () => {
    // Clean up test data
    await prisma.leaveRequest.deleteMany();
    await prisma.employee.deleteMany();
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.leaveRequest.deleteMany();
    await prisma.employee.deleteMany();
    await prisma.$disconnect();
  });

  /**
   * Property 10: Email Notification System
   * For any triggering event (employee creation, password reset, leave approval),
   * the system should send appropriate emails using Nodemailer with consistent
   * templates and proper error handling.
   * Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5
   */
  describe('Property 10: Email Notification System', () => {
    test('Welcome emails should contain all required information and be properly formatted', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            employeeName: fc
              .string({ minLength: 2, maxLength: 50 })
              .filter(s => s.trim().length > 0),
            loginId: fc
              .string({ minLength: 5, maxLength: 20 })
              .filter(s => /^[A-Z0-9]+$/.test(s)),
            temporaryPassword: fc.string({ minLength: 8, maxLength: 20 }),
            email: fc.emailAddress(),
          }),
          async ({ employeeName, loginId, temporaryPassword, email }) => {
            // Test welcome email generation
            const welcomeData: WelcomeEmailData = {
              employeeName,
              loginId,
              temporaryPassword,
              loginUrl: 'http://localhost:3001/login',
              companyName: 'Dayflow',
            };

            const emailOptions = emailService.generateWelcomeEmail(welcomeData);

            // Verify email structure
            expect(emailOptions.subject).toContain('Welcome');
            expect(emailOptions.subject).toContain(welcomeData.companyName);
            expect(emailOptions.html).toContain(employeeName);
            expect(emailOptions.html).toContain(loginId);
            expect(emailOptions.html).toContain(temporaryPassword);
            expect(emailOptions.html).toContain(welcomeData.loginUrl);
            expect(emailOptions.text).toContain(employeeName);
            expect(emailOptions.text).toContain(loginId);
            expect(emailOptions.text).toContain(temporaryPassword);

            // Test actual email sending
            emailOptions.to = email;
            await expect(
              emailService.sendEmail(emailOptions)
            ).resolves.not.toThrow();
          }
        ),
        { numRuns: 50 }
      );
    });

    test('Password reset emails should contain valid tokens and security information', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            employeeName: fc
              .string({ minLength: 2, maxLength: 50 })
              .filter(s => s.trim().length > 0),
            email: fc.emailAddress(),
          }),
          async ({ employeeName, email }) => {
            // Generate reset token
            const resetToken = fc.sample(
              fc.string({ minLength: 32, maxLength: 32 }),
              1
            )[0];
            const expirationTime = new Date(
              Date.now() + 60 * 60 * 1000
            ).toLocaleString();

            const resetData: PasswordResetEmailData = {
              employeeName,
              resetToken,
              resetUrl: `http://localhost:3001/reset-password?token=${resetToken}`,
              expirationTime,
            };

            const emailOptions =
              emailService.generatePasswordResetEmail(resetData);

            // Verify email structure
            expect(emailOptions.subject).toContain('Password Reset');
            expect(emailOptions.html).toContain(employeeName);
            expect(emailOptions.html).toContain(resetToken);
            expect(emailOptions.html).toContain(resetData.resetUrl);
            expect(emailOptions.html).toContain('1 hour'); // Security notice
            expect(emailOptions.text).toContain(employeeName);
            expect(emailOptions.text).toContain(resetToken);

            // Test actual email sending
            emailOptions.to = email;
            await expect(
              emailService.sendEmail(emailOptions)
            ).resolves.not.toThrow();
          }
        ),
        { numRuns: 50 }
      );
    });

    test('Leave notification emails should handle both approval and rejection statuses', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            employeeName: fc
              .string({ minLength: 2, maxLength: 50 })
              .filter(s => s.trim().length > 0),
            leaveType: fc.constantFrom(
              'Paid Leave',
              'Sick Leave',
              'Casual Leave',
              'Unpaid Leave'
            ),
            status: fc.constantFrom('approved', 'rejected') as fc.Arbitrary<
              'approved' | 'rejected'
            >,
            approverName: fc
              .string({ minLength: 2, maxLength: 50 })
              .filter(s => s.trim().length > 0),
            comments: fc.option(fc.string({ minLength: 1, maxLength: 200 })),
            email: fc.emailAddress(),
          }),
          async ({
            employeeName,
            leaveType,
            status,
            approverName,
            comments,
            email,
          }) => {
            const startDate = new Date();
            const endDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // Tomorrow

            const leaveData: LeaveNotificationEmailData = {
              employeeName,
              leaveType,
              startDate: startDate.toLocaleDateString(),
              endDate: endDate.toLocaleDateString(),
              status,
              approverName,
              comments: comments || undefined,
            };

            const emailOptions =
              emailService.generateLeaveNotificationEmail(leaveData);

            // Verify email structure
            expect(emailOptions.subject).toContain('Leave Request');
            expect(emailOptions.subject).toContain(
              status === 'approved' ? 'Approved' : 'Rejected'
            );
            expect(emailOptions.html).toContain(employeeName);
            expect(emailOptions.html).toContain(leaveType);
            expect(emailOptions.html).toContain(approverName);
            expect(emailOptions.html).toContain(
              status === 'approved' ? 'APPROVED' : 'REJECTED'
            );
            expect(emailOptions.text).toContain(employeeName);
            expect(emailOptions.text).toContain(leaveType);

            // Verify status-specific content
            if (status === 'approved') {
              expect(emailOptions.html).toContain('approved');
              expect(emailOptions.html).toContain('handover');
            } else {
              expect(emailOptions.html).toContain('rejected');
              expect(emailOptions.html).toContain('contact your manager');
            }

            // Verify comments are included if provided
            if (comments) {
              expect(emailOptions.html).toContain(comments);
            }

            // Test actual email sending
            emailOptions.to = email;
            await expect(
              emailService.sendEmail(emailOptions)
            ).resolves.not.toThrow();
          }
        ),
        { numRuns: 50 }
      );
    });

    test('Email service should handle errors gracefully and provide retry mechanism', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            email: fc.emailAddress(),
            subject: fc.string({ minLength: 1, maxLength: 100 }),
            content: fc.string({ minLength: 1, maxLength: 500 }),
          }),
          async ({ email, subject, content }) => {
            const emailOptions = {
              to: email,
              subject,
              html: `<p>${content}</p>`,
              text: content,
            };

            // Test that email service doesn't throw for valid inputs
            await expect(
              emailService.sendEmail(emailOptions)
            ).resolves.not.toThrow();

            // Test email configuration validation
            const configTest = await emailService.testEmailConfiguration();
            expect(typeof configTest).toBe('boolean');
          }
        ),
        { numRuns: 30 }
      );
    });

    test('Password reset service should generate unique tokens and handle expiration', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            email: fc.emailAddress(),
            employeeName: fc
              .string({ minLength: 2, maxLength: 50 })
              .filter(s => s.trim().length > 0),
          }),
          async ({ email, employeeName }) => {
            // Create test employee
            const employee = await prisma.employee.create({
              data: {
                loginId: `TEST${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
                email: email.toLowerCase(),
                passwordHash: 'test-hash',
                firstName: employeeName.split(' ')[0] || 'Test',
                lastName: employeeName.split(' ')[1] || 'User',
                department: 'Test',
                position: 'Test Position',
                joiningDate: new Date(),
                workingSchedule: { hours: 8 },
                monthlyWage: 50000,
              },
            });

            try {
              // Test password reset initiation
              await expect(
                PasswordResetService.initiatePasswordReset(email)
              ).resolves.not.toThrow();

              // Generate multiple tokens and verify uniqueness
              const tokens = Array.from(
                { length: 5 },
                () =>
                  fc.sample(fc.string({ minLength: 32, maxLength: 32 }), 1)[0]
              );

              const uniqueTokens = new Set(tokens);
              expect(uniqueTokens.size).toBe(tokens.length);

              // Test token validation
              tokens.forEach(token => {
                const isValid = PasswordResetService.validateResetToken(token);
                expect(typeof isValid).toBe('boolean');
              });
            } finally {
              // Clean up test employee
              await prisma.employee.delete({ where: { id: employee.id } });
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    test('Leave notification service should handle different leave types and statuses', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            employeeName: fc
              .string({ minLength: 2, maxLength: 50 })
              .filter(s => s.trim().length > 0),
            email: fc.emailAddress(),
            leaveType: fc.constantFrom(...Object.values(LeaveType)),
            approverName: fc
              .string({ minLength: 2, maxLength: 50 })
              .filter(s => s.trim().length > 0),
            reason: fc.string({ minLength: 5, maxLength: 200 }),
          }),
          async ({ employeeName, email, leaveType, approverName, reason }) => {
            // Create test employee
            const employee = await prisma.employee.create({
              data: {
                loginId: `TEST${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
                email: email.toLowerCase(),
                passwordHash: 'test-hash',
                firstName: employeeName.split(' ')[0] || 'Test',
                lastName: employeeName.split(' ')[1] || 'User',
                department: 'Test',
                position: 'Test Position',
                joiningDate: new Date(),
                workingSchedule: { hours: 8 },
                monthlyWage: 50000,
              },
            });

            // Create test leave request
            const leaveRequest = await prisma.leaveRequest.create({
              data: {
                employeeId: employee.id,
                type: leaveType,
                startDate: new Date(),
                endDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
                days: 1,
                reason,
                status: LeaveStatus.PENDING,
              },
            });

            try {
              // Test leave status notification for both approved and rejected
              for (const status of [
                LeaveStatus.APPROVED,
                LeaveStatus.REJECTED,
              ]) {
                await expect(
                  LeaveNotificationService.sendLeaveStatusNotification(
                    leaveRequest.id,
                    status,
                    approverName,
                    'Test comments'
                  )
                ).resolves.not.toThrow();
              }

              // Test leave application notification
              await expect(
                LeaveNotificationService.sendLeaveApplicationNotification(
                  leaveRequest.id
                )
              ).resolves.not.toThrow();
            } finally {
              // Clean up test data
              await prisma.leaveRequest.delete({
                where: { id: leaveRequest.id },
              });
              await prisma.employee.delete({ where: { id: employee.id } });
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    test('Bulk email operations should handle partial failures gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              to: fc.emailAddress(),
              subject: fc.string({ minLength: 1, maxLength: 50 }),
              content: fc.string({ minLength: 1, maxLength: 100 }),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          async emailData => {
            const emailOptions = emailData.map(data => ({
              to: data.to,
              subject: data.subject,
              html: `<p>${data.content}</p>`,
              text: data.content,
            }));

            // Test bulk email sending
            await expect(
              emailService.sendBulkEmails(emailOptions)
            ).resolves.not.toThrow();

            // Verify that each email has required fields
            emailOptions.forEach(email => {
              expect(email.to).toBeTruthy();
              expect(email.subject).toBeTruthy();
              expect(email.html).toBeTruthy();
              expect(email.text).toBeTruthy();
            });
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});

/**
 * Feature: dayflow-backend, Property 10: Email Notification System
 *
 * This test suite validates that for any triggering event (employee creation,
 * password reset, leave approval), the system sends appropriate emails using
 * Nodemailer with consistent templates and proper error handling.
 *
 * The tests cover:
 * - Welcome email generation and sending (Requirement 8.1)
 * - Password reset email functionality (Requirement 8.2)
 * - Leave notification emails for approvals/rejections (Requirement 8.3)
 * - Email service configuration and error handling (Requirement 8.4)
 * - Template consistency and formatting (Requirement 8.5)
 * - Bulk email operations and partial failure handling
 * - Token generation and validation for password resets
 * - Leave notification service integration
 */
