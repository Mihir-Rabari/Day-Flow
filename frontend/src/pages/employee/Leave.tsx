import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";

type LeaveStatus = "pending" | "approved" | "rejected";

interface LeaveRequest {
  id: number;
  type: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: LeaveStatus;
  appliedOn: string;
}

const leaveRequests: LeaveRequest[] = [
  { id: 1, type: "Paid Leave", startDate: "Jan 15, 2026", endDate: "Jan 17, 2026", days: 3, reason: "Family vacation", status: "pending", appliedOn: "Jan 3, 2026" },
  { id: 2, type: "Sick Leave", startDate: "Jan 1, 2026", endDate: "Jan 1, 2026", days: 1, reason: "Not feeling well", status: "approved", appliedOn: "Dec 31, 2025" },
  { id: 3, type: "Paid Leave", startDate: "Dec 24, 2025", endDate: "Dec 26, 2025", days: 3, reason: "Christmas holidays", status: "approved", appliedOn: "Dec 15, 2025" },
  { id: 4, type: "Unpaid Leave", startDate: "Nov 28, 2025", endDate: "Nov 28, 2025", days: 1, reason: "Personal work", status: "rejected", appliedOn: "Nov 20, 2025" },
];

const leaveBalance = {
  paid: 12,
  sick: 6,
  unpaid: "Unlimited",
};

export default function Leave() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    type: "",
    startDate: "",
    endDate: "",
    reason: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsDialogOpen(false);
    setFormData({ type: "", startDate: "", endDate: "", reason: "" });
  };

  return (
    <AppLayout role="employee" userName="John Doe">
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Leave Requests</h1>
            <p className="text-sm text-muted-foreground">
              Apply for leave and track your requests
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Apply for Leave
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Apply for Leave</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="leaveType">Leave Type</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) => setFormData({ ...formData, type: value })}
                  >
                    <SelectTrigger id="leaveType">
                      <SelectValue placeholder="Select leave type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="paid">Paid Leave</SelectItem>
                      <SelectItem value="sick">Sick Leave</SelectItem>
                      <SelectItem value="unpaid">Unpaid Leave</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="startDate">Start Date</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endDate">End Date</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reason">Reason</Label>
                  <Textarea
                    id="reason"
                    placeholder="Enter the reason for your leave"
                    value={formData.reason}
                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                    rows={3}
                  />
                </div>

                <div className="flex justify-end gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit">Submit Request</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Leave Balance */}
        <div className="grid gap-4 md:grid-cols-3">
          <div className="summary-card">
            <p className="text-sm text-muted-foreground">Paid Leave</p>
            <p className="mt-1 text-2xl font-semibold">{leaveBalance.paid}</p>
            <p className="text-xs text-muted-foreground">days remaining</p>
          </div>
          <div className="summary-card">
            <p className="text-sm text-muted-foreground">Sick Leave</p>
            <p className="mt-1 text-2xl font-semibold">{leaveBalance.sick}</p>
            <p className="text-xs text-muted-foreground">days remaining</p>
          </div>
          <div className="summary-card">
            <p className="text-sm text-muted-foreground">Unpaid Leave</p>
            <p className="mt-1 text-2xl font-semibold">{leaveBalance.unpaid}</p>
            <p className="text-xs text-muted-foreground">as per policy</p>
          </div>
        </div>

        {/* Leave Requests Table */}
        <div className="rounded-md border bg-card">
          <div className="border-b px-4 py-3">
            <h2 className="font-medium">Leave History</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Duration</th>
                  <th>Days</th>
                  <th>Reason</th>
                  <th>Applied On</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {leaveRequests.map((request) => (
                  <tr key={request.id}>
                    <td className="font-medium">{request.type}</td>
                    <td>
                      {request.startDate === request.endDate
                        ? request.startDate
                        : `${request.startDate} - ${request.endDate}`}
                    </td>
                    <td>{request.days}</td>
                    <td className="max-w-xs truncate">{request.reason}</td>
                    <td>{request.appliedOn}</td>
                    <td>
                      <StatusBadge status={request.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
