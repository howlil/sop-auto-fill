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
import { useAuthStore, ensureAuthHydrated, syncAuthFromCookie } from "@/stores/authStore";
import {
  getRoleDefaultLandingPath,
  isPathAccessibleByRole,
  redirectArgsFromAppPath,
} from "@/utils/role-routing";

const ROLE_ROUTE_PREFIXES = ["/pj-evaluator", "/penyusun", "/kepala-opd", "/evaluator"] as const;

export const Route = createRootRoute({
  beforeLoad: async ({ location }) => {
    const path = location.pathname;
    const isPublic =
      path === "/" ||
      path.startsWith("/login") ||
      path.startsWith("/arsip") ||
      path.startsWith("/validasi");
    if (isPublic) return;

    if (typeof window === "undefined") {
      return;
    }

    await ensureAuthHydrated();

    if (!useAuthStore.getState().user) {
      await syncAuthFromCookie();
    }

    const user = useAuthStore.getState().user;
    if (!user) {
      throw redirect({
        to: "/login",
        search: { redirect: location.href },
      });
    }

    const isRoleScopedPath = ROLE_ROUTE_PREFIXES.some(
      (prefix) => path === prefix || path.startsWith(`${prefix}/`),
    );
    if (isRoleScopedPath && !isPathAccessibleByRole(path, user.peran)) {
      throw redirect(
        redirectArgsFromAppPath(getRoleDefaultLandingPath(user.peran) ?? "/"),
      );
    }
  },
  pendingComponent: () => (
    <div className="min-h-screen flex items-center justify-center bg-surface-subtle">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
        <p className="text-secondary-foreground">Memuat...</p>
      </div>
    </div>
  ),
  notFoundComponent: () => <NotFoundPage />,
  errorComponent: ({ error, reset }) => <RouteErrorPage error={error} reset={reset} />,
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: APP_DISPLAY_NAME,
      },
      // Security headers
      {
        httpEquiv: "X-Content-Type-Options",
        content: "nosniff",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),

  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  // Auth check and token refresh already handled in beforeLoad
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body suppressHydrationWarning>
        <ErrorBoundary fallback={<RouteErrorPage error={new Error("Terjadi kesalahan yang tidak terduga pada aplikasi.")} reset={() => window.location.reload()} />}>
          <QueryClientProvider client={queryClient}>
            <AppHydrationMarker />
            <RouteFocusManager>{children}</RouteFocusManager>
            <GlobalToast />
            {import.meta.env.DEV && (
              <>
                <TanStackDevtools
                  config={{
                    position: "bottom-right",
                  }}
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

/**
 * Marks the document interactive only after React hydration has committed.
 * E2E tests use this observable boundary instead of network-idle heuristics,
 * which are unreliable for dashboards with background queries/dev tooling.
 */
function AppHydrationMarker() {
  useEffect(() => {
    document.documentElement.dataset.appHydrated = "true";
    return () => {
      delete document.documentElement.dataset.appHydrated;
    };
  }, []);

  return null;
}
