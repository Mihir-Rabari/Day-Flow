import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Filter, Download, FileText, DollarSign } from "lucide-react";

interface PayrollRecord {
  id: number;
  employeeId: string;
  employee: string;
  department: string;
  basicSalary: number;
  allowances: number;
  deductions: number;
  netSalary: number;
  status: "paid" | "pending" | "processing";
}

const payrollData: PayrollRecord[] = [
  { id: 1, employeeId: "EMP-001", employee: "John Doe", department: "Engineering", basicSalary: 8500, allowances: 1500, deductions: 1200, netSalary: 8800, status: "paid" },
  { id: 2, employeeId: "EMP-002", employee: "Sarah Johnson", department: "Marketing", basicSalary: 7500, allowances: 1200, deductions: 1000, netSalary: 7700, status: "paid" },
  { id: 3, employeeId: "EMP-003", employee: "Michael Chen", department: "Engineering", basicSalary: 9500, allowances: 1800, deductions: 1400, netSalary: 9900, status: "processing" },
  { id: 4, employeeId: "EMP-004", employee: "Emily Davis", department: "Human Resources", basicSalary: 6500, allowances: 1000, deductions: 900, netSalary: 6600, status: "paid" },
  { id: 5, employeeId: "EMP-005", employee: "Robert Wilson", department: "Finance", basicSalary: 8000, allowances: 1400, deductions: 1100, netSalary: 8300, status: "pending" },
  { id: 6, employeeId: "EMP-006", employee: "Lisa Anderson", department: "Engineering", basicSalary: 5500, allowances: 800, deductions: 700, netSalary: 5600, status: "paid" },
  { id: 7, employeeId: "EMP-007", employee: "David Brown", department: "Sales", basicSalary: 7000, allowances: 2500, deductions: 1000, netSalary: 8500, status: "paid" },
  { id: 8, employeeId: "EMP-008", employee: "Jennifer Taylor", department: "Operations", basicSalary: 8500, allowances: 1500, deductions: 1200, netSalary: 8800, status: "paid" },
];

export default function AdminPayroll() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMonth] = useState("December 2025");

  const filteredData = payrollData.filter(
    (record) =>
      record.employee.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.employeeId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.department.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalPayroll = payrollData.reduce((sum, r) => sum + r.netSalary, 0);
  const paidCount = payrollData.filter((r) => r.status === "paid").length;
  const pendingCount = payrollData.filter((r) => r.status === "pending" || r.status === "processing").length;

  return (
    <AppLayout role="admin" userName="HR Admin">
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Payroll Management</h1>
            <p className="text-sm text-muted-foreground">
              Manage employee salaries and generate pay slips
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Export
            </Button>
            <Button className="gap-2">
              <DollarSign className="h-4 w-4" />
              Run Payroll
            </Button>
          </div>
        </div>

        {/* Summary */}
        <div className="grid gap-4 md:grid-cols-4">
          <div className="summary-card">
            <p className="text-sm text-muted-foreground">Total Payroll</p>
            <p className="mt-1 text-2xl font-semibold">${totalPayroll.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">{selectedMonth}</p>
          </div>
          <div className="summary-card">
            <p className="text-sm text-muted-foreground">Employees</p>
            <p className="mt-1 text-2xl font-semibold">{payrollData.length}</p>
            <p className="text-xs text-muted-foreground">on payroll</p>
          </div>
          <div className="summary-card">
            <p className="text-sm text-muted-foreground">Paid</p>
            <p className="mt-1 text-2xl font-semibold text-success">{paidCount}</p>
            <p className="text-xs text-muted-foreground">salaries processed</p>
          </div>
          <div className="summary-card">
            <p className="text-sm text-muted-foreground">Pending</p>
            <p className="mt-1 text-2xl font-semibold text-warning">{pendingCount}</p>
            <p className="text-xs text-muted-foreground">requires action</p>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name, ID, or department..."
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

        {/* Payroll Table */}
        <div className="rounded-md border bg-card">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee ID</th>
                  <th>Employee</th>
                  <th>Department</th>
                  <th>Basic</th>
                  <th>Allowances</th>
                  <th>Deductions</th>
                  <th>Net Salary</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((record) => (
                  <tr key={record.id}>
                    <td className="font-medium">{record.employeeId}</td>
                    <td>{record.employee}</td>
                    <td>{record.department}</td>
                    <td>${record.basicSalary.toLocaleString()}</td>
                    <td>${record.allowances.toLocaleString()}</td>
                    <td>${record.deductions.toLocaleString()}</td>
                    <td className="font-medium">${record.netSalary.toLocaleString()}</td>
                    <td>
                      <span
                        className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${
                          record.status === "paid"
                            ? "bg-success/10 text-success"
                            : record.status === "processing"
                            ? "bg-pending/10 text-pending"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                      </span>
                    </td>
                    <td>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" className="h-8 gap-1 text-primary">
                          <FileText className="h-4 w-4" />
                          View
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between border-t px-4 py-3">
            <p className="text-sm text-muted-foreground">
              Showing {filteredData.length} of {payrollData.length} employees
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
