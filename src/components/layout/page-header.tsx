import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// Airy page title: small uppercase kicker, big heavy title, muted line
// under it, actions on the right (they wrap below on narrow phones).
export function PageHeader({
  kicker,
  title,
  subtitle,
  actions,
  className,
}: {
  kicker?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-6 flex flex-wrap items-end justify-between gap-x-4 gap-y-3", className)}>
      <div className="min-w-0">
        {kicker ? (
          <p className="text-xs font-bold tracking-[0.06em] text-muted-foreground uppercase">{kicker}</p>
        ) : null}
        <h1 className="mt-1 text-[28px] leading-[1.1] font-extrabold tracking-[-0.02em] text-foreground sm:text-[30px]">
          {title}
        </h1>
        {subtitle ? <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
