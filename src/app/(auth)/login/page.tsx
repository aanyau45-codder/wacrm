"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
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
// unless it sits under a Suspense boundary. We split the form into
// a child component so the outer page can prerender the chrome
// (background, card frame) while the form hydrates with the query
// string on the client.
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const searchParams = useSearchParams();
  // Forwarded from `/join/<token>` when the visitor already has an
  // account. After a successful sign-in we send them to the join
  // page to accept rather than to /dashboard.
  const inviteToken = searchParams.get("invite");
  const t = useTranslations("LoginPage");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // Full-page navigation (not router.push) so the browser issues a
    // fresh top-level request that carries the just-written Supabase
    // auth cookies to the middleware gating /dashboard. A soft
    // client-side navigation can reach the protected route before the
    // server observes the new session, so the middleware bounces it
    // back to /login — which looks like the page "just refreshing"
    // instead of signing in (issue #365). Mirrors the deliberate full
    // reload the invite-accept flow already uses in join/[token].
    const destination = inviteToken
      ? `/join/${encodeURIComponent(inviteToken)}`
      : "/dashboard";
    window.location.href = destination;
  };

  return (
    <AuthScreen back={inviteToken ? undefined : "/welcome"}>
      <AuthHeader
        title={inviteToken ? t("titleAccept") : t("titleWelcome")}
        sub={inviteToken ? t("descAccept") : t("descWelcome")}
      />

      <form onSubmit={handleLogin} className="mt-8 flex flex-1 flex-col">
        <div className="flex flex-col gap-5">
          {error && <AuthError>{error}</AuthError>}
          <AuthField
            id="email"
            type="email"
            label={t("emailLabel")}
            placeholder={t("emailPlaceholder")}
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <AuthField
            id="password"
            type="password"
            label={t("passwordLabel")}
            placeholder={t("passwordPlaceholder")}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Link
            href="/forgot-password"
            className="self-end text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            {t("forgotPassword")}
          </Link>
        </div>

        <div className="mt-auto pt-10">
          <button type="submit" disabled={loading} className={authButton.dark}>
            {loading ? t("signingIn") : t("signIn")}
          </button>
          <AuthFooter>
            {t("noAccount")}{" "}
            <Link
              href={
                inviteToken
                  ? `/signup?invite=${encodeURIComponent(inviteToken)}`
                  : "/signup"
              }
              className={authLink}
            >
              {t("createAccount")}
            </Link>
          </AuthFooter>
        </div>
      </form>
    </AuthScreen>
  );
}
