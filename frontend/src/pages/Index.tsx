import { Link } from "react-router-dom";
import { Building2, Users, Calendar, ClipboardList, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Index() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            <span className="text-lg font-semibold">Dayflow</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/auth/signin">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link to="/auth/signup">
              <Button>Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="border-b bg-card">
        <div className="mx-auto max-w-6xl px-6 py-20 text-center">
          <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
            Human Resource Management
            <br />
            Made Simple
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            Streamline your HR operations with Dayflow. Manage employees, track attendance, 
            process leave requests, and handle payroll — all in one place.
          </p>
          <div className="mt-8 flex items-center justify-center gap-4">
            <Link to="/auth/signup">
              <Button size="lg">Start Free Trial</Button>
            </Link>
            <Link to="/auth/signin">
              <Button variant="outline" size="lg">Sign In</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center">
            <h2 className="text-2xl font-semibold">Everything you need to manage HR</h2>
            <p className="mt-2 text-muted-foreground">
              Comprehensive tools for modern HR teams
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-md border bg-card p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <h3 className="mt-4 font-medium">Employee Management</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Maintain comprehensive employee records with profiles, documents, and job details.
              </p>
            </div>

            <div className="rounded-md border bg-card p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
              <h3 className="mt-4 font-medium">Attendance Tracking</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Track check-ins, check-outs, and working hours with real-time attendance monitoring.
              </p>
            </div>

            <div className="rounded-md border bg-card p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                <ClipboardList className="h-5 w-5 text-primary" />
              </div>
              <h3 className="mt-4 font-medium">Leave Management</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Handle leave requests, approvals, and balance tracking with ease.
              </p>
            </div>

            <div className="rounded-md border bg-card p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <h3 className="mt-4 font-medium">Payroll Processing</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Process salaries, generate pay slips, and manage deductions efficiently.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t bg-muted/30 py-16">
        <div className="mx-auto max-w-6xl px-6 text-center">
          <h2 className="text-2xl font-semibold">Ready to streamline your HR?</h2>
          <p className="mt-2 text-muted-foreground">
            Get started with Dayflow today and transform your HR operations.
          </p>
          <Link to="/auth/signup" className="mt-6 inline-block">
            <Button size="lg">Create Free Account</Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              <span>Dayflow</span>
            </div>
            <p>© 2026 Dayflow. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
