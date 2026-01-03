// Mock Storage Utility for localStorage persistence

import { MockDataStore } from '../types';
import { mockData } from './mockData';

const STORAGE_KEY = 'dayflow-mock-data';
const TOKEN_STORAGE_KEY = 'dayflow-auth-tokens';

export class MockStorage {
  private static instance: MockStorage | null = null;
  private data: MockDataStore;

  private constructor() {
    this.data = this.loadFromStorage();
  }

  static getInstance(): MockStorage {
    if (!this.instance) {
      this.instance = new MockStorage();
    }
    return this.instance;
  }

  private loadFromStorage(): MockDataStore {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const tokenData = localStorage.getItem(TOKEN_STORAGE_KEY);
      
      if (stored) {
        const parsedData = JSON.parse(stored);
        const authTokens = new Map();
        
        if (tokenData) {
          const tokenEntries = JSON.parse(tokenData);
          tokenEntries.forEach(([key, value]: [string, any]) => {
            authTokens.set(key, value);
          });
        }
        
        return {
          ...parsedData,
          authTokens
        };
      }
    } catch (error) {
      console.warn('Failed to load mock data from storage, using defaults:', error);
    }
    
    return mockData;
  }

  private saveToStorage(): void {
    try {
      const dataToStore = {
        users: this.data.users,
        attendanceRecords: this.data.attendanceRecords,
        leaveRequests: this.data.leaveRequests,
        leaveBalances: this.data.leaveBalances
      };
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToStore));
      
      // Save auth tokens separately
      const tokenEntries = Array.from(this.data.authTokens.entries());
      localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokenEntries));
    } catch (error) {
      console.error('Failed to save mock data to storage:', error);
    }
  }

  // Data access methods
  getData(): MockDataStore {
    return this.data;
  }

  // User methods
  getUsers() {
    return this.data.users;
  }

  getUserById(id: string) {
    return this.data.users.find(user => user.id === id);
  }

  getUserByEmail(email: string) {
    return this.data.users.find(user => user.email === email);
  }

  updateUser(id: string, updates: any) {
    const userIndex = this.data.users.findIndex(user => user.id === id);
    if (userIndex !== -1) {
      this.data.users[userIndex] = { ...this.data.users[userIndex], ...updates };
      this.saveToStorage();
      return this.data.users[userIndex];
    }
    return null;
  }

  addUser(user: any) {
    this.data.users.push(user);
    this.saveToStorage();
    return user;
  }

  deleteUser(id: string) {
    this.data.users = this.data.users.filter(user => user.id !== id);
    this.saveToStorage();
  }

  // Attendance methods
  getAttendanceRecords(employeeId?: string, month?: string, year?: number) {
    let records = this.data.attendanceRecords;
    
    if (employeeId) {
      records = records.filter(record => record.employeeId === employeeId);
    }
    
    if (month && year) {
      records = records.filter(record => {
        const recordDate = new Date(record.date);
        return recordDate.getMonth() === parseInt(month) - 1 && recordDate.getFullYear() === year;
      });
    }
    
    return records;
  }

  addAttendanceRecord(record: any) {
    this.data.attendanceRecords.push(record);
    this.saveToStorage();
    return record;
  }

  updateAttendanceRecord(id: string, updates: any) {
    const recordIndex = this.data.attendanceRecords.findIndex(record => record.id === id);
    if (recordIndex !== -1) {
      this.data.attendanceRecords[recordIndex] = { ...this.data.attendanceRecords[recordIndex], ...updates };
      this.saveToStorage();
      return this.data.attendanceRecords[recordIndex];
    }
    return null;
  }

  // Leave methods
  getLeaveRequests(employeeId?: string) {
    if (employeeId) {
      return this.data.leaveRequests.filter(request => request.employeeId === employeeId);
    }
    return this.data.leaveRequests;
  }

  getLeaveBalance(employeeId: string) {
    return this.data.leaveBalances.find(balance => balance.employeeId === employeeId);
  }

  addLeaveRequest(request: any) {
    this.data.leaveRequests.push(request);
    this.saveToStorage();
    return request;
  }

  updateLeaveRequest(id: string, updates: any) {
    const requestIndex = this.data.leaveRequests.findIndex(request => request.id === id);
    if (requestIndex !== -1) {
      this.data.leaveRequests[requestIndex] = { ...this.data.leaveRequests[requestIndex], ...updates };
      this.saveToStorage();
      return this.data.leaveRequests[requestIndex];
    }
    return null;
  }

  updateLeaveBalance(employeeId: string, updates: any) {
    const balanceIndex = this.data.leaveBalances.findIndex(balance => balance.employeeId === employeeId);
    if (balanceIndex !== -1) {
      this.data.leaveBalances[balanceIndex] = { ...this.data.leaveBalances[balanceIndex], ...updates };
      this.saveToStorage();
      return this.data.leaveBalances[balanceIndex];
    }
    return null;
  }

  // Auth token methods
  setAuthToken(token: string, userData: any) {
    this.data.authTokens.set(token, userData);
    this.saveToStorage();
  }

  getAuthToken(token: string) {
    return this.data.authTokens.get(token);
  }

  removeAuthToken(token: string) {
    this.data.authTokens.delete(token);
    this.saveToStorage();
  }

  clearAuthTokens() {
    this.data.authTokens.clear();
    this.saveToStorage();
  }

  // Utility methods
  reset() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    this.data = mockData;
    this.saveToStorage();
  }

  export() {
    return JSON.stringify({
      users: this.data.users,
      attendanceRecords: this.data.attendanceRecords,
      leaveRequests: this.data.leaveRequests,
      leaveBalances: this.data.leaveBalances
    }, null, 2);
  }
}

// Export singleton instance
export const mockStorage = MockStorage.getInstance();