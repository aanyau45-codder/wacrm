"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  AuthError,
  AuthField,
  AuthFooter,
  AuthHeader,
  AuthScreen,
} from "@/components/auth/auth-ui";
import { authButton, authLink } from "@/components/auth/auth-styles";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const supabase = createClient();

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  };

  if (success) {
    return (
      <AuthScreen back="/login">
        <AuthHeader
          title="Check your email"
          sub={
            <>
              We&apos;ve sent a password reset link to{" "}
              <span className="font-medium text-foreground">{email}</span>.
            </>
          }
        />
        <div className="mt-auto pt-10">
          <Link href="/login" className={authButton.outline}>
            Back to log in
          </Link>
        </div>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen back="/login">
      <AuthHeader
        title="Reset password"
        sub="Enter your email and we'll send you a reset link."
      />

      <form onSubmit={handleReset} className="mt-8 flex flex-1 flex-col">
        <div className="flex flex-col gap-5">
          {error && <AuthError>{error}</AuthError>}
          <AuthField
            id="email"
            type="email"
            label="Email"
            placeholder="you@example.com"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="mt-auto pt-10">
          <button type="submit" disabled={loading} className={authButton.dark}>
            {loading ? "Sending..." : "Send reset link"}
          </button>
          <AuthFooter>
            Remembered it?{" "}
            <Link href="/login" className={authLink}>
              Log in
            </Link>
          </AuthFooter>
        </div>
      </form>
    </AuthScreen>
  );
}
