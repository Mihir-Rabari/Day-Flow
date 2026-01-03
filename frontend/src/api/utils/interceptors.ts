// API Request/Response Interceptors

import type { AxiosRequestConfig, AxiosResponse } from 'axios';
import { ApiErrorHandler } from './errorHandler';

export class ApiInterceptors {
  // Request interceptor to add common headers and logging
  static requestInterceptor = (config: AxiosRequestConfig): AxiosRequestConfig => {
    // Add request timestamp for performance monitoring
    config.metadata = { startTime: Date.now() };
    
    // Add common headers
    if (!config.headers) {
      config.headers = {};
    }
    
    // Add request ID for tracing
    config.headers['X-Request-ID'] = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Add client info
    config.headers['X-Client-Version'] = '1.0.0';
    config.headers['X-Client-Platform'] = 'web';
    
    // Log request in development
    if (import.meta.env.DEV && import.meta.env.VITE_ENABLE_API_LOGGING === 'true') {
      console.log(`🌐 API Request: ${config.method?.toUpperCase()} ${config.url}`, {
        headers: config.headers,
        data: config.data,
        params: config.params
      });
    }
    
    return config;
  };

  // Request error interceptor
  static requestErrorInterceptor = (error: any): Promise<any> => {
    ApiErrorHandler.logError(error, 'Request Interceptor');
    return Promise.reject(error);
  };

  // Response interceptor for success responses
  static responseInterceptor = (response: AxiosResponse): AxiosResponse => {
    // Calculate request duration
    const duration = Date.now() - (response.config.metadata?.startTime || 0);
    
    // Log response in development
    if (import.meta.env.DEV && import.meta.env.VITE_ENABLE_API_LOGGING === 'true') {
      console.log(`✅ API Response: ${response.config.method?.toUpperCase()} ${response.config.url} (${duration}ms)`, {
        status: response.status,
        data: response.data
      });
    }
    
    // Performance monitoring
    if (duration > 5000) {
      console.warn(`⚠️ Slow API request detected: ${response.config.url} took ${duration}ms`);
    }
    
    return response;
  };

  // Response error interceptor
  static responseErrorInterceptor = (error: any): Promise<any> => {
    const config = error.config;
    const duration = Date.now() - (config?.metadata?.startTime || 0);
    
    // Log error response in development
    if (import.meta.env.DEV && import.meta.env.VITE_ENABLE_API_LOGGING === 'true') {
      console.error(`❌ API Error: ${config?.method?.toUpperCase()} ${config?.url} (${duration}ms)`, {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message
      });
    }
    
    ApiErrorHandler.logError(error, 'Response Interceptor');
    
    return Promise.reject(error);
  };
}

// Extend AxiosRequestConfig to include metadata
declare module 'axios' {
  interface AxiosRequestConfig {
    metadata?: {
      startTime: number;
    };
  }
}