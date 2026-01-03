import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, LogIn, LogOut } from "lucide-react";

type AttendanceStatus = "present" | "absent" | "half-day" | "leave";

interface AttendanceRecord {
  date: string;
  day: string;
  checkIn: string;
  checkOut: string;
  hours: string;
  status: AttendanceStatus;
}

const attendanceData: AttendanceRecord[] = [
  { date: "Jan 3", day: "Friday", checkIn: "9:02 AM", checkOut: "—", hours: "—", status: "present" },
  { date: "Jan 2", day: "Thursday", checkIn: "8:55 AM", checkOut: "6:15 PM", hours: "9h 20m", status: "present" },
  { date: "Jan 1", day: "Wednesday", checkIn: "—", checkOut: "—", hours: "—", status: "leave" },
  { date: "Dec 31", day: "Tuesday", checkIn: "9:10 AM", checkOut: "6:30 PM", hours: "9h 20m", status: "present" },
  { date: "Dec 30", day: "Monday", checkIn: "9:00 AM", checkOut: "1:00 PM", hours: "4h 00m", status: "half-day" },
  { date: "Dec 27", day: "Friday", checkIn: "8:45 AM", checkOut: "6:00 PM", hours: "9h 15m", status: "present" },
  { date: "Dec 26", day: "Thursday", checkIn: "—", checkOut: "—", hours: "—", status: "absent" },
];

export default function Attendance() {
  const [currentWeek] = useState("Jan 1 - Jan 7, 2026");

  return (
    <AppLayout role="employee" userName="John Doe">
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Attendance</h1>
            <p className="text-sm text-muted-foreground">
              Track your daily attendance and working hours
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="gap-2">
              <LogIn className="h-4 w-4" />
              Check In
            </Button>
            <Button variant="outline" className="gap-2">
              <LogOut className="h-4 w-4" />
              Check Out
            </Button>
          </div>
        </div>

        {/* Today's Status */}
        <div className="grid gap-4 md:grid-cols-4">
          <div className="summary-card">
            <p className="text-sm text-muted-foreground">Today's Status</p>
            <div className="mt-2">
              <StatusBadge status="present" />
            </div>
          </div>
          <div className="summary-card">
            <p className="text-sm text-muted-foreground">Check In Time</p>
            <p className="mt-1 text-lg font-semibold">9:02 AM</p>
          </div>
          <div className="summary-card">
            <p className="text-sm text-muted-foreground">Check Out Time</p>
            <p className="mt-1 text-lg font-semibold text-muted-foreground">—</p>
          </div>
          <div className="summary-card">
            <p className="text-sm text-muted-foreground">Hours Today</p>
            <p className="mt-1 text-lg font-semibold">4h 32m</p>
          </div>
        </div>

        {/* Weekly View */}
        <div className="rounded-md border bg-card">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h2 className="font-medium">Weekly View</h2>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium">{currentWeek}</span>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Day</th>
                  <th>Check In</th>
                  <th>Check Out</th>
                  <th>Total Hours</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {attendanceData.map((record, index) => (
                  <tr key={index}>
                    <td className="font-medium">{record.date}</td>
                    <td>{record.day}</td>
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
        </div>

        {/* Monthly Summary */}
        <div className="rounded-md border bg-card p-4">
          <h2 className="mb-4 font-medium">Monthly Summary - January 2026</h2>
          <div className="grid gap-4 md:grid-cols-5">
            <div>
              <p className="text-2xl font-semibold">22</p>
              <p className="text-sm text-muted-foreground">Days Present</p>
            </div>
            <div>
              <p className="text-2xl font-semibold">1</p>
              <p className="text-sm text-muted-foreground">Days Absent</p>
            </div>
            <div>
              <p className="text-2xl font-semibold">1</p>
              <p className="text-sm text-muted-foreground">Half Days</p>
            </div>
            <div>
              <p className="text-2xl font-semibold">1</p>
              <p className="text-sm text-muted-foreground">Leave Days</p>
            </div>
            <div>
              <p className="text-2xl font-semibold">176h</p>
              <p className="text-sm text-muted-foreground">Total Hours</p>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
