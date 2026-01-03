import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Camera, Mail, Phone, MapPin, Building2, Briefcase, Calendar } from "lucide-react";

export default function Profile() {
  return (
    <AppLayout role="employee" userName="John Doe">
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-semibold">My Profile</h1>
          <p className="text-sm text-muted-foreground">
            View and update your personal information
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Profile Card */}
          <div className="rounded-md border bg-card p-6 text-center">
            <div className="relative mx-auto h-24 w-24">
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-muted text-2xl font-semibold">
                JD
              </div>
              <button className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Camera className="h-4 w-4" />
              </button>
            </div>
            <h2 className="mt-4 text-lg font-semibold">John Doe</h2>
            <p className="text-sm text-muted-foreground">Senior Developer</p>
            <p className="text-xs text-muted-foreground">EMP-001</p>

            <div className="mt-6 space-y-3 text-left text-sm">
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>john.doe@company.com</span>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>+1 234-567-8901</span>
              </div>
              <div className="flex items-center gap-3">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span>Engineering Department</span>
              </div>
              <div className="flex items-center gap-3">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>New York, USA</span>
              </div>
            </div>
          </div>

          {/* Details Sections */}
          <div className="space-y-6 lg:col-span-2">
            {/* Personal Information */}
            <div className="form-section">
              <h3 className="form-section-title">Personal Information</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input id="firstName" defaultValue="John" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input id="lastName" defaultValue="Doe" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" defaultValue="john.doe@company.com" disabled />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input id="phone" defaultValue="+1 234-567-8901" />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="address">Address</Label>
                  <Input id="address" defaultValue="123 Main Street, New York, NY 10001" />
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <Button>Save Changes</Button>
              </div>
            </div>

            {/* Job Details */}
            <div className="form-section">
              <h3 className="form-section-title">Job Details</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-center gap-3">
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Designation</p>
                    <p className="font-medium">Senior Developer</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Department</p>
                    <p className="font-medium">Engineering</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Join Date</p>
                    <p className="font-medium">January 15, 2023</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Reporting To</p>
                    <p className="font-medium">Michael Chen (Tech Lead)</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Salary Information (Read-only) */}
            <div className="form-section">
              <h3 className="form-section-title">Salary Structure</h3>
              <div className="rounded-md bg-muted/50 p-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Basic Salary</p>
                    <p className="text-lg font-semibold">$8,500</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Allowances</p>
                    <p className="text-lg font-semibold">$1,500</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Gross Salary</p>
                    <p className="text-lg font-semibold">$10,000</p>
                  </div>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Contact HR for any salary-related queries.
                </p>
              </div>
            </div>

            {/* Documents */}
            <div className="form-section">
              <h3 className="form-section-title">Documents</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <p className="text-sm font-medium">Offer Letter</p>
                    <p className="text-xs text-muted-foreground">Uploaded on Jan 15, 2023</p>
                  </div>
                  <Button variant="outline" size="sm">Download</Button>
                </div>
                <div className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <p className="text-sm font-medium">ID Proof</p>
                    <p className="text-xs text-muted-foreground">Uploaded on Jan 15, 2023</p>
                  </div>
                  <Button variant="outline" size="sm">Download</Button>
                </div>
                <div className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <p className="text-sm font-medium">Tax Documents</p>
                    <p className="text-xs text-muted-foreground">Uploaded on Mar 10, 2025</p>
                  </div>
                  <Button variant="outline" size="sm">Download</Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
