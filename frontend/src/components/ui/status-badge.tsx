import { cn } from "@/lib/utils";

type StatusType = "present" | "absent" | "pending" | "approved" | "rejected" | "half-day" | "leave";

interface StatusBadgeProps {
  status: StatusType;
  children?: React.ReactNode;
}

const statusLabels: Record<StatusType, string> = {
  present: "Present",
  absent: "Absent",
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  "half-day": "Half-day",
  leave: "Leave",
};

export function StatusBadge({ status, children }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-2 py-0.5 text-xs font-medium",
        {
          "status-present": status === "present" || status === "approved",
          "status-absent": status === "absent" || status === "rejected",
          "status-pending": status === "pending",
          "status-half-day": status === "half-day",
          "status-leave": status === "leave",
        }
      )}
    >
      {children || statusLabels[status]}
    </span>
  );
}
