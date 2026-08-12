import { useEffect, useRef } from "react";
import { useAuth } from "@/api/auth";
import logoSvg from "@/assets/logo.svg";
import { APP_DISPLAY_NAME, GOOGLE_CLIENT_ID } from "@/config/env";

interface GoogleCredentialResponse {
  credential: string;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: GoogleCredentialResponse) => void;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: Record<string, string | number | boolean>,
          ) => void;
        };
      };
    };
  }
}

export function LoginPage() {
  const { loginWithGoogle, isLoggingIn } = useAuth();
  const buttonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;

    const render = () => {
      if (!window.google || !buttonRef.current) return;
      buttonRef.current.innerHTML = "";
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response) => {
          void loginWithGoogle(response.credential);
        },
      });
      window.google.accounts.id.renderButton(buttonRef.current, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: "continue_with",
        shape: "rectangular",
        width: 360,
      });
    };

    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://accounts.google.com/gsi/client"]',
    );
    if (existing) {
      if (window.google) render();
      else existing.addEventListener("load", render, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.addEventListener("load", render, { once: true });
    document.head.appendChild(script);
  }, [loginWithGoogle]);

  return (
    <main className="min-h-screen bg-surface flex items-center justify-center px-6">
      <section className="w-full max-w-md rounded-2xl border border-border bg-background p-8 shadow-sm">
        <div className="mb-8 flex items-center gap-3">
          <img src={logoSvg} alt={APP_DISPLAY_NAME} className="h-12 w-12" />
          <div>
            <h1 className="text-xl font-semibold text-foreground">{APP_DISPLAY_NAME}</h1>
            <p className="text-sm text-muted-foreground">Workspace authoring SOP</p>
          </div>
        </div>

        <h2 className="text-2xl font-semibold text-foreground">Masuk ke workspace Anda</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Gunakan akun Google untuk membuat workspace dan mengelola SOP.
        </p>

        <div className="mt-8 min-h-11">
          {GOOGLE_CLIENT_ID ? (
            <div ref={buttonRef} className={isLoggingIn ? "pointer-events-none opacity-60" : ""} />
          ) : (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              VITE_GOOGLE_CLIENT_ID belum dikonfigurasi.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
