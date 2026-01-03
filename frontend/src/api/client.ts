// API Client Factory and Configuration

import type { ApiClient, ApiConfig } from './types';
import { MockApiClient } from './mock/mockClient';
import { ProductionApiClient } from './production/productionClient';

// Default API Configuration
export const defaultApiConfig: ApiConfig = {
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api',
  timeout: 10000,
  retryAttempts: 3,
  retryDelay: 1000,
  enableMocking: import.meta.env.VITE_ENABLE_MOCK_API === 'true' || import.meta.env.DEV,
};

// API Client Factory
export class ApiClientFactory {
  private static instance: ApiClient | null = null;
  private static config: ApiConfig = defaultApiConfig;

  static configure(config: Partial<ApiConfig>): void {
    this.config = { ...defaultApiConfig, ...config };
    // Reset instance to force recreation with new config
    this.instance = null;
  }

  static getClient(): ApiClient {
    if (!this.instance) {
      this.instance = this.createClient();
    }
    return this.instance;
  }

  private static createClient(): ApiClient {
    if (this.config.enableMocking) {
      console.log('🔧 Using Mock API Client for development');
      return new MockApiClient(this.config);
    } else {
      console.log('🌐 Using Production API Client');
      return new ProductionApiClient(this.config);
    }
  }

  static reset(): void {
    this.instance = null;
  }
}

// Convenience function to get the API client
export const getApiClient = (): ApiClient => {
  return ApiClientFactory.getClient();
};

// Configuration helpers
export const configureApi = (config: Partial<ApiConfig>): void => {
  ApiClientFactory.configure(config);
};

export const enableMockApi = (): void => {
  ApiClientFactory.configure({ enableMocking: true });
};

export const enableProductionApi = (): void => {
  ApiClientFactory.configure({ enableMocking: false });
};

// Export the default client instance
export const api = getApiClient();