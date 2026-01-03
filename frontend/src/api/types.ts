// API Interface Types for Dayflow Frontend

import {
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
  AttendanceActionRequest,
  ApiResponse,
  ApiError
} from '../types';

// Base API Client Interface
export interface ApiClient {
  auth: AuthApi;
  employees: EmployeeApi;
  attendance: AttendanceApi;
  leave: LeaveApi;
  salary: SalaryApi;
}

// Authentication API Interface
export interface AuthApi {
  login(credentials: LoginCredentials): Promise<AuthResponse>;
  logout(): Promise<void>;
  refreshToken(): Promise<AuthResponse>;
  getCurrentUser(): Promise<User>;
  verifyToken(token: string): Promise<boolean>;
}

// Employee Management API Interface
export interface EmployeeApi {
  getProfile(id: string): Promise<User>;
  updateProfile(id: string, data: UpdateProfileRequest): Promise<User>;
  getEmployees(): Promise<User[]>; // Admin only
  createEmployee(data: CreateEmployeeRequest): Promise<User>; // Admin only
  deleteEmployee(id: string): Promise<void>; // Admin only
  uploadProfilePicture(id: string, file: File): Promise<string>; // Returns URL
}

// Attendance API Interface
export interface AttendanceApi {
  getAttendanceRecords(employeeId: string, month?: string, year?: number): Promise<AttendanceRecord[]>;
  getAttendanceStatus(employeeId: string): Promise<AttendanceStatusInfo>;
  checkIn(employeeId: string, data: AttendanceActionRequest): Promise<AttendanceRecord>;
  checkOut(employeeId: string, data: AttendanceActionRequest): Promise<AttendanceRecord>;
  getAllEmployeesAttendance(date?: string): Promise<AttendanceRecord[]>; // Admin only
  updateAttendanceRecord(id: string, data: Partial<AttendanceRecord>): Promise<AttendanceRecord>; // Admin only
}

// Leave Management API Interface
export interface LeaveApi {
  getLeaveRequests(employeeId: string): Promise<LeaveRequest[]>;
  getLeaveBalance(employeeId: string): Promise<LeaveBalance>;
  applyLeave(employeeId: string, data: LeaveApplicationRequest): Promise<LeaveRequest>;
  updateLeaveStatus(requestId: string, status: 'approved' | 'rejected', comments?: string): Promise<LeaveRequest>; // Admin only
  getAllLeaveRequests(): Promise<LeaveRequest[]>; // Admin only
  cancelLeaveRequest(requestId: string): Promise<void>;
}

// Salary API Interface
export interface SalaryApi {
  getSalaryInfo(employeeId: string): Promise<SalaryInfo>;
  updateSalaryInfo(employeeId: string, data: Partial<SalaryInfo>): Promise<SalaryInfo>; // Admin only
  calculateSalaryComponents(monthlyWage: number): Promise<SalaryInfo>;
}

// API Configuration Interface
export interface ApiConfig {
  baseURL: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  enableMocking: boolean;
}

// Request/Response Wrapper Types
export interface PaginatedRequest {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Error Types
export interface ValidationError extends ApiError {
  field: string;
  value: unknown;
}

export interface NetworkError extends ApiError {
  status?: number;
  statusText?: string;
}

// Mock Data Types
export interface MockDataStore {
  users: User[];
  attendanceRecords: AttendanceRecord[];
  leaveRequests: LeaveRequest[];
  leaveBalances: LeaveBalance[];
  authTokens: Map<string, { user: User; expiresAt: number }>;
}

// API Method Options
export interface ApiRequestOptions {
  timeout?: number;
  retries?: number;
  skipAuth?: boolean;
  mockDelay?: number;
}

// Interceptor Types
export interface RequestInterceptor {
  onRequest?: (config: any) => any;
  onRequestError?: (error: any) => Promise<any>;
}

export interface ResponseInterceptor {
  onResponse?: (response: any) => any;
  onResponseError?: (error: any) => Promise<any>;
}

export interface ApiInterceptors {
  request?: RequestInterceptor;
  response?: ResponseInterceptor;
}