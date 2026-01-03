// Production API Client Implementation

import axios, { type AxiosInstance, AxiosError, type AxiosRequestConfig } from 'axios';
import type {
  ApiClient,
  AuthApi,
  EmployeeApi,
  AttendanceApi,
  LeaveApi,
  SalaryApi,
  ApiConfig,
  ApiRequestOptions,
  NetworkError
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
import { ApiErrorHandler } from '../utils/errorHandler';
import { ApiInterceptors } from '../utils/interceptors';

export class ProductionApiClient implements ApiClient {
  private axiosInstance: AxiosInstance;
  private config: ApiConfig;
  private authToken: string | null = null;

  constructor(config: ApiConfig) {
    this.config = config;
    this.axiosInstance = this.createAxiosInstance();
    this.setupInterceptors();
    console.log('🌐 Production API Client initialized');
  }

  private createAxiosInstance(): AxiosInstance {
    return axios.create({
      baseURL: this.config.baseURL,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  private setupInterceptors(): void {
    // Request interceptors
    this.axiosInstance.interceptors.request.use(
      ApiInterceptors.requestInterceptor,
      ApiInterceptors.requestErrorInterceptor
    );

    // Auth token interceptor
    this.axiosInstance.interceptors.request.use(
      (config) => {
        if (this.authToken && !config.headers.skipAuth) {
          config.headers.Authorization = `Bearer ${this.authToken}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptors
    this.axiosInstance.interceptors.response.use(
      ApiInterceptors.responseInterceptor,
      async (error: AxiosError) => {
        const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

        // Handle 401 errors (unauthorized)
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          
          try {
            // Attempt to refresh token
            await this.auth.refreshToken();
            return this.axiosInstance(originalRequest);
          } catch (refreshError) {
            // Refresh failed, redirect to login
            this.authToken = null;
            localStorage.removeItem('auth-token');
            window.location.href = '/login';
            return Promise.reject(refreshError);
          }
        }

        // Transform axios error to our NetworkError format
        const networkError: NetworkError = {
          message: error.response?.data?.message || error.message || 'Network error occurred',
          code: error.response?.data?.code || 'NETWORK_ERROR',
          status: error.response?.status,
          statusText: error.response?.statusText,
        };

        // Use error interceptor for logging
        ApiInterceptors.responseErrorInterceptor(error);

        return Promise.reject(networkError);
      }
    );
  }

  private async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
    url: string,
    data?: any,
    options?: ApiRequestOptions
  ): Promise<T> {
    const config: AxiosRequestConfig = {
      method,
      url,
      data,
      timeout: options?.timeout || this.config.timeout,
    };

    if (options?.skipAuth) {
      config.headers = { ...config.headers, skipAuth: true };
    }

    let attempt = 0;
    const maxRetries = options?.retries || this.config.retryAttempts;

    while (attempt <= maxRetries) {
      try {
        const response = await this.axiosInstance(config);
        return response.data;
      } catch (error) {
        attempt++;
        
        if (attempt > maxRetries) {
          throw error;
        }

        // Only retry on network errors or 5xx server errors
        const shouldRetry = ApiErrorHandler.shouldRetry(error);

        if (!shouldRetry) {
          throw error;
        }

        // Exponential backoff
        const delay = this.config.retryDelay * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw new Error('Max retries exceeded');
  }

  // Set auth token (called after successful login)
  setAuthToken(token: string): void {
    this.authToken = token;
    localStorage.setItem('auth-token', token);
  }

  // Clear auth token (called on logout)
  clearAuthToken(): void {
    this.authToken = null;
    localStorage.removeItem('auth-token');
  }

  // Load auth token from storage
  loadAuthToken(): void {
    const token = localStorage.getItem('auth-token');
    if (token) {
      this.authToken = token;
    }
  }

  // Authentication API Implementation
  auth: AuthApi = {
    async login(credentials: LoginCredentials): Promise<AuthResponse> {
      const response = await this.request<AuthResponse>(
        'POST',
        '/auth/login',
        credentials,
        { skipAuth: true }
      );
      
      this.setAuthToken(response.token);
      return response;
    },

    async logout(): Promise<void> {
      try {
        await this.request('POST', '/auth/logout');
      } finally {
        this.clearAuthToken();
      }
    },

    async refreshToken(): Promise<AuthResponse> {
      const refreshToken = localStorage.getItem('refresh-token');
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await this.request<AuthResponse>(
        'POST',
        '/auth/refresh',
        { refreshToken },
        { skipAuth: true }
      );

      this.setAuthToken(response.token);
      localStorage.setItem('refresh-token', response.refreshToken);
      return response;
    },

    async getCurrentUser(): Promise<User> {
      return this.request<User>('GET', '/auth/me');
    },

    async verifyToken(token: string): Promise<boolean> {
      try {
        await this.request('POST', '/auth/verify', { token });
        return true;
      } catch {
        return false;
      }
    }
  };

  // Employee API Implementation
  employees: EmployeeApi = {
    async getProfile(id: string): Promise<User> {
      return this.request<User>('GET', `/employees/${id}`);
    },

    async updateProfile(id: string, data: UpdateProfileRequest): Promise<User> {
      return this.request<User>('PUT', `/employees/${id}`, data);
    },

    async getEmployees(): Promise<User[]> {
      return this.request<User[]>('GET', '/employees');
    },

    async createEmployee(data: CreateEmployeeRequest): Promise<User> {
      return this.request<User>('POST', '/employees', data);
    },

    async deleteEmployee(id: string): Promise<void> {
      await this.request('DELETE', `/employees/${id}`);
    },

    async uploadProfilePicture(id: string, file: File): Promise<string> {
      const formData = new FormData();
      formData.append('profilePicture', file);

      const response = await this.axiosInstance.post(
        `/employees/${id}/profile-picture`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      return response.data.url;
    }
  };

  // Attendance API Implementation
  attendance: AttendanceApi = {
    async getAttendanceRecords(employeeId: string, month?: string, year?: number): Promise<AttendanceRecord[]> {
      const params = new URLSearchParams();
      if (month) params.append('month', month);
      if (year) params.append('year', year.toString());
      
      const queryString = params.toString();
      const url = `/attendance/${employeeId}${queryString ? `?${queryString}` : ''}`;
      
      return this.request<AttendanceRecord[]>('GET', url);
    },

    async getAttendanceStatus(employeeId: string): Promise<AttendanceStatusInfo> {
      return this.request<AttendanceStatusInfo>('GET', `/attendance/${employeeId}/status`);
    },

    async checkIn(employeeId: string, data: AttendanceActionRequest): Promise<AttendanceRecord> {
      return this.request<AttendanceRecord>('POST', `/attendance/${employeeId}/check-in`, data);
    },

    async checkOut(employeeId: string, data: AttendanceActionRequest): Promise<AttendanceRecord> {
      return this.request<AttendanceRecord>('POST', `/attendance/${employeeId}/check-out`, data);
    },

    async getAllEmployeesAttendance(date?: string): Promise<AttendanceRecord[]> {
      const params = date ? `?date=${date}` : '';
      return this.request<AttendanceRecord[]>('GET', `/attendance/all${params}`);
    },

    async updateAttendanceRecord(id: string, data: Partial<AttendanceRecord>): Promise<AttendanceRecord> {
      return this.request<AttendanceRecord>('PUT', `/attendance/records/${id}`, data);
    }
  };

  // Leave API Implementation
  leave: LeaveApi = {
    async getLeaveRequests(employeeId: string): Promise<LeaveRequest[]> {
      return this.request<LeaveRequest[]>('GET', `/leave/${employeeId}/requests`);
    },

    async getLeaveBalance(employeeId: string): Promise<LeaveBalance> {
      return this.request<LeaveBalance>('GET', `/leave/${employeeId}/balance`);
    },

    async applyLeave(employeeId: string, data: LeaveApplicationRequest): Promise<LeaveRequest> {
      return this.request<LeaveRequest>('POST', `/leave/${employeeId}/apply`, data);
    },

    async updateLeaveStatus(requestId: string, status: 'approved' | 'rejected', comments?: string): Promise<LeaveRequest> {
      return this.request<LeaveRequest>('PUT', `/leave/requests/${requestId}/status`, {
        status,
        comments
      });
    },

    async getAllLeaveRequests(): Promise<LeaveRequest[]> {
      return this.request<LeaveRequest[]>('GET', '/leave/requests/all');
    },

    async cancelLeaveRequest(requestId: string): Promise<void> {
      await this.request('DELETE', `/leave/requests/${requestId}`);
    }
  };

  // Salary API Implementation
  salary: SalaryApi = {
    async getSalaryInfo(employeeId: string): Promise<SalaryInfo> {
      return this.request<SalaryInfo>('GET', `/salary/${employeeId}`);
    },

    async updateSalaryInfo(employeeId: string, data: Partial<SalaryInfo>): Promise<SalaryInfo> {
      return this.request<SalaryInfo>('PUT', `/salary/${employeeId}`, data);
    },

    async calculateSalaryComponents(monthlyWage: number): Promise<SalaryInfo> {
      return this.request<SalaryInfo>('POST', '/salary/calculate', { monthlyWage });
    }
  };
}