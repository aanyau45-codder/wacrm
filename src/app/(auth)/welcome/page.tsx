import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArgonLogo } from "@/components/brand/argon-logo";
import { PersonPhone } from "@/components/auth/illustrations";
import { AuthScreen } from "@/components/auth/auth-ui";
import { authButton } from "@/components/auth/auth-styles";

export const metadata: Metadata = {
  title: "Welcome",
};

// First screen a signed-out visitor sees (middleware sends protected
// routes here). "Soft Blob" design: logo, greeting, illustration on a
// lilac blob, then Log in / Create account.
export default async function WelcomePage() {
  const t = await getTranslations("WelcomePage");
  return (
    <AuthScreen>
      <div className="flex flex-1 flex-col items-center text-center">
        <ArgonLogo size={34} className="mt-4" />
        <h1 className="mt-8 text-[30px] leading-tight font-semibold text-foreground">
          {t("title")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("tagline")}</p>
        <PersonPhone className="my-6 w-full max-w-[300px] flex-1" />
      </div>
      <div className="flex flex-col gap-3">
        <Link href="/login" className={authButton.outline}>
          {t("logIn")}
        </Link>
        <Link href="/signup" className={authButton.lilac}>
          {t("createAccount")}
        </Link>
      </div>
    </AuthScreen>
  );
}
