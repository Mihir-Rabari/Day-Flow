import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Filter, ChevronLeft, ChevronRight, Download } from "lucide-react";

type AttendanceStatus = "present" | "absent" | "half-day" | "leave";

interface AttendanceRecord {
  id: number;
  employeeId: string;
  employee: string;
  department: string;
  checkIn: string;
  checkOut: string;
  hours: string;
  status: AttendanceStatus;
}

const attendanceData: AttendanceRecord[] = [
  { id: 1, employeeId: "EMP-001", employee: "John Doe", department: "Engineering", checkIn: "9:02 AM", checkOut: "6:15 PM", hours: "9h 13m", status: "present" },
  { id: 2, employeeId: "EMP-002", employee: "Sarah Johnson", department: "Marketing", checkIn: "8:55 AM", checkOut: "6:30 PM", hours: "9h 35m", status: "present" },
  { id: 3, employeeId: "EMP-003", employee: "Michael Chen", department: "Engineering", checkIn: "—", checkOut: "—", hours: "—", status: "absent" },
  { id: 4, employeeId: "EMP-004", employee: "Emily Davis", department: "Human Resources", checkIn: "9:15 AM", checkOut: "6:00 PM", hours: "8h 45m", status: "present" },
  { id: 5, employeeId: "EMP-005", employee: "Robert Wilson", department: "Finance", checkIn: "—", checkOut: "—", hours: "—", status: "leave" },
  { id: 6, employeeId: "EMP-006", employee: "Lisa Anderson", department: "Engineering", checkIn: "9:00 AM", checkOut: "1:00 PM", hours: "4h 00m", status: "half-day" },
  { id: 7, employeeId: "EMP-007", employee: "David Brown", department: "Sales", checkIn: "8:45 AM", checkOut: "6:45 PM", hours: "10h 00m", status: "present" },
  { id: 8, employeeId: "EMP-008", employee: "Jennifer Taylor", department: "Operations", checkIn: "9:10 AM", checkOut: "6:20 PM", hours: "9h 10m", status: "present" },
];

export default function AdminAttendance() {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentDate] = useState("January 3, 2026");

  const filteredData = attendanceData.filter(
    (record) =>
      record.employee.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.employeeId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.department.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const presentCount = attendanceData.filter((r) => r.status === "present").length;
  const absentCount = attendanceData.filter((r) => r.status === "absent").length;
  const leaveCount = attendanceData.filter((r) => r.status === "leave").length;
  const halfDayCount = attendanceData.filter((r) => r.status === "half-day").length;

  return (
    <AppLayout role="admin" userName="HR Admin">
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Attendance Overview</h1>
            <p className="text-sm text-muted-foreground">
              Monitor and manage employee attendance records
            </p>
          </div>
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Export Report
          </Button>
        </div>

        {/* Summary */}
        <div className="grid gap-4 md:grid-cols-4">
          <div className="summary-card">
            <p className="text-sm text-muted-foreground">Present</p>
            <p className="mt-1 text-2xl font-semibold text-success">{presentCount}</p>
          </div>
          <div className="summary-card">
            <p className="text-sm text-muted-foreground">Absent</p>
            <p className="mt-1 text-2xl font-semibold text-destructive">{absentCount}</p>
          </div>
          <div className="summary-card">
            <p className="text-sm text-muted-foreground">On Leave</p>
            <p className="mt-1 text-2xl font-semibold">{leaveCount}</p>
          </div>
          <div className="summary-card">
            <p className="text-sm text-muted-foreground">Half Day</p>
            <p className="mt-1 text-2xl font-semibold text-warning">{halfDayCount}</p>
          </div>
        </div>

        {/* Date Navigation and Search */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium">{currentDate}</span>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex gap-3">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search employees..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button variant="outline" className="gap-2">
              <Filter className="h-4 w-4" />
              Filters
            </Button>
          </div>
        </div>

        {/* Attendance Table */}
        <div className="rounded-md border bg-card">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee ID</th>
                  <th>Employee</th>
                  <th>Department</th>
                  <th>Check In</th>
                  <th>Check Out</th>
                  <th>Total Hours</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((record) => (
                  <tr key={record.id}>
                    <td className="font-medium">{record.employeeId}</td>
                    <td>{record.employee}</td>
                    <td>{record.department}</td>
                    <td>{record.checkIn}</td>
                    <td>{record.checkOut}</td>
                    <td>{record.hours}</td>
                    <td>
                      <StatusBadge status={record.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between border-t px-4 py-3">
            <p className="text-sm text-muted-foreground">
              Showing {filteredData.length} of {attendanceData.length} records
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled>
                Previous
              </Button>
              <Button variant="outline" size="sm">
                Next
              </Button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
