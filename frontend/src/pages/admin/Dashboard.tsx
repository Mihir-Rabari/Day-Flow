import { AppLayout } from "@/components/layout/AppLayout";
import { SummaryCard } from "@/components/ui/summary-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Users, Calendar, ClipboardList, AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

const pendingLeaveRequests = [
  { id: 1, employee: "Sarah Johnson", type: "Sick Leave", days: 2, date: "Jan 6-7, 2026" },
  { id: 2, employee: "Michael Chen", type: "Paid Leave", days: 5, date: "Jan 13-17, 2026" },
  { id: 3, employee: "Emily Davis", type: "Unpaid Leave", days: 1, date: "Jan 10, 2026" },
];

const todayAttendance = [
  { id: 1, employee: "John Doe", checkIn: "9:02 AM", checkOut: "—", status: "present" as const },
  { id: 2, employee: "Sarah Johnson", checkIn: "8:55 AM", checkOut: "—", status: "present" as const },
  { id: 3, employee: "Michael Chen", checkIn: "—", checkOut: "—", status: "absent" as const },
  { id: 4, employee: "Emily Davis", checkIn: "9:15 AM", checkOut: "—", status: "present" as const },
  { id: 5, employee: "Robert Wilson", checkIn: "—", checkOut: "—", status: "leave" as const },
];

export default function AdminDashboard() {
  const navigate = useNavigate();

  return (
    <AppLayout role="admin" userName="HR Admin">
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-semibold">HR Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Overview of employee management and pending actions
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            title="Total Employees"
            value="156"
            subtitle="12 departments"
            icon={<Users className="h-5 w-5 text-muted-foreground" />}
          />
          <SummaryCard
            title="Present Today"
            value="142"
            subtitle="91% attendance rate"
            icon={<Calendar className="h-5 w-5 text-muted-foreground" />}
          />
          <SummaryCard
            title="Pending Leave Requests"
            value="8"
            subtitle="Requires action"
            icon={<ClipboardList className="h-5 w-5 text-muted-foreground" />}
          />
          <SummaryCard
            title="On Leave Today"
            value="14"
            subtitle="9% of workforce"
            icon={<AlertCircle className="h-5 w-5 text-muted-foreground" />}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Pending Leave Requests */}
          <div className="rounded-md border bg-card">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h2 className="font-medium">Pending Leave Requests</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/admin/leave")}
              >
                View All
              </Button>
            </div>
            <div className="divide-y">
              {pendingLeaveRequests.map((request) => (
                <div
                  key={request.id}
                  className="flex items-center justify-between px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium">{request.employee}</p>
                    <p className="text-xs text-muted-foreground">
                      {request.type} • {request.days} day{request.days > 1 ? "s" : ""} • {request.date}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-success hover:text-success hover:bg-success/10">
                      <CheckCircle2 className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10">
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Today's Attendance */}
          <div className="rounded-md border bg-card">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h2 className="font-medium">Today's Attendance</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/admin/attendance")}
              >
                View All
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Check In</th>
                    <th>Check Out</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {todayAttendance.map((record) => (
                    <tr key={record.id}>
                      <td className="font-medium">{record.employee}</td>
                      <td>{record.checkIn}</td>
                      <td>{record.checkOut}</td>
                      <td>
                        <StatusBadge status={record.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
