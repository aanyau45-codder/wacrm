"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  AuthError,
  AuthField,
  AuthFooter,
  AuthHeader,
  AuthScreen,
} from "@/components/auth/auth-ui";
import { authButton, authLink } from "@/components/auth/auth-styles";

// `useSearchParams` opts the component out of static prerendering
// unless wrapped in Suspense — same pattern as /login.
export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupPageInner />
    </Suspense>
  );
}

function SignupPageInner() {
  const searchParams = useSearchParams();
  // When the user lands here from `/join/<token>` we carry the
  // invite token in the query so it survives the signup → email
  // verification → redirect round-trip. `emailRedirectTo` below
  // points back at /join/<token> so the user lands on the redeem
  // step after verifying instead of being dropped on /dashboard.
  const inviteToken = searchParams.get("invite");

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const supabase = createClient();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    // If we have an invite token, point Supabase's verification
    // email back at the join page so the user can accept after
    // verifying. Without a token, Supabase uses its default
    // redirect (the app root).
    const emailRedirectTo = inviteToken
      ? `${window.location.origin}/join/${encodeURIComponent(inviteToken)}`
      : undefined;

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
        ...(emailRedirectTo ? { emailRedirectTo } : {}),
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  };

  const loginHref = inviteToken
    ? `/login?invite=${encodeURIComponent(inviteToken)}`
    : "/login";

  if (success) {
    return (
      <AuthScreen back={loginHref}>
        <AuthHeader
          title="Check your email"
          sub={
            <>
              We&apos;ve sent a confirmation link to{" "}
              <span className="font-medium text-foreground">{email}</span>. Click it
              to verify your account.
            </>
          }
        />
        <div className="mt-auto pt-10">
          <Link href={loginHref} className={authButton.outline}>
            Back to log in
          </Link>
        </div>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen back={inviteToken ? loginHref : "/welcome"}>
      <AuthHeader
        title={inviteToken ? "Create account & join" : "Create account"}
        sub={
          inviteToken
            ? "Verify your email, then accept the invitation to join your team."
            : "Get started with Argon CRM."
        }
      />

      <form onSubmit={handleSignup} className="mt-8 flex flex-1 flex-col">
        <div className="flex flex-col gap-5">
          {error && <AuthError>{error}</AuthError>}
          <AuthField
            id="fullName"
            label="Full name"
            placeholder="Jane Doe"
            autoComplete="name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
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
          <AuthField
            id="password"
            type="password"
            label="Password"
            placeholder="At least 6 characters"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <AuthField
            id="confirmPassword"
            type="password"
            label="Confirm password"
            placeholder="Repeat your password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
        </div>

        <div className="mt-auto pt-10">
          <button type="submit" disabled={loading} className={authButton.dark}>
            {loading ? "Creating account..." : "Create account"}
          </button>
          <AuthFooter>
            Already have an account?{" "}
            <Link href={loginHref} className={authLink}>
              Log in
            </Link>
          </AuthFooter>
        </div>
      </form>
    </AuthScreen>
  );
}
