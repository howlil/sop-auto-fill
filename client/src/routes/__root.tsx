import { useEffect } from "react";
import { HeadContent, Scripts, createRootRoute, redirect } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { TanStackDevtools } from "@tanstack/react-devtools";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import appCss from "../styles.css?url";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { GlobalToast } from "@/components/layout/GlobalToast";
import { NotFoundPage } from "@/components/ui/not-found";
import { RouteErrorPage } from "@/components/ui/route-error";
import { RouteFocusManager } from "@/components/ui/route-focus-manager";
import { APP_DISPLAY_NAME } from "@/config/env";
import { queryClient } from "@/config/query-client";
import {
  ensureAuthHydrated,
  syncAuthFromCookie,
  useAuthStore,
} from "@/stores/authStore";

export const Route = createRootRoute({
  beforeLoad: async ({ location }) => {
    const isPublic = location.pathname === "/" || location.pathname.startsWith("/login");
    if (isPublic || typeof window === "undefined") return;

    await ensureAuthHydrated();
    if (!useAuthStore.getState().user) {
      await syncAuthFromCookie();
    }
    if (!useAuthStore.getState().user) {
      throw redirect({
        to: "/login",
        search: { redirect: location.href },
      });
    }
  },
  pendingComponent: () => (
    <div className="min-h-screen flex items-center justify-center bg-surface-subtle">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4" />
        <p className="text-secondary-foreground">Memuat...</p>
      </div>
    </div>
  ),
  notFoundComponent: () => <NotFoundPage />,
  errorComponent: ({ error, reset }) => <RouteErrorPage error={error} reset={reset} />,
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: APP_DISPLAY_NAME },
      { httpEquiv: "X-Content-Type-Options", content: "nosniff" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body suppressHydrationWarning>
        <ErrorBoundary
          fallback={
            <RouteErrorPage
              error={new Error("Terjadi kesalahan yang tidak terduga pada aplikasi.")}
              reset={() => window.location.reload()}
            />
          }
        >
          <QueryClientProvider client={queryClient}>
            <AppHydrationMarker />
            <RouteFocusManager>{children}</RouteFocusManager>
            <GlobalToast />
            {import.meta.env.DEV && (
              <>
                <TanStackDevtools
                  config={{ position: "bottom-right" }}
                  plugins={[
                    {
                      name: "Tanstack Router",
                      render: <TanStackRouterDevtoolsPanel />,
                    },
                  ]}
                />
                <ReactQueryDevtools initialIsOpen={false} />
              </>
            )}
            <Scripts />
          </QueryClientProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}

function AppHydrationMarker() {
  useEffect(() => {
    document.documentElement.dataset.appHydrated = "true";
    return () => {
      delete document.documentElement.dataset.appHydrated;
    };
  }, []);
  return null;
}
