"use client";

import { useState, type ComponentProps, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { Sprig } from "@/components/auth/illustrations";

// Building blocks for the "Soft Blob" auth screens (welcome, login,
// signup, forgot-password). On phones the screen is one white sheet;
// from sm+ it becomes a rounded card centred on the pastel canvas.

export function AuthScreen({
  back,
  children,
}: {
  /** Where the round back button goes. Omit to hide it. */
  back?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-[100dvh] justify-center bg-card sm:items-center sm:bg-background sm:px-4 sm:py-10">
      <div className="relative flex w-full max-w-md flex-col bg-card px-7 pt-6 pb-8 sm:min-h-0 sm:rounded-[32px] sm:px-10 sm:pt-8 sm:pb-10 sm:shadow-[0_20px_60px_-20px_rgba(30,28,70,0.18)]">
        {back && (
          <Link
            href={back}
            aria-label="Back"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-foreground transition-colors hover:bg-accent"
          >
            <ArrowLeft className="h-[18px] w-[18px]" />
          </Link>
        )}
        {children}
      </div>
    </div>
  );
}

export function AuthHeader({ title, sub }: { title: string; sub?: ReactNode }) {
  return (
    <div className="flex flex-col items-center text-center">
      <Sprig className="mt-2 h-16 w-32" />
      <h1 className="mt-4 text-[28px] leading-tight font-extrabold tracking-[-0.02em] text-foreground">
        {title}
      </h1>
      {sub && <p className="mt-2 text-sm text-muted-foreground">{sub}</p>}
    </div>
  );
}

/** Underline input with a small label; password fields get a show/hide eye. */
export function AuthField({
  label,
  id,
  type = "text",
  ...props
}: { label: string; id: string } & ComponentProps<"input">) {
  const [show, setShow] = useState(false);
  const isPassword = type === "password";
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <div className="flex items-center border-b border-input transition-colors focus-within:border-foreground">
        <input
          id={id}
          type={isPassword && show ? "text" : type}
          className="h-11 w-full min-w-0 bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground/70"
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? "Hide password" : "Show password"}
            className="p-1 text-muted-foreground hover:text-foreground"
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
    </div>
  );
}

export function AuthError({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl bg-pastel-coral/60 px-4 py-3 text-sm text-foreground">
      {children}
    </div>
  );
}

export function AuthFooter({ children }: { children: ReactNode }) {
  return <p className="mt-5 text-center text-sm text-muted-foreground">{children}</p>;
}

