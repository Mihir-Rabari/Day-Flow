// Mock Data Generator for Development

import {
  User,
  AttendanceRecord,
  LeaveRequest,
  LeaveBalance,
  SalaryComponent,
  Deduction,
  UserRole,
  LeaveType,
  LeaveStatus,
  AttendanceStatus
} from '../../types';

// Utility function to generate realistic dates
const generateDate = (daysAgo: number = 0): string => {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().split('T')[0];
};

const generateDateTime = (daysAgo: number = 0, hour: number = 9): string => {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(hour, Math.floor(Math.random() * 60), 0, 0);
  return date.toISOString();
};

// Generate Login ID in format OI[FirstName][LastName][Year][SerialNumber]
const generateLoginId = (firstName: string, lastName: string): string => {
  const year = new Date().getFullYear();
  const serial = Math.floor(Math.random() * 999) + 1;
  return `OI${firstName}${lastName}${year}${serial.toString().padStart(3, '0')}`;
};

// Sample data arrays
const firstNames = ['John', 'Jane', 'Michael', 'Sarah', 'David', 'Emily', 'Robert', 'Lisa', 'James', 'Maria'];
const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez'];
const departments = ['Engineering', 'Marketing', 'Sales', 'HR', 'Finance', 'Operations', 'Design', 'Product'];
const positions = ['Software Engineer', 'Marketing Manager', 'Sales Representative', 'HR Specialist', 'Financial Analyst', 'Operations Manager', 'UI/UX Designer', 'Product Manager'];

// Generate salary components
const generateSalaryComponents = (monthlyWage: number): SalaryComponent[] => {
  const basic = monthlyWage * 0.5;
  return [
    {
      id: 'basic',
      name: 'basic',
      displayName: 'Basic Salary',
      computationType: 'percentage_of_wage',
      value: 50,
      calculatedAmount: basic
    },
    {
      id: 'hra',
      name: 'hra',
      displayName: 'House Rent Allowance',
      computationType: 'percentage_of_basic',
      value: 40,
      calculatedAmount: basic * 0.4
    },
    {
      id: 'standard_allowance',
      name: 'standard_allowance',
      displayName: 'Standard Allowance',
      computationType: 'fixed_amount',
      value: 2000,
      calculatedAmount: 2000
    },
    {
      id: 'performance_bonus',
      name: 'performance_bonus',
      displayName: 'Performance Bonus',
      computationType: 'percentage_of_wage',
      value: 10,
      calculatedAmount: monthlyWage * 0.1
    },
    {
      id: 'lta',
      name: 'lta',
      displayName: 'Leave Travel Allowance',
      computationType: 'fixed_amount',
      value: 1500,
      calculatedAmount: 1500
    },
    {
      id: 'fixed_allowance',
      name: 'fixed_allowance',
      displayName: 'Fixed Allowance',
      computationType: 'fixed_amount',
      value: 1000,
      calculatedAmount: 1000
    }
  ];
};

// Generate deductions
const generateDeductions = (monthlyWage: number): Deduction[] => {
  return [
    {
      id: 'pf',
      name: 'pf',
      displayName: 'Provident Fund',
      rate: 12,
      amount: monthlyWage * 0.12
    },
    {
      id: 'professional_tax',
      name: 'professional_tax',
      displayName: 'Professional Tax',
      rate: 2,
      amount: monthlyWage * 0.02
    }
  ];
};

// Generate a single user
export const generateUser = (role: UserRole = 'employee', index: number = 0): User => {
  const firstName = firstNames[index % firstNames.length];
  const lastName = lastNames[index % lastNames.length];
  const monthlyWage = 50000 + Math.floor(Math.random() * 100000);
  
  return {
    id: `user-${index + 1}`,
    loginId: generateLoginId(firstName, lastName),
    email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@dayflow.com`,
    firstName,
    lastName,
    role,
    profilePicture: `https://api.dicebear.com/7.x/avataaars/svg?seed=${firstName}${lastName}`,
    personalDetails: {
      phone: `+1-555-${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}`,
      address: `${Math.floor(Math.random() * 9999) + 1} Main St, City, State 12345`,
      dateOfBirth: `19${80 + Math.floor(Math.random() * 20)}-${Math.floor(Math.random() * 12) + 1}-${Math.floor(Math.random() * 28) + 1}`,
      emergencyContact: {
        name: `Emergency Contact ${index + 1}`,
        relationship: 'Spouse',
        phone: `+1-555-${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}`
      }
    },
    jobDetails: {
      department: departments[index % departments.length],
      position: positions[index % positions.length],
      joiningDate: generateDate(Math.floor(Math.random() * 365) + 30),
      reportingManager: role === 'employee' ? 'admin-1' : '',
      workingSchedule: {
        type: 'full-time',
        hoursPerWeek: 40,
        workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
      }
    },
    salaryInfo: {
      wageType: 'fixed',
      monthlyWage,
      components: generateSalaryComponents(monthlyWage),
      deductions: generateDeductions(monthlyWage)
    },
    attendanceStatus: {
      current: (['present', 'absent', 'on-leave'] as AttendanceStatus[])[Math.floor(Math.random() * 3)],
      lastCheckIn: generateDateTime(0, 9),
      lastCheckOut: generateDateTime(0, 17)
    }
  };
};

