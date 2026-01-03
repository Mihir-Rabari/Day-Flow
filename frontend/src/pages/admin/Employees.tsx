import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Filter, MoreHorizontal, Mail, Phone } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNavigate } from "react-router-dom";

interface Employee {
  id: string;
  name: string;
  email: string;
  phone: string;
  department: string;
  designation: string;
  joinDate: string;
  status: "active" | "inactive";
}

const employees: Employee[] = [
  { id: "EMP-001", name: "John Doe", email: "john.doe@company.com", phone: "+1 234-567-8901", department: "Engineering", designation: "Senior Developer", joinDate: "Jan 15, 2023", status: "active" },
  { id: "EMP-002", name: "Sarah Johnson", email: "sarah.j@company.com", phone: "+1 234-567-8902", department: "Marketing", designation: "Marketing Manager", joinDate: "Mar 22, 2022", status: "active" },
  { id: "EMP-003", name: "Michael Chen", email: "m.chen@company.com", phone: "+1 234-567-8903", department: "Engineering", designation: "Tech Lead", joinDate: "Jun 10, 2021", status: "active" },
  { id: "EMP-004", name: "Emily Davis", email: "emily.d@company.com", phone: "+1 234-567-8904", department: "Human Resources", designation: "HR Specialist", joinDate: "Sep 5, 2023", status: "active" },
  { id: "EMP-005", name: "Robert Wilson", email: "r.wilson@company.com", phone: "+1 234-567-8905", department: "Finance", designation: "Financial Analyst", joinDate: "Feb 18, 2022", status: "inactive" },
  { id: "EMP-006", name: "Lisa Anderson", email: "lisa.a@company.com", phone: "+1 234-567-8906", department: "Engineering", designation: "Junior Developer", joinDate: "Nov 30, 2024", status: "active" },
  { id: "EMP-007", name: "David Brown", email: "d.brown@company.com", phone: "+1 234-567-8907", department: "Sales", designation: "Sales Executive", joinDate: "Jul 12, 2023", status: "active" },
  { id: "EMP-008", name: "Jennifer Taylor", email: "j.taylor@company.com", phone: "+1 234-567-8908", department: "Operations", designation: "Operations Manager", joinDate: "Apr 3, 2021", status: "active" },
];

export default function Employees() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");

  const filteredEmployees = employees.filter(
    (emp) =>
      emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.department.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AppLayout role="admin" userName="HR Admin">
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Employees</h1>
            <p className="text-sm text-muted-foreground">
              Manage and view all employee records
            </p>
          </div>
          <Button>Add Employee</Button>
        </div>

        {/* Search and Filter */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, ID, or department..."
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

        {/* Employees Table */}
        <div className="rounded-md border bg-card">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee ID</th>
                  <th>Name</th>
                  <th>Department</th>
                  <th>Designation</th>
                  <th>Contact</th>
                  <th>Join Date</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map((employee) => (
                  <tr key={employee.id}>
                    <td className="font-medium">{employee.id}</td>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-medium">
                          {employee.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </div>
                        <div>
                          <p className="font-medium">{employee.name}</p>
                          <p className="text-xs text-muted-foreground">{employee.email}</p>
                        </div>
                      </div>
                    </td>
                    <td>{employee.department}</td>
                    <td>{employee.designation}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <button className="p-1 text-muted-foreground hover:text-foreground">
                          <Mail className="h-4 w-4" />
                        </button>
                        <button className="p-1 text-muted-foreground hover:text-foreground">
                          <Phone className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                    <td>{employee.joinDate}</td>
                    <td>
                      <span
                        className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${
                          employee.status === "active"
                            ? "bg-success/10 text-success"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {employee.status === "active" ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/admin/employees/${employee.id}`)}>
                            View Profile
                          </DropdownMenuItem>
                          <DropdownMenuItem>Edit Details</DropdownMenuItem>
                          <DropdownMenuItem>View Attendance</DropdownMenuItem>
                          <DropdownMenuItem>View Payroll</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between border-t px-4 py-3">
            <p className="text-sm text-muted-foreground">
              Showing {filteredEmployees.length} of {employees.length} employees
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
