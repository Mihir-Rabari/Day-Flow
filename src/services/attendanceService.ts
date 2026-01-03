import {
  PrismaClient,
  AttendanceStatus as PrismaAttendanceStatus,
} from '@prisma/client';
import {
  AttendanceRecord,
  AttendanceFilters,
  AttendanceReport,
  AttendanceStatus,
  CheckInRequest,
  CheckOutRequest,
  Break,
  PaginatedResponse,
  PaginationOptions,
} from '../types';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export class AttendanceService {
  /**
   * Check in an employee for the current date
   */
  async checkIn(
    employeeId: string,
    request: CheckInRequest = {}
  ): Promise<AttendanceRecord> {
    try {
      // Validate input
      if (
        !employeeId ||
        typeof employeeId !== 'string' ||
        employeeId.trim().length === 0
      ) {
        throw new Error('Invalid employee ID provided');
      }

      const cleanEmployeeId = employeeId.trim();
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Check if employee exists
      const employee = await prisma.employee.findUnique({
        where: { id: cleanEmployeeId, isActive: true },
      });

      if (!employee) {
        throw new Error('Employee not found or inactive');
      }

      // Check if already checked in today
      const existingRecord = await prisma.attendanceRecord.findUnique({
        where: {
          employeeId_date: {
            employeeId: cleanEmployeeId,
            date: today,
          },
        },
      });

      if (existingRecord?.checkIn) {
        throw new Error('Employee already checked in today');
      }

      const checkInTime = new Date();

      // Create or update attendance record
      const attendanceRecord = existingRecord
        ? await prisma.attendanceRecord.update({
            where: { id: existingRecord.id },
            data: {
              checkIn: checkInTime,
              status: PrismaAttendanceStatus.PRESENT,
              remarks: request.remarks,
              updatedAt: new Date(),
            },
          })
        : await prisma.attendanceRecord.create({
            data: {
              employeeId: cleanEmployeeId,
              date: today,
              checkIn: checkInTime,
              status: PrismaAttendanceStatus.PRESENT,
              remarks: request.remarks,
            },
          });

      logger.info(`Employee ${cleanEmployeeId} checked in at ${checkInTime}`);

      return this.mapPrismaToAttendanceRecord(attendanceRecord);
    } catch (error) {
      logger.error('Error during check-in:', error);
      throw error;
    }
  }

  /**
   * Check out an employee for the current date
   */
  async checkOut(
    employeeId: string,
    request: CheckOutRequest = {}
  ): Promise<AttendanceRecord> {
    try {
      // Validate input
      if (
        !employeeId ||
        typeof employeeId !== 'string' ||
        employeeId.trim().length === 0
      ) {
        throw new Error('Invalid employee ID provided');
      }

      const cleanEmployeeId = employeeId.trim();
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Find today's attendance record
      const existingRecord = await prisma.attendanceRecord.findUnique({
        where: {
          employeeId_date: {
            employeeId: cleanEmployeeId,
            date: today,
          },
        },
      });

      if (!existingRecord) {
        throw new Error('No check-in record found for today');
      }

      if (!existingRecord.checkIn) {
        throw new Error('Employee has not checked in today');
      }

      if (existingRecord.checkOut) {
        throw new Error('Employee already checked out today');
      }

      const checkOutTime = new Date();
      const workingHours = this.calculateWorkingHours(
        existingRecord.checkIn,
        checkOutTime,
        []
      );

      const status = this.determineAttendanceStatus(workingHours);

      // Update attendance record
      const attendanceRecord = await prisma.attendanceRecord.update({
        where: { id: existingRecord.id },
        data: {
          checkOut: checkOutTime,
          workingHours,
          status,
          remarks: request.remarks || existingRecord.remarks,
          updatedAt: new Date(),
        },
      });

      logger.info(
        `Employee ${cleanEmployeeId} checked out at ${checkOutTime}, worked ${workingHours} hours`
      );

      return this.mapPrismaToAttendanceRecord(attendanceRecord);
    } catch (error) {
      logger.error('Error during check-out:', error);
      throw error;
    }
  }

  /**
   * Get attendance records with filtering and pagination
   */
  async getAttendance(
    filters: AttendanceFilters,
    pagination?: PaginationOptions
  ): Promise<PaginatedResponse<AttendanceRecord>> {
    try {
      const where: any = {};

      if (filters.employeeId) {
        where.employeeId = filters.employeeId;
      }

      if (filters.dateFrom || filters.dateTo) {
        where.date = {};
        if (filters.dateFrom) {
          where.date.gte = filters.dateFrom;
        }
        if (filters.dateTo) {
          where.date.lte = filters.dateTo;
        }
      }

      if (filters.status) {
        where.status = this.mapAttendanceStatusToPrisma(filters.status);
      }

      if (filters.department) {
        where.employee = {
          department: filters.department,
        };
      }

      const include = {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            loginId: true,
            department: true,
          },
        },
      };

      if (pagination) {
        const {
          page = 1,
          limit = 10,
          sortBy = 'date',
          sortOrder = 'desc',
        } = pagination;
        const skip = (page - 1) * limit;

        const [records, total] = await Promise.all([
          prisma.attendanceRecord.findMany({
            where,
            include,
            skip,
            take: limit,
            orderBy: { [sortBy]: sortOrder },
          }),
          prisma.attendanceRecord.count({ where }),
        ]);

        return {
          data: records.map(record => this.mapPrismaToAttendanceRecord(record)),
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        };
      } else {
        const records = await prisma.attendanceRecord.findMany({
          where,
          include,
          orderBy: { date: 'desc' },
        });

        return {
          data: records.map(record => this.mapPrismaToAttendanceRecord(record)),
          pagination: {
            page: 1,
            limit: records.length,
            total: records.length,
            totalPages: 1,
          },
        };
      }
    } catch (error) {
      logger.error('Error fetching attendance records:', error);
      throw error;
    }
  }

  /**
   * Get attendance report for employees
   */
  async getAttendanceReport(
    filters: AttendanceFilters
  ): Promise<AttendanceReport[]> {
    try {
      const where: any = {};

      if (filters.employeeId) {
        where.employeeId = filters.employeeId;
      }

      if (filters.dateFrom || filters.dateTo) {
        where.date = {};
        if (filters.dateFrom) {
          where.date.gte = filters.dateFrom;
        }
        if (filters.dateTo) {
          where.date.lte = filters.dateTo;
        }
      }

      if (filters.department) {
        where.employee = {
          department: filters.department,
        };
      }

      const records = await prisma.attendanceRecord.findMany({
        where,
        include: {
          employee: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              department: true,
            },
          },
        },
      });

      // Group records by employee
      const employeeRecords = records.reduce((acc, record) => {
        const employeeId = record.employeeId;
        if (!acc[employeeId]) {
          acc[employeeId] = {
            employee: record.employee,
            records: [],
          };
        }
        acc[employeeId].records.push(record);
        return acc;
      }, {} as any);

      // Generate report for each employee
      const reports: AttendanceReport[] = Object.values(employeeRecords).map(
        (data: any) => {
          const { employee, records } = data;
          const totalDays = records.length;
          const presentDays = records.filter(
            (r: any) => r.status === PrismaAttendanceStatus.PRESENT
          ).length;
          const absentDays = records.filter(
            (r: any) => r.status === PrismaAttendanceStatus.ABSENT
          ).length;
          const halfDays = records.filter(
            (r: any) => r.status === PrismaAttendanceStatus.HALF_DAY
          ).length;
          const leaveDays = records.filter(
            (r: any) => r.status === PrismaAttendanceStatus.LEAVE
          ).length;

          const totalWorkingHours = records.reduce((sum: number, r: any) => {
            return (
              sum + (r.workingHours ? parseFloat(r.workingHours.toString()) : 0)
            );
          }, 0);

          const averageWorkingHours =
            totalDays > 0 ? totalWorkingHours / totalDays : 0;

          return {
            employeeId: employee.id,
            employeeName: `${employee.firstName} ${employee.lastName}`,
            department: employee.department,
            totalDays,
            presentDays,
            absentDays,
            halfDays,
            leaveDays,
            totalWorkingHours,
            averageWorkingHours,
          };
        }
      );

      return reports;
    } catch (error) {
      logger.error('Error generating attendance report:', error);
      throw error;
    }
  }

  /**
   * Get current attendance status for an employee
   */
  async getCurrentStatus(employeeId: string): Promise<AttendanceRecord | null> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const record = await prisma.attendanceRecord.findUnique({
        where: {
          employeeId_date: {
            employeeId,
            date: today,
          },
        },
      });

      return record ? this.mapPrismaToAttendanceRecord(record) : null;
    } catch (error) {
      logger.error('Error fetching current attendance status:', error);
      throw error;
    }
  }

  /**
   * Calculate working hours between check-in and check-out
   */
  calculateWorkingHours(
    checkIn: Date,
    checkOut: Date,
    breaks: Break[] = []
  ): number {
    const totalMinutes = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60);
    const breakMinutes = breaks.reduce(
      (total, breakItem) => total + breakItem.duration,
      0
    );
    const workingMinutes = Math.max(0, totalMinutes - breakMinutes);

    return Math.round((workingMinutes / 60) * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Determine attendance status based on working hours
   */
  determineAttendanceStatus(workingHours: number): PrismaAttendanceStatus {
    if (workingHours >= 8) {
      return PrismaAttendanceStatus.PRESENT;
    } else if (workingHours >= 4) {
      return PrismaAttendanceStatus.HALF_DAY;
    } else {
      return PrismaAttendanceStatus.ABSENT;
    }
  }

  /**
   * Map Prisma attendance record to our type
   */
  private mapPrismaToAttendanceRecord(record: any): AttendanceRecord {
    return {
      id: record.id,
      employeeId: record.employeeId,
      date: record.date,
      checkIn: record.checkIn,
      checkOut: record.checkOut,
      workingHours: record.workingHours
        ? parseFloat(record.workingHours.toString())
        : 0,
      breakTime: record.breakTime,
      status: this.mapPrismaAttendanceStatusToEnum(record.status),
      remarks: record.remarks,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  /**
   * Map our AttendanceStatus enum to Prisma enum
   */
  private mapAttendanceStatusToPrisma(
    status: AttendanceStatus
  ): PrismaAttendanceStatus {
    switch (status) {
      case AttendanceStatus.PRESENT:
        return PrismaAttendanceStatus.PRESENT;
      case AttendanceStatus.ABSENT:
        return PrismaAttendanceStatus.ABSENT;
      case AttendanceStatus.HALF_DAY:
        return PrismaAttendanceStatus.HALF_DAY;
      case AttendanceStatus.LEAVE:
        return PrismaAttendanceStatus.LEAVE;
      default:
        return PrismaAttendanceStatus.ABSENT;
    }
  }

  /**
   * Map Prisma AttendanceStatus to our enum
   */
  private mapPrismaAttendanceStatusToEnum(
    status: PrismaAttendanceStatus
  ): AttendanceStatus {
    switch (status) {
      case PrismaAttendanceStatus.PRESENT:
        return AttendanceStatus.PRESENT;
      case PrismaAttendanceStatus.ABSENT:
        return AttendanceStatus.ABSENT;
      case PrismaAttendanceStatus.HALF_DAY:
        return AttendanceStatus.HALF_DAY;
      case PrismaAttendanceStatus.LEAVE:
        return AttendanceStatus.LEAVE;
      default:
        return AttendanceStatus.ABSENT;
    }
  }
}

export const attendanceService = new AttendanceService();
