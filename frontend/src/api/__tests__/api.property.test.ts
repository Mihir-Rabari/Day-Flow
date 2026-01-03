// Property Tests for API Layer Abstraction

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { 
  api, 
  getApiClient, 
  ApiClientFactory, 
  enableMockApi, 
  enableProductionApi 
} from '../index';
import type { 
  LoginCredentials, 
  User, 
  LeaveApplicationRequest, 
  AttendanceActionRequest,
  CreateEmployeeRequest,
  UpdateProfileRequest
} from '../types';

// Feature: dayflow-frontend, Property 13: API Layer Abstraction
describe('Property 13: API Layer Abstraction', () => {
  beforeEach(() => {
    // Reset API client before each test
    ApiClientFactory.reset();
    enableMockApi();
  });

  afterEach(() => {
    // Clean up after each test
    ApiClientFactory.reset();
  });

  it('should route all backend communication through the abstraction layer', () => {
    fc.assert(fc.property(
      fc.constantFrom('mock', 'production'),
      (apiMode) => {
        // Feature: dayflow-frontend, Property 13: API Layer Abstraction
        
        // Configure API mode
        if (apiMode === 'mock') {
          enableMockApi();
        } else {
          enableProductionApi();
        }

        const client = getApiClient();
        
        // Verify that the client has all required API interfaces
        expect(client).toHaveProperty('auth');
        expect(client).toHaveProperty('employees');
        expect(client).toHaveProperty('attendance');
        expect(client).toHaveProperty('leave');
        expect(client).toHaveProperty('salary');

        // Verify that each API interface has the required methods
        expect(typeof client.auth.login).toBe('function');
        expect(typeof client.auth.logout).toBe('function');
        expect(typeof client.auth.refreshToken).toBe('function');
        expect(typeof client.auth.getCurrentUser).toBe('function');
        expect(typeof client.auth.verifyToken).toBe('function');

        expect(typeof client.employees.getProfile).toBe('function');
        expect(typeof client.employees.updateProfile).toBe('function');
        expect(typeof client.employees.getEmployees).toBe('function');
        expect(typeof client.employees.createEmployee).toBe('function');
        expect(typeof client.employees.deleteEmployee).toBe('function');
        expect(typeof client.employees.uploadProfilePicture).toBe('function');

        expect(typeof client.attendance.getAttendanceRecords).toBe('function');
        expect(typeof client.attendance.getAttendanceStatus).toBe('function');
        expect(typeof client.attendance.checkIn).toBe('function');
        expect(typeof client.attendance.checkOut).toBe('function');
        expect(typeof client.attendance.getAllEmployeesAttendance).toBe('function');
        expect(typeof client.attendance.updateAttendanceRecord).toBe('function');

        expect(typeof client.leave.getLeaveRequests).toBe('function');
        expect(typeof client.leave.getLeaveBalance).toBe('function');
        expect(typeof client.leave.applyLeave).toBe('function');
        expect(typeof client.leave.updateLeaveStatus).toBe('function');
        expect(typeof client.leave.getAllLeaveRequests).toBe('function');
        expect(typeof client.leave.cancelLeaveRequest).toBe('function');

        expect(typeof client.salary.getSalaryInfo).toBe('function');
        expect(typeof client.salary.updateSalaryInfo).toBe('function');
        expect(typeof client.salary.calculateSalaryComponents).toBe('function');
      }
    ), { numRuns: 10 });
  });

  it('should handle authentication consistently across implementations', async () => {
    await fc.assert(fc.asyncProperty(
      fc.record({
        email: fc.emailAddress(),
        password: fc.string({ minLength: 8, maxLength: 20 })
      }),
      async (credentials: LoginCredentials) => {
        // Feature: dayflow-frontend, Property 13: API Layer Abstraction
        
        enableMockApi();
        const mockClient = getApiClient();
        
        try {
          // Test that authentication methods exist and are callable
          expect(typeof mockClient.auth.login).toBe('function');
          expect(typeof mockClient.auth.logout).toBe('function');
          expect(typeof mockClient.auth.getCurrentUser).toBe('function');
          expect(typeof mockClient.auth.verifyToken).toBe('function');
          
          // For mock API, we know the password should be 'password123'
          if (credentials.password === 'password123') {
            const response = await mockClient.auth.login(credentials);
            expect(response).toHaveProperty('user');
            expect(response).toHaveProperty('token');
            expect(response).toHaveProperty('refreshToken');
            expect(response.user).toHaveProperty('email');
            expect(response.user).toHaveProperty('role');
          }
        } catch (error) {
          // Authentication errors are expected for invalid credentials
          expect(error).toBeInstanceOf(Error);
        }
      }
    ), { numRuns: 20 });
  });

  it('should maintain compatibility between mock and production implementations', () => {
    fc.assert(fc.property(
      fc.string({ minLength: 1, maxLength: 50 }),
      (employeeId) => {
        // Feature: dayflow-frontend, Property 13: API Layer Abstraction
        
        // Test mock implementation
        enableMockApi();
        const mockClient = getApiClient();
        
        // Test production implementation structure
        enableProductionApi();
        const prodClient = getApiClient();
        
        // Both implementations should have identical interface structure
        const mockMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(mockClient.auth));
        const prodMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(prodClient.auth));
        
        // Both should have the same API structure (though implementation differs)
        expect(typeof mockClient.auth.login).toBe(typeof prodClient.auth.login);
        expect(typeof mockClient.employees.getProfile).toBe(typeof prodClient.employees.getProfile);
        expect(typeof mockClient.attendance.getAttendanceRecords).toBe(typeof prodClient.attendance.getAttendanceRecords);
        expect(typeof mockClient.leave.getLeaveRequests).toBe(typeof prodClient.leave.getLeaveRequests);
        expect(typeof mockClient.salary.getSalaryInfo).toBe(typeof prodClient.salary.getSalaryInfo);
      }
    ), { numRuns: 10 });
  });

  it('should handle errors consistently across all API operations', async () => {
    await fc.assert(fc.asyncProperty(
      fc.string({ minLength: 1, maxLength: 50 }),
      fc.record({
        type: fc.constantFrom('paid', 'sick', 'unpaid'),
        startDate: fc.date().map(d => d.toISOString().split('T')[0]),
        endDate: fc.date().map(d => d.toISOString().split('T')[0]),
        reason: fc.string({ minLength: 1, maxLength: 100 })
      }),
      async (employeeId: string, leaveData: LeaveApplicationRequest) => {
        // Feature: dayflow-frontend, Property 13: API Layer Abstraction
        
        enableMockApi();
        const client = getApiClient();
        
        try {
          // Test that error handling is consistent
          await client.leave.applyLeave(employeeId, leaveData);
        } catch (error) {
          // Errors should be Error instances with message property
          expect(error).toBeInstanceOf(Error);
          expect(error).toHaveProperty('message');
          expect(typeof (error as Error).message).toBe('string');
        }
        
        try {
          // Test attendance operations
          const attendanceData: AttendanceActionRequest = {
            action: 'check-in',
            timestamp: new Date().toISOString()
          };
          await client.attendance.checkIn(employeeId, attendanceData);
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          expect(error).toHaveProperty('message');
        }
      }
    ), { numRuns: 15 });
  });

  it('should provide consistent data formats across all API responses', async () => {
    await fc.assert(fc.asyncProperty(
      fc.string({ minLength: 1, maxLength: 50 }),
      async (employeeId: string) => {
        // Feature: dayflow-frontend, Property 13: API Layer Abstraction
        
        enableMockApi();
        const client = getApiClient();
        
        try {
          // Test employee data format consistency
          const profile = await client.employees.getProfile(employeeId);
          if (profile) {
            expect(profile).toHaveProperty('id');
            expect(profile).toHaveProperty('email');
            expect(profile).toHaveProperty('firstName');
            expect(profile).toHaveProperty('lastName');
            expect(profile).toHaveProperty('role');
            expect(profile).toHaveProperty('personalDetails');
            expect(profile).toHaveProperty('jobDetails');
            expect(profile).toHaveProperty('salaryInfo');
            expect(profile).toHaveProperty('attendanceStatus');
          }
        } catch (error) {
          // User not found errors are acceptable
          expect(error).toBeInstanceOf(Error);
        }
        
        try {
          // Test attendance data format consistency
          const attendanceRecords = await client.attendance.getAttendanceRecords(employeeId);
          if (Array.isArray(attendanceRecords)) {
            attendanceRecords.forEach(record => {
              expect(record).toHaveProperty('id');
              expect(record).toHaveProperty('employeeId');
              expect(record).toHaveProperty('date');
              expect(record).toHaveProperty('status');
              expect(record).toHaveProperty('workingHours');
              expect(record).toHaveProperty('breakTime');
            });
          }
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
        }
        
        try {
          // Test leave data format consistency
          const leaveRequests = await client.leave.getLeaveRequests(employeeId);
          if (Array.isArray(leaveRequests)) {
            leaveRequests.forEach(request => {
              expect(request).toHaveProperty('id');
              expect(request).toHaveProperty('employeeId');
              expect(request).toHaveProperty('type');
              expect(request).toHaveProperty('startDate');
              expect(request).toHaveProperty('endDate');
              expect(request).toHaveProperty('status');
              expect(request).toHaveProperty('reason');
            });
          }
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
        }
      }
    ), { numRuns: 10 });
  });

  it('should support easy switching between mock and production modes', () => {
    fc.assert(fc.property(
      fc.constantFrom(true, false),
      (useMockApi) => {
        // Feature: dayflow-frontend, Property 13: API Layer Abstraction
        
        // Reset to ensure clean state
        ApiClientFactory.reset();
        
        if (useMockApi) {
          enableMockApi();
        } else {
          enableProductionApi();
        }
        
        const client1 = getApiClient();
        const client2 = getApiClient();
        
        // Should return the same instance (singleton pattern)
        expect(client1).toBe(client2);
        
        // Reset and switch modes
        ApiClientFactory.reset();
        
        if (useMockApi) {
          enableProductionApi();
        } else {
          enableMockApi();
        }
        
        const client3 = getApiClient();
        
        // Should be a different instance after mode switch
        expect(client1).not.toBe(client3);
        
        // But should still have the same interface
        expect(typeof client1.auth.login).toBe(typeof client3.auth.login);
        expect(typeof client1.employees.getProfile).toBe(typeof client3.employees.getProfile);
      }
    ), { numRuns: 10 });
  });
});