// Generate attendance records for a user
export const generateAttendanceRecords = (employeeId: string, days: number = 30): AttendanceRecord[] => {
  const records: AttendanceRecord[] = [];
  
  for (let i = 0; i < days; i++) {
    const date = generateDate(i);
    const isWeekend = new Date(date).getDay() === 0 || new Date(date).getDay() === 6;
    
    if (!isWeekend && Math.random() > 0.1) { // 90% attendance rate
      const checkInHour = 8 + Math.floor(Math.random() * 2); // 8-9 AM
      const checkOutHour = 17 + Math.floor(Math.random() * 2); // 5-6 PM
      const workingHours = checkOutHour - checkInHour - 1; // Minus 1 hour lunch
      
      records.push({
        id: `attendance-${employeeId}-${date}`,
        employeeId,
        date,
        checkIn: generateDateTime(i, checkInHour),
        checkOut: generateDateTime(i, checkOutHour),
        breakTime: 60, // 1 hour lunch break
        workingHours,
        status: workingHours >= 8 ? 'present' : 'half-day',
        remarks: workingHours < 8 ? 'Half day' : undefined
      });
    }
  }
  
  return records.reverse(); // Most recent first
};

// Generate leave requests for a user
export const generateLeaveRequests = (employeeId: string, count: number = 5): LeaveRequest[] => {
  const requests: LeaveRequest[] = [];
  const leaveTypes: LeaveType[] = ['paid', 'sick', 'unpaid'];
  const statuses: LeaveStatus[] = ['pending', 'approved', 'rejected'];
  
  for (let i = 0; i < count; i++) {
    const startDate = generateDate(Math.floor(Math.random() * 60) + 1);
    const endDate = generateDate(Math.floor(Math.random() * 60) - 5);
    const days = Math.floor(Math.random() * 5) + 1;
    
    requests.push({
      id: `leave-${employeeId}-${i + 1}`,
      employeeId,
      type: leaveTypes[Math.floor(Math.random() * leaveTypes.length)],
      startDate,
      endDate,
      days,
      reason: `Leave request ${i + 1} - Personal reasons`,
      status: statuses[Math.floor(Math.random() * statuses.length)],
      appliedDate: generateDate(Math.floor(Math.random() * 90) + 1),
      approvedBy: Math.random() > 0.5 ? 'admin-1' : undefined,
      approvedDate: Math.random() > 0.5 ? generateDate(Math.floor(Math.random() * 30)) : undefined,
      comments: Math.random() > 0.7 ? 'Approved for personal reasons' : undefined
    });
  }
  
  return requests.sort((a, b) => new Date(b.appliedDate).getTime() - new Date(a.appliedDate).getTime());
};

// Generate leave balance for a user
export const generateLeaveBalance = (employeeId: string): LeaveBalance => {
  return {
    employeeId,
    paidLeave: Math.floor(Math.random() * 15) + 10, // 10-25 days
    sickLeave: Math.floor(Math.random() * 8) + 5, // 5-12 days
    totalUsed: Math.floor(Math.random() * 10) + 2, // 2-12 days used
    year: new Date().getFullYear()
  };
};

// Generate complete mock dataset
export const generateMockData = () => {
  // Create admin user first
  const adminUser = generateUser('admin', 0);
  adminUser.id = 'admin-1';
  adminUser.email = 'admin@dayflow.com';
  adminUser.firstName = 'Admin';
  adminUser.lastName = 'User';
  
  // Create HR officer
  const hrUser = generateUser('hr_officer', 1);
  hrUser.id = 'hr-1';
  hrUser.email = 'hr@dayflow.com';
  hrUser.firstName = 'HR';
  hrUser.lastName = 'Officer';
  
  // Create regular employees
  const employees = Array.from({ length: 8 }, (_, i) => generateUser('employee', i + 2));
  
  const users = [adminUser, hrUser, ...employees];
  
  // Generate attendance records for all users
  const attendanceRecords = users.flatMap(user => 
    generateAttendanceRecords(user.id, 30)
  );
  
  // Generate leave requests for all users
  const leaveRequests = users.flatMap(user => 
    generateLeaveRequests(user.id, Math.floor(Math.random() * 3) + 2)
  );
  
  // Generate leave balances for all users
  const leaveBalances = users.map(user => generateLeaveBalance(user.id));
  
  return {
    users,
    attendanceRecords,
    leaveRequests,
    leaveBalances,
    authTokens: new Map()
  };
};

// Default mock data instance
export const mockData = generateMockData();