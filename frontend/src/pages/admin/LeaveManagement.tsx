import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Search, Filter, CheckCircle2, XCircle } from "lucide-react";

type LeaveStatus = "pending" | "approved" | "rejected";

interface LeaveRequest {
  id: number;
  employee: string;
  employeeId: string;
  department: string;
  type: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: LeaveStatus;
  appliedOn: string;
}

const leaveRequests: LeaveRequest[] = [
  { id: 1, employee: "Sarah Johnson", employeeId: "EMP-002", department: "Marketing", type: "Sick Leave", startDate: "Jan 6, 2026", endDate: "Jan 7, 2026", days: 2, reason: "Medical appointment and recovery", status: "pending", appliedOn: "Jan 3, 2026" },
  { id: 2, employee: "Michael Chen", employeeId: "EMP-003", department: "Engineering", type: "Paid Leave", startDate: "Jan 13, 2026", endDate: "Jan 17, 2026", days: 5, reason: "Annual family vacation abroad", status: "pending", appliedOn: "Jan 2, 2026" },
  { id: 3, employee: "Emily Davis", employeeId: "EMP-004", department: "Human Resources", type: "Unpaid Leave", startDate: "Jan 10, 2026", endDate: "Jan 10, 2026", days: 1, reason: "Personal errands", status: "pending", appliedOn: "Jan 2, 2026" },
  { id: 4, employee: "John Doe", employeeId: "EMP-001", department: "Engineering", type: "Sick Leave", startDate: "Jan 1, 2026", endDate: "Jan 1, 2026", days: 1, reason: "Not feeling well", status: "approved", appliedOn: "Dec 31, 2025" },
  { id: 5, employee: "Robert Wilson", employeeId: "EMP-005", department: "Finance", type: "Paid Leave", startDate: "Dec 24, 2025", endDate: "Dec 26, 2025", days: 3, reason: "Christmas holidays", status: "approved", appliedOn: "Dec 15, 2025" },
  { id: 6, employee: "Lisa Anderson", employeeId: "EMP-006", department: "Engineering", type: "Unpaid Leave", startDate: "Nov 28, 2025", endDate: "Nov 28, 2025", days: 1, reason: "Personal work", status: "rejected", appliedOn: "Nov 20, 2025" },
];

export default function LeaveManagement() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(null);
  const [comment, setComment] = useState("");

  const filteredRequests = leaveRequests.filter(
    (req) =>
      req.employee.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.employeeId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.department.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pendingCount = leaveRequests.filter((r) => r.status === "pending").length;

  const handleAction = () => {
    // In a real app, this would update the backend
    setSelectedRequest(null);
    setActionType(null);
    setComment("");
  };

  return (
    <AppLayout role="admin" userName="HR Admin">
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-semibold">Leave Management</h1>
          <p className="text-sm text-muted-foreground">
            Review and manage employee leave requests
          </p>
        </div>

        {/* Summary */}
        <div className="grid gap-4 md:grid-cols-4">
          <div className="summary-card">
            <p className="text-sm text-muted-foreground">Pending Requests</p>
            <p className="mt-1 text-2xl font-semibold">{pendingCount}</p>
          </div>
          <div className="summary-card">
            <p className="text-sm text-muted-foreground">Approved This Month</p>
            <p className="mt-1 text-2xl font-semibold">24</p>
          </div>
          <div className="summary-card">
            <p className="text-sm text-muted-foreground">Rejected This Month</p>
            <p className="mt-1 text-2xl font-semibold">3</p>
          </div>
          <div className="summary-card">
            <p className="text-sm text-muted-foreground">On Leave Today</p>
            <p className="mt-1 text-2xl font-semibold">8</p>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by employee name, ID, or department..."
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

        {/* Leave Requests Table */}
        <div className="rounded-md border bg-card">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Department</th>
                  <th>Type</th>
                  <th>Duration</th>
                  <th>Days</th>
                  <th>Applied On</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map((request) => (
                  <tr key={request.id}>
                    <td>
                      <div>
                        <p className="font-medium">{request.employee}</p>
                        <p className="text-xs text-muted-foreground">{request.employeeId}</p>
                      </div>
                    </td>
                    <td>{request.department}</td>
                    <td>{request.type}</td>
                    <td>
                      {request.startDate === request.endDate
                        ? request.startDate
                        : `${request.startDate} - ${request.endDate}`}
                    </td>
                    <td>{request.days}</td>
                    <td>{request.appliedOn}</td>
                    <td>
                      <StatusBadge status={request.status} />
                    </td>
                    <td>
                      {request.status === "pending" ? (
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-success hover:text-success hover:bg-success/10"
                            onClick={() => {
                              setSelectedRequest(request);
                              setActionType("approve");
                            }}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => {
                              setSelectedRequest(request);
                              setActionType("reject");
                            }}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Action Dialog */}
        <Dialog open={!!selectedRequest && !!actionType} onOpenChange={() => {
          setSelectedRequest(null);
          setActionType(null);
          setComment("");
        }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {actionType === "approve" ? "Approve" : "Reject"} Leave Request
              </DialogTitle>
            </DialogHeader>
            {selectedRequest && (
              <div className="space-y-4">
                <div className="rounded-md border p-3 text-sm">
                  <p><span className="text-muted-foreground">Employee:</span> {selectedRequest.employee}</p>
                  <p><span className="text-muted-foreground">Type:</span> {selectedRequest.type}</p>
                  <p><span className="text-muted-foreground">Duration:</span> {selectedRequest.startDate} - {selectedRequest.endDate} ({selectedRequest.days} days)</p>
                  <p><span className="text-muted-foreground">Reason:</span> {selectedRequest.reason}</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Comment (optional)</label>
                  <Textarea
                    placeholder="Add a comment for the employee..."
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="flex justify-end gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSelectedRequest(null);
                      setActionType(null);
                      setComment("");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant={actionType === "approve" ? "default" : "destructive"}
                    onClick={handleAction}
                  >
                    {actionType === "approve" ? "Approve" : "Reject"} Request
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
