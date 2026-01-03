export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: ValidationError[];
  pagination?: PaginationInfo;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

export enum UserRole {
  EMPLOYEE = 'employee',
  HR_OFFICER = 'hr_officer',
  ADMIN = 'admin',
}

export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
  loginId: string;
  iat: number;
  exp: number;
}

export interface AuthResponse {
  token: string;
  refreshToken: string;
  user: UserProfile;
  expiresIn: number;
}

export interface UserProfile {
  id: string;
  loginId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
  profilePicture?: string;
}

export interface LoginCredentials {
  loginId: string;
  password: string;
}

// Request types
export interface PaginationOptions {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationInfo;
}

// Employee related types
export interface PersonalDetails {
  phone?: string;
  address?: string;
  dateOfBirth?: Date;
  emergencyContact?: {
    name: string;
    relationship: string;
    phone: string;
  };
}

export interface JobDetails {
  department: string;
  position: string;
  joiningDate: Date;
  reportingManager?: string;
  workingSchedule: {
    startTime: string;
    endTime: string;
    workingDays: string[];
    breakDuration: number; // in minutes
  };
}

export interface SalaryInfo {
  monthlyWage: number;
}

export interface CreateEmployeeRequest {
  firstName: string;
  lastName: string;
  email: string;
  personalDetails: PersonalDetails;
  jobDetails: JobDetails;
  salaryInfo: SalaryInfo;
  role?: UserRole;
}

export interface UpdateEmployeeRequest {
  firstName?: string;
  lastName?: string;
  email?: string;
  personalDetails?: Partial<PersonalDetails>;
  jobDetails?: Partial<JobDetails>;
  salaryInfo?: Partial<SalaryInfo>;
  role?: UserRole;
  isActive?: boolean;
  profilePicture?: string;
}

export interface EmployeeFilters {
  department?: string;
  position?: string;
  role?: UserRole;
  isActive?: boolean;
  joiningDateFrom?: Date;
  joiningDateTo?: Date;
  search?: string; // Search in name, email, loginId
}

export interface Employee {
  id: string;
  loginId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
  profilePicture?: string;
  phone?: string;
  address?: string;
  dateOfBirth?: Date;
  emergencyContact?: any;
  department: string;
  position: string;
  joiningDate: Date;
  reportingManager?: string;
  workingSchedule: any;
  monthlyWage: number;
  createdAt: Date;
  updatedAt: Date;
}

// Attendance related types
export enum AttendanceStatus {
  PRESENT = 'PRESENT',
  ABSENT = 'ABSENT',
  HALF_DAY = 'HALF_DAY',
  LEAVE = 'LEAVE',
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  date: Date;
  checkIn?: Date;
  checkOut?: Date;
  workingHours: number;
  breakTime: number; // in minutes
  status: AttendanceStatus;
  remarks?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AttendanceFilters {
  employeeId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  status?: AttendanceStatus;
  department?: string;
}

export interface AttendanceReport {
  employeeId: string;
  employeeName: string;
  department: string;
  totalDays: number;
  presentDays: number;
  absentDays: number;
  halfDays: number;
  leaveDays: number;
  totalWorkingHours: number;
  averageWorkingHours: number;
}

export interface CheckInRequest {
  remarks?: string;
}

export interface CheckOutRequest {
  remarks?: string;
}

export interface Break {
  startTime: Date;
  endTime: Date;
  duration: number; // in minutes
}

// Leave related types
export enum LeaveType {
  PAID = 'PAID',
  SICK = 'SICK',
  UNPAID = 'UNPAID',
  CASUAL = 'CASUAL',
  MATERNITY = 'MATERNITY',
  PATERNITY = 'PATERNITY',
}

export enum LeaveStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  type: LeaveType;
  startDate: Date;
  endDate: Date;
  days: number;
  reason: string;
  status: LeaveStatus;
  appliedDate: Date;
  approvedBy?: string;
  approvedDate?: Date;
  comments?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateLeaveRequest {
  type: LeaveType;
  startDate: Date;
  endDate: Date;
  reason: string;
  halfDay?: boolean;
}

export interface UpdateLeaveRequest {
  status: LeaveStatus;
  comments?: string;
  approvedBy?: string;
}

export interface LeaveFilters {
  employeeId?: string;
  type?: LeaveType;
  status?: LeaveStatus;
  startDate?: Date;
  endDate?: Date;
  appliedDateFrom?: Date;
  appliedDateTo?: Date;
  approvedBy?: string;
}

export interface LeaveBalance {
  employeeId: string;
  year: number;
  totalPaidLeave: number;
  usedPaidLeave: number;
  remainingPaidLeave: number;
  totalSickLeave: number;
  usedSickLeave: number;
  remainingSickLeave: number;
  totalCasualLeave: number;
  usedCasualLeave: number;
  remainingCasualLeave: number;
}

export interface LeaveReport {
  employeeId: string;
  employeeName: string;
  department: string;
  totalLeavesTaken: number;
  paidLeavesTaken: number;
  sickLeavesTaken: number;
  casualLeavesTaken: number;
  unpaidLeavesTaken: number;
  pendingRequests: number;
}

// Salary related types
export enum ComponentType {
  BASIC = 'BASIC',
  HRA = 'HRA',
  STANDARD_ALLOWANCE = 'STANDARD_ALLOWANCE',
  PERFORMANCE_BONUS = 'PERFORMANCE_BONUS',
  LTA = 'LTA',
  FIXED_ALLOWANCE = 'FIXED_ALLOWANCE',
  PF_DEDUCTION = 'PF_DEDUCTION',
  PROFESSIONAL_TAX = 'PROFESSIONAL_TAX',
}

export enum ComputationType {
  FIXED_AMOUNT = 'FIXED_AMOUNT',
  PERCENTAGE_OF_WAGE = 'PERCENTAGE_OF_WAGE',
  PERCENTAGE_OF_BASIC = 'PERCENTAGE_OF_BASIC',
}

export interface SalaryComponent {
  id: string;
  employeeId: string;
  name: ComponentType;
  displayName: string;
  computationType: ComputationType;
  value: number; // percentage or fixed amount
  calculatedAmount: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface SalaryCalculation {
  basicSalary: number;
  allowances: Allowance[];
  deductions: Deduction[];
  grossSalary: number;
  netSalary: number;
  totalAllowances: number;
  totalDeductions: number;
}

export interface Allowance {
  name: ComponentType;
  displayName: string;
  amount: number;
  computationType: ComputationType;
  value: number;
}

export interface Deduction {
  name: ComponentType;
  displayName: string;
  amount: number;
  computationType: ComputationType;
  value: number;
}

export interface SalaryStructure {
  monthlyWage: number;
  components: SalaryComponentInput[];
}

export interface SalaryComponentInput {
  name: ComponentType;
  displayName: string;
  computationType: ComputationType;
  value: number;
  isActive?: boolean;
}

export interface UpdateSalaryStructureRequest {
  monthlyWage?: number;
  components?: SalaryComponentInput[];
}

export interface Payslip {
  employeeId: string;
  employeeName: string;
  loginId: string;
  department: string;
  position: string;
  month: number;
  year: number;
  monthlyWage: number;
  salaryCalculation: SalaryCalculation;
  generatedDate: Date;
}
