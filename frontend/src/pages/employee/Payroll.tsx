import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Download, FileText } from "lucide-react";

interface PaySlip {
  id: number;
  month: string;
  year: number;
  basicSalary: number;
  allowances: number;
  deductions: number;
  netSalary: number;
  status: "paid" | "pending";
}

const paySlips: PaySlip[] = [
  { id: 1, month: "December", year: 2025, basicSalary: 8500, allowances: 1500, deductions: 1200, netSalary: 8800, status: "paid" },
  { id: 2, month: "November", year: 2025, basicSalary: 8500, allowances: 1500, deductions: 1200, netSalary: 8800, status: "paid" },
  { id: 3, month: "October", year: 2025, basicSalary: 8500, allowances: 1500, deductions: 1200, netSalary: 8800, status: "paid" },
  { id: 4, month: "September", year: 2025, basicSalary: 8500, allowances: 1500, deductions: 1200, netSalary: 8800, status: "paid" },
  { id: 5, month: "August", year: 2025, basicSalary: 8000, allowances: 1400, deductions: 1100, netSalary: 8300, status: "paid" },
  { id: 6, month: "July", year: 2025, basicSalary: 8000, allowances: 1400, deductions: 1100, netSalary: 8300, status: "paid" },
];

export default function Payroll() {
  return (
    <AppLayout role="employee" userName="John Doe">
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-semibold">Payroll</h1>
          <p className="text-sm text-muted-foreground">
            View your salary details and download pay slips
          </p>
        </div>

        {/* Salary Summary */}
        <div className="grid gap-4 md:grid-cols-4">
          <div className="summary-card">
            <p className="text-sm text-muted-foreground">Basic Salary</p>
            <p className="mt-1 text-2xl font-semibold">$8,500</p>
            <p className="text-xs text-muted-foreground">per month</p>
          </div>
          <div className="summary-card">
            <p className="text-sm text-muted-foreground">Allowances</p>
            <p className="mt-1 text-2xl font-semibold">$1,500</p>
            <p className="text-xs text-muted-foreground">HRA, Transport, etc.</p>
          </div>
          <div className="summary-card">
            <p className="text-sm text-muted-foreground">Deductions</p>
            <p className="mt-1 text-2xl font-semibold">$1,200</p>
            <p className="text-xs text-muted-foreground">Tax, Insurance, etc.</p>
          </div>
          <div className="summary-card">
            <p className="text-sm text-muted-foreground">Net Salary</p>
            <p className="mt-1 text-2xl font-semibold">$8,800</p>
            <p className="text-xs text-muted-foreground">take-home pay</p>
          </div>
        </div>

        {/* Current Month Breakdown */}
        <div className="rounded-md border bg-card">
          <div className="border-b px-4 py-3">
            <h2 className="font-medium">December 2025 Breakdown</h2>
          </div>
          <div className="p-4">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Earnings */}
              <div>
                <h3 className="mb-3 text-sm font-medium text-muted-foreground">Earnings</h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Basic Salary</span>
                    <span className="font-medium">$8,500.00</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>House Rent Allowance</span>
                    <span className="font-medium">$800.00</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Transport Allowance</span>
                    <span className="font-medium">$400.00</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Medical Allowance</span>
                    <span className="font-medium">$300.00</span>
                  </div>
                  <div className="flex justify-between border-t pt-2 text-sm font-medium">
                    <span>Gross Earnings</span>
                    <span>$10,000.00</span>
                  </div>
                </div>
              </div>

              {/* Deductions */}
              <div>
                <h3 className="mb-3 text-sm font-medium text-muted-foreground">Deductions</h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Income Tax</span>
                    <span className="font-medium">$850.00</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Health Insurance</span>
                    <span className="font-medium">$200.00</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Retirement Fund</span>
                    <span className="font-medium">$150.00</span>
                  </div>
                  <div className="flex justify-between border-t pt-2 text-sm font-medium">
                    <span>Total Deductions</span>
                    <span>$1,200.00</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between rounded-md bg-muted p-4">
              <div>
                <p className="text-sm text-muted-foreground">Net Pay</p>
                <p className="text-2xl font-semibold">$8,800.00</p>
              </div>
              <Button className="gap-2">
                <Download className="h-4 w-4" />
                Download Slip
              </Button>
            </div>
          </div>
        </div>

        {/* Pay Slip History */}
        <div className="rounded-md border bg-card">
          <div className="border-b px-4 py-3">
            <h2 className="font-medium">Pay Slip History</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Basic</th>
                  <th>Allowances</th>
                  <th>Deductions</th>
                  <th>Net Salary</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {paySlips.map((slip) => (
                  <tr key={slip.id}>
                    <td className="font-medium">{slip.month} {slip.year}</td>
                    <td>${slip.basicSalary.toLocaleString()}</td>
                    <td>${slip.allowances.toLocaleString()}</td>
                    <td>${slip.deductions.toLocaleString()}</td>
                    <td className="font-medium">${slip.netSalary.toLocaleString()}</td>
                    <td>
                      <span className="inline-flex items-center rounded bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
                        Paid
                      </span>
                    </td>
                    <td>
                      <Button variant="ghost" size="sm" className="gap-1 text-primary">
                        <FileText className="h-4 w-4" />
                        View
                      </Button>
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
