// API Module Exports

// Main API client and factory
export { 
  api, 
  getApiClient, 
  ApiClientFactory, 
  configureApi, 
  enableMockApi, 
  enableProductionApi,
  defaultApiConfig 
} from './client';

// API interfaces and types
export type {
  ApiClient,
  AuthApi,
  EmployeeApi,
  AttendanceApi,
  LeaveApi,
  SalaryApi,
  ApiConfig,
  PaginatedRequest,
  PaginatedResponse,
  ValidationError,
  NetworkError,
  MockDataStore,
  ApiRequestOptions,
  RequestInterceptor,
  ResponseInterceptor,
  ApiInterceptors
} from './types';

// Re-export commonly used types from main types module
export type {
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

// API utilities
export { ApiErrorHandler, ApiInterceptors } from './utils';