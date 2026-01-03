// Production API Client Integration Tests

import { describe, it, expect, beforeEach } from 'vitest';
import { ApiClientFactory, enableProductionApi, enableMockApi } from '../index';
import { ProductionApiClient } from '../production/productionClient';

describe('Production API Client Structure', () => {
  beforeEach(() => {
    ApiClientFactory.reset();
  });

  it('should create production client when production mode is enabled', () => {
    enableProductionApi();
    const client = ApiClientFactory.getClient();
    
    expect(client).toBeInstanceOf(ProductionApiClient);
    expect(client).toHaveProperty('auth');
    expect(client).toHaveProperty('employees');
    expect(client).toHaveProperty('attendance');
    expect(client).toHaveProperty('leave');
    expect(client).toHaveProperty('salary');
  });

  it('should have all required authentication methods', () => {
    enableProductionApi();
    const client = ApiClientFactory.getClient();
    
    expect(typeof client.auth.login).toBe('function');
    expect(typeof client.auth.logout).toBe('function');
    expect(typeof client.auth.refreshToken).toBe('function');
    expect(typeof client.auth.getCurrentUser).toBe('function');
    expect(typeof client.auth.verifyToken).toBe('function');
  });

  it('should have all required employee methods', () => {
    enableProductionApi();
    const client = ApiClientFactory.getClient();
    
    expect(typeof client.employees.getProfile).toBe('function');
    expect(typeof client.employees.updateProfile).toBe('function');
    expect(typeof client.employees.getEmployees).toBe('function');
    expect(typeof client.employees.createEmployee).toBe('function');
    expect(typeof client.employees.deleteEmployee).toBe('function');
    expect(typeof client.employees.uploadProfilePicture).toBe('function');
  });

  it('should have all required attendance methods', () => {
    enableProductionApi();
    const client = ApiClientFactory.getClient();
    
    expect(typeof client.attendance.getAttendanceRecords).toBe('function');
    expect(typeof client.attendance.getAttendanceStatus).toBe('function');
    expect(typeof client.attendance.checkIn).toBe('function');
    expect(typeof client.attendance.checkOut).toBe('function');
    expect(typeof client.attendance.getAllEmployeesAttendance).toBe('function');
    expect(typeof client.attendance.updateAttendanceRecord).toBe('function');
  });

  it('should have all required leave methods', () => {
    enableProductionApi();
    const client = ApiClientFactory.getClient();
    
    expect(typeof client.leave.getLeaveRequests).toBe('function');
    expect(typeof client.leave.getLeaveBalance).toBe('function');
    expect(typeof client.leave.applyLeave).toBe('function');
    expect(typeof client.leave.updateLeaveStatus).toBe('function');
    expect(typeof client.leave.getAllLeaveRequests).toBe('function');
    expect(typeof client.leave.cancelLeaveRequest).toBe('function');
  });

  it('should have all required salary methods', () => {
    enableProductionApi();
    const client = ApiClientFactory.getClient();
    
    expect(typeof client.salary.getSalaryInfo).toBe('function');
    expect(typeof client.salary.updateSalaryInfo).toBe('function');
    expect(typeof client.salary.calculateSalaryComponents).toBe('function');
  });

  it('should switch between mock and production implementations', () => {
    // Start with mock
    enableMockApi();
    const mockClient = ApiClientFactory.getClient();
    
    // Switch to production
    ApiClientFactory.reset();
    enableProductionApi();
    const prodClient = ApiClientFactory.getClient();
    
    // Should be different instances
    expect(mockClient).not.toBe(prodClient);
    expect(prodClient).toBeInstanceOf(ProductionApiClient);
    
    // But should have the same interface
    expect(typeof mockClient.auth.login).toBe(typeof prodClient.auth.login);
    expect(typeof mockClient.employees.getProfile).toBe(typeof prodClient.employees.getProfile);
  });

  it('should maintain singleton pattern within same mode', () => {
    enableProductionApi();
    const client1 = ApiClientFactory.getClient();
    const client2 = ApiClientFactory.getClient();
    
    expect(client1).toBe(client2);
  });
});