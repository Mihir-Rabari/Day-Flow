// Mock API Client Implementation

import type {
  ApiClient,
  AuthApi,
  EmployeeApi,
  AttendanceApi,
  LeaveApi,
  SalaryApi,
  ApiConfig
} from '../types';
import type {
  User,
  LoginCredentials,
  AuthResponse,
  AttendanceRecord,
  AttendanceStatusInfo,
  LeaveRequest,
  LeaveBalance,
  SalaryInfo,
  CreateEmployeeRequest,
  UpdateProfileRequest,
  LeaveApplicationRequest,
  AttendanceActionRequest
} from '../../types';
import { mockStorage } from './mockStorage';
import { generateUser, generateLeaveBalance } from './mockData';

export class MockApiClient implements ApiClient {
  private config: ApiConfig;

  constructor(config: ApiConfig) {
    this.config = config;
    console.log('🔧 Mock API Client initialized');
  }

  // Simulate network delay
  private async delay(ms?: number): Promise<void> {
    const delayTime = ms || Math.random() * 800 + 200; // 200-1000ms
    return new Promise(resolve => setTimeout(resolve, delayTime));
  }

  // Generate mock JWT token
  private generateToken(user: User): string {
    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      exp: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
    };
    return btoa(JSON.stringify(payload));
  }

  // Validate token
  private validateToken(token: string): { userId: string; email: string; role: string } | null {
    try {
      const payload = JSON.parse(atob(token));
      if (payload.exp > Date.now()) {
        return { userId: payload.userId, email: payload.email, role: payload.role };
      }
    } catch (error) {
      console.error('Invalid token:', error);
    }
    return null;
  }

  // Simulate random errors for testing
  private simulateError(errorRate: number = 0.05): void {
    if (Math.random() < errorRate) {
      const errors = [
        { message: 'Network timeout', code: 'NETWORK_TIMEOUT' },
        { message: 'Server temporarily unavailable', code: 'SERVER_ERROR' },
        { message: 'Rate limit exceeded', code: 'RATE_LIMIT' }
      ];
      const error = errors[Math.floor(Math.random() * errors.length)];
      throw new Error(`Mock API Error: ${error.message} (${error.code})`);
    }
  }

  // Authentication API Implementation
  auth: AuthApi = {
    async login(credentials: LoginCredentials): Promise<AuthResponse> {
      await this.delay();
      this.simulateError(0.02); // 2% error rate for login

      const user = mockStorage.getUserByEmail(credentials.email);
      
      if (!user) {
        throw new Error('User not found');
      }

      // Simple password validation (in real app, this would be hashed)
      if (credentials.password !== 'password123') {
        throw new Error('Invalid credentials');
      }

      const token = this.generateToken(user);
      const refreshToken = this.generateToken(user) + '_refresh';

      // Store token in mock storage
      mockStorage.setAuthToken(token, {
        user,
        expiresAt: Date.now() + (24 * 60 * 60 * 1000)
      });

      return {
        user,
        token,
        refreshToken
      };
    },

    async logout(): Promise<void> {
      await this.delay(100);
      // In a real implementation, we'd invalidate the token on the server
      mockStorage.clearAuthTokens();
    },

    async refreshToken(): Promise<AuthResponse> {
      await this.delay(300);
      // For mock purposes, just return a new token with the same user
      const users = mockStorage.getUsers();
      const user = users[0]; // Default to first user
      
      const token = this.generateToken(user);
      const refreshToken = this.generateToken(user) + '_refresh';

      return {
        user,
        token,
        refreshToken
      };
    },

    async getCurrentUser(): Promise<User> {
      await this.delay(200);
      // In a real app, this would validate the current token
      const users = mockStorage.getUsers();
      const user = users.find(u => u.role === 'employee') || users[0];
      
      if (!user) {
        throw new Error('No authenticated user');
      }

      return user;
    },

    async verifyToken(token: string): Promise<boolean> {
      await this.delay(100);
      return this.validateToken(token) !== null;
    }
  };

  // Employee API Implementation
  employees: EmployeeApi = {
    async getProfile(id: string): Promise<User> {
      await this.delay();
      this.simulateError();

      const user = mockStorage.getUserById(id);
      if (!user) {
        throw new Error('User not found');
      }

      return user;
    },

    async updateProfile(id: string, data: UpdateProfileRequest): Promise<User> {
      await this.delay();
      this.simulateError();

      const updatedUser = mockStorage.updateUser(id, data);
      if (!updatedUser) {
        throw new Error('User not found');
      }

      return updatedUser;
    },

    async getEmployees(): Promise<User[]> {
      await this.delay();
      this.simulateError();

      return mockStorage.getUsers();
    },

    async createEmployee(data: CreateEmployeeRequest): Promise<User> {
      await this.delay();
      this.simulateError();

      const newUser = generateUser(data.role, mockStorage.getUsers().length);
      newUser.email = data.email;
      newUser.firstName = data.firstName;
      newUser.lastName = data.lastName;
      newUser.personalDetails = { ...newUser.personalDetails, ...data.personalDetails };
      newUser.jobDetails = { ...newUser.jobDetails, ...data.jobDetails };

      return mockStorage.addUser(newUser);
    },

    async deleteEmployee(id: string): Promise<void> {
      await this.delay();
      this.simulateError();

      mockStorage.deleteUser(id);
    },

    async uploadProfilePicture(id: string, file: File): Promise<string> {
      await this.delay(1500); // Longer delay for file upload simulation
      this.simulateError();

      // Simulate file upload and return a mock URL
      const mockUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${id}-${Date.now()}`;
      
      // Update user profile picture
      mockStorage.updateUser(id, { profilePicture: mockUrl });
      
      return mockUrl;
    }
  };

  // Attendance API Implementation
  attendance: AttendanceApi = {
    async getAttendanceRecords(employeeId: string, month?: string, year?: number): Promise<AttendanceRecord[]> {
      await this.delay();
      this.simulateError();

      return mockStorage.getAttendanceRecords(employeeId, month, year);
    },

    async getAttendanceStatus(employeeId: string): Promise<AttendanceStatusInfo> {
      await this.delay(150);
      this.simulateError();

      const user = mockStorage.getUserById(employeeId);
      if (!user) {
        throw new Error('User not found');
      }

      return user.attendanceStatus;
    },

    async checkIn(employeeId: string, data: AttendanceActionRequest): Promise<AttendanceRecord> {
      await this.delay();
      this.simulateError();

      const today = new Date().toISOString().split('T')[0];
      const recordId = `attendance-${employeeId}-${today}`;

      const newRecord: AttendanceRecord = {
        id: recordId,
        employeeId,
        date: today,
        checkIn: data.timestamp,
        breakTime: 0,
        workingHours: 0,
        status: 'present'
      };

      // Update user's attendance status
      mockStorage.updateUser(employeeId, {
        attendanceStatus: {
          current: 'present' as const,
          lastCheckIn: data.timestamp,
          lastCheckOut: undefined
        }
      });

      return mockStorage.addAttendanceRecord(newRecord);
    },

    async checkOut(employeeId: string, data: AttendanceActionRequest): Promise<AttendanceRecord> {
      await this.delay();
      this.simulateError();

      const today = new Date().toISOString().split('T')[0];
      const recordId = `attendance-${employeeId}-${today}`;

      // Find existing record for today
      const existingRecord = mockStorage.getAttendanceRecords(employeeId).find(r => r.id === recordId);
      
      if (!existingRecord) {
        throw new Error('No check-in record found for today');
      }

      const checkInTime = new Date(existingRecord.checkIn!);
      const checkOutTime = new Date(data.timestamp);
      const workingHours = Math.max(0, (checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60 * 60) - 1); // Minus 1 hour lunch

      const updatedRecord = mockStorage.updateAttendanceRecord(recordId, {
        checkOut: data.timestamp,
        workingHours: Math.round(workingHours * 100) / 100,
        breakTime: 60 // 1 hour lunch break
      });

      // Update user's attendance status
      mockStorage.updateUser(employeeId, {
        attendanceStatus: {
          current: 'present' as const,
          lastCheckIn: existingRecord.checkIn,
          lastCheckOut: data.timestamp
        }
      });

      return updatedRecord!;
    },

    async getAllEmployeesAttendance(date?: string): Promise<AttendanceRecord[]> {
      await this.delay();
      this.simulateError();

      const targetDate = date || new Date().toISOString().split('T')[0];
      return mockStorage.getAttendanceRecords().filter(record => record.date === targetDate);
    },

    async updateAttendanceRecord(id: string, data: Partial<AttendanceRecord>): Promise<AttendanceRecord> {
      await this.delay();
      this.simulateError();

      const updatedRecord = mockStorage.updateAttendanceRecord(id, data);
      if (!updatedRecord) {
        throw new Error('Attendance record not found');
      }

      return updatedRecord;
    }
  };

  // Leave API Implementation
  leave: LeaveApi = {
    async getLeaveRequests(employeeId: string): Promise<LeaveRequest[]> {
      await this.delay();
      this.simulateError();

      return mockStorage.getLeaveRequests(employeeId);
    },

    async getLeaveBalance(employeeId: string): Promise<LeaveBalance> {
      await this.delay();
      this.simulateError();

      const balance = mockStorage.getLeaveBalance(employeeId);
      if (!balance) {
        // Generate new balance if not found
        const newBalance = generateLeaveBalance(employeeId);
        mockStorage.updateLeaveBalance(employeeId, newBalance);
        return newBalance;
      }

      return balance;
    },

    async applyLeave(employeeId: string, data: LeaveApplicationRequest): Promise<LeaveRequest> {
      await this.delay();
      this.simulateError();

      const newRequest: LeaveRequest = {
        id: `leave-${employeeId}-${Date.now()}`,
        employeeId,
        type: data.type,
        startDate: data.startDate,
        endDate: data.endDate,
        days: Math.ceil((new Date(data.endDate).getTime() - new Date(data.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1,
        reason: data.reason,
        status: 'pending',
        appliedDate: new Date().toISOString().split('T')[0]
      };

      return mockStorage.addLeaveRequest(newRequest);
    },

    async updateLeaveStatus(requestId: string, status: 'approved' | 'rejected', comments?: string): Promise<LeaveRequest> {
      await this.delay();
      this.simulateError();

      const updatedRequest = mockStorage.updateLeaveRequest(requestId, {
        status,
        comments,
        approvedBy: 'admin-1',
        approvedDate: new Date().toISOString().split('T')[0]
      });

      if (!updatedRequest) {
        throw new Error('Leave request not found');
      }

      return updatedRequest;
    },

    async getAllLeaveRequests(): Promise<LeaveRequest[]> {
      await this.delay();
      this.simulateError();

      return mockStorage.getLeaveRequests();
    },

    async cancelLeaveRequest(requestId: string): Promise<void> {
      await this.delay();
      this.simulateError();

      const updatedRequest = mockStorage.updateLeaveRequest(requestId, {
        status: 'rejected',
        comments: 'Cancelled by employee'
      });

      if (!updatedRequest) {
        throw new Error('Leave request not found');
      }
    }
  };

  // Salary API Implementation
  salary: SalaryApi = {
    async getSalaryInfo(employeeId: string): Promise<SalaryInfo> {
      await this.delay();
      this.simulateError();

      const user = mockStorage.getUserById(employeeId);
      if (!user) {
        throw new Error('User not found');
      }

      return user.salaryInfo;
    },

    async updateSalaryInfo(employeeId: string, data: Partial<SalaryInfo>): Promise<SalaryInfo> {
      await this.delay();
      this.simulateError();

      const user = mockStorage.getUserById(employeeId);
      if (!user) {
        throw new Error('User not found');
      }

      const updatedSalaryInfo = { ...user.salaryInfo, ...data };
      const updatedUser = mockStorage.updateUser(employeeId, {
        salaryInfo: updatedSalaryInfo
      });

      return updatedUser!.salaryInfo;
    },

    async calculateSalaryComponents(monthlyWage: number): Promise<SalaryInfo> {
      await this.delay(500); // Longer delay for calculation
      this.simulateError();

      // This would typically be done on the server
      const basic = monthlyWage * 0.5;
      const components = [
        {
          id: 'basic',
          name: 'basic' as const,
          displayName: 'Basic Salary',
          computationType: 'percentage_of_wage' as const,
          value: 50,
          calculatedAmount: basic
        },
        {
          id: 'hra',
          name: 'hra' as const,
          displayName: 'House Rent Allowance',
          computationType: 'percentage_of_basic' as const,
          value: 40,
          calculatedAmount: basic * 0.4
        }
        // ... other components would be calculated here
      ];

      return {
        wageType: 'fixed',
        monthlyWage,
        components,
        deductions: []
      };
    }
  };
}