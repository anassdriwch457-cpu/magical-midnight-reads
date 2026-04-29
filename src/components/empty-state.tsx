import type { ReactNode } from "react";
import { SearchX } from "lucide-react";

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center justify-center gap-4 py-16 text-center animate-fade-in">
      <div className="relative">
        <div
          className="absolute inset-0 -z-10 blur-2xl opacity-40"
          style={{ background: "var(--gradient-brand)" }}
          aria-hidden
        />
        <div className="grid h-20 w-20 place-items-center rounded-full border border-border bg-card text-primary shadow-glow">
          {icon ?? <SearchX className="h-9 w-9" />}
        </div>
      </div>
      <div className="space-y-1">
        <h3 className="text-lg font-extrabold tracking-tight">{title}</h3>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
