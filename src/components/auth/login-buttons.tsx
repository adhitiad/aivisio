"use client";

import { useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { useT } from "@/lib/i18n";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

export function LoginButtons({
  googleEnabled,
  facebookEnabled,
  hasError,
}: {
  googleEnabled: boolean;
  facebookEnabled: boolean;
  hasError: boolean;
}) {
  const t = useT("auth");
  const [pending, setPending] = useState<"google" | "facebook" | null>(null);
  const [failed, setFailed] = useState(false);

  async function signInWith(provider: "google" | "facebook") {
    setPending(provider);
    setFailed(false);
    try {
      const result = await authClient.signIn.social({
        provider,
        callbackURL: "/dashboard",
      });
      if (result?.error) setFailed(true);
    } catch {
      setFailed(true);
      setPending(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {(hasError || failed) && (
        <p
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
        >
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {t("error")}
        </p>
      )}

      {googleEnabled && (
        <Button
          variant="outline"
          size="lg"
          className="h-11 gap-3"
          disabled={pending !== null}
          onClick={() => void signInWith("google")}
        >
          {pending === "google" ? (
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          ) : (
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
              <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" />
              <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z" />
              <path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z" />
              <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z" />
            </svg>
          )}
          {t("google")}
        </Button>
      )}

      {facebookEnabled && (
        <Button
          size="lg"
          className="h-11 gap-3 bg-[#1877F2] text-white hover:bg-[#0f6ae0]"
          disabled={pending !== null}
          onClick={() => void signInWith("facebook")}
        >
          {pending === "facebook" ? (
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          ) : (
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="#ffffff" aria-hidden="true">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.971H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
          )}
          {t("facebook")}
        </Button>
      )}
    </div>
  );
}
