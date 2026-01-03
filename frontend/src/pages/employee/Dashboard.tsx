import { AppLayout } from "@/components/layout/AppLayout";
import { SummaryCard } from "@/components/ui/summary-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, ClipboardList, DollarSign, LogIn, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";

const recentActivity = [
  { id: 1, type: "attendance", message: "Checked in at 9:02 AM", date: "Today", status: "present" as const },
  { id: 2, type: "leave", message: "Leave request approved", date: "Jan 2, 2026", status: "approved" as const },
  { id: 3, type: "attendance", message: "Checked out at 6:15 PM", date: "Jan 2, 2026", status: "present" as const },
  { id: 4, type: "payroll", message: "December salary credited", date: "Jan 1, 2026", status: "approved" as const },
];

export default function EmployeeDashboard() {
  const navigate = useNavigate();

  return (
    <AppLayout role="employee" userName="John Doe">
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Welcome back, John</h1>
            <p className="text-sm text-muted-foreground">
              Friday, January 3, 2026
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

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            title="This Month's Attendance"
            value="22 / 23"
            subtitle="Days present"
            icon={<Calendar className="h-5 w-5 text-muted-foreground" />}
          />
          <SummaryCard
            title="Leave Balance"
            value="12"
            subtitle="Days remaining"
            icon={<ClipboardList className="h-5 w-5 text-muted-foreground" />}
          />
          <SummaryCard
            title="Working Hours"
            value="176h"
            subtitle="This month"
            icon={<Clock className="h-5 w-5 text-muted-foreground" />}
          />
          <SummaryCard
            title="Next Payroll"
            value="Jan 31"
            subtitle="28 days away"
            icon={<DollarSign className="h-5 w-5 text-muted-foreground" />}
          />
        </div>

        {/* Quick Actions */}
        <div className="grid gap-4 md:grid-cols-3">
          <button
            onClick={() => navigate("/leave")}
            className="summary-card text-left hover:border-primary/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                <ClipboardList className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">Apply for Leave</p>
                <p className="text-sm text-muted-foreground">Submit a new request</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => navigate("/attendance")}
            className="summary-card text-left hover:border-primary/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">View Attendance</p>
                <p className="text-sm text-muted-foreground">Check your records</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => navigate("/payroll")}
            className="summary-card text-left hover:border-primary/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                <DollarSign className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">Payroll Details</p>
                <p className="text-sm text-muted-foreground">View salary slips</p>
              </div>
            </div>
          </button>
        </div>

        {/* Recent Activity */}
        <div className="rounded-md border bg-card">
          <div className="border-b px-4 py-3">
            <h2 className="font-medium">Recent Activity</h2>
          </div>
          <div className="divide-y">
            {recentActivity.map((activity) => (
              <div
                key={activity.id}
                className="flex items-center justify-between px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                    {activity.type === "attendance" && (
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                    )}
                    {activity.type === "leave" && (
                      <ClipboardList className="h-4 w-4 text-muted-foreground" />
                    )}
                    {activity.type === "payroll" && (
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{activity.message}</p>
                    <p className="text-xs text-muted-foreground">{activity.date}</p>
                  </div>
                </div>
                <StatusBadge status={activity.status} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
