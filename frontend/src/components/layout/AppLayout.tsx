import { AppSidebar } from "./AppSidebar";
import { AppHeader } from "./AppHeader";

interface AppLayoutProps {
  children: React.ReactNode;
  role: "employee" | "admin";
  userName?: string;
}

export function AppLayout({ children, role, userName = "John Doe" }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <AppSidebar role={role} />
      <div className="pl-60">
        <AppHeader userName={userName} role={role} />
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
