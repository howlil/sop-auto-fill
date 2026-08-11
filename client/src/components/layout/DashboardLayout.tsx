import { useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "@tanstack/react-router";
import {
  BarChart3,
  Building2,
  FileCheck,
  UserPlus,
  Users,
  BookOpen,
  FileSignature,
  FileText,
  UserCog,
  Menu,
  X,
} from "lucide-react";
import logoSvg from "@/assets/logo.svg";
import { HeaderBar } from "@/components/layout/HeaderBar";
import { PageHeaderProvider } from "@/components/layout/PageHeaderProvider";
import { APP_DISPLAY_NAME } from "@/config/env";
import {
  AppSidebar,
  type AppSidebarItem,
} from "@/components/layout/AppSidebar";
import { useAuthStore } from "@/stores/authStore";
import { useUIStore } from "@/stores/uiStore";
import type { RoleKey } from "@/types/dto/access.dto";
import { cn } from "@/utils/cn";
import { ROUTES } from "@/utils/constants";
import { toNavigationRole } from "@/utils/role-key";

const DESKTOP_SIDEBAR_STORAGE_KEY = "ui:desktop-sidebar-collapsed";

/** Item pertama per peran harus selaras dengan @/utils/role-routing ROLE_DEFAULT_LANDING (redirect setelah login & `/`). */
const SIDEBAR_ITEMS: Record<RoleKey, AppSidebarItem[]> = {
  PJ_EVALUATOR: [
    {
      to: ROUTES.PJ_EVALUATOR.GRAFIK_EVALUASI,
      label: "Grafik Evaluasi",
      icon: BarChart3,
    },
    {
      to: ROUTES.PJ_EVALUATOR.OPD,
      label: "OPD",
      icon: Building2,
    },
    {
      to: ROUTES.PJ_EVALUATOR.PENYUSUN,
      label: "Penyusun",
      icon: UserPlus,
    },
    {
      to: ROUTES.PJ_EVALUATOR.EVALUATOR,
      label: "Evaluator",
      icon: Users,
    },
    {
      to: ROUTES.PJ_EVALUATOR.EVALUASI,
      label: "Evaluasi SOP",
      icon: FileCheck,
    },
  ],
  PENYUSUN: [
    {
      to: ROUTES.PENYUSUN.SOP,
      label: "SOP",
      icon: FileText,
    },
    {
      to: ROUTES.PENYUSUN.PELAKSANA,
      label: "Pelaksana SOP",
      icon: UserCog,
    },
    {
      to: ROUTES.PENYUSUN.PERATURAN,
      label: "Peraturan",
      icon: BookOpen,
    },
  ],
  PJ_PENYUSUN: [
    {
      to: ROUTES.PENYUSUN.SOP,
      label: "SOP",
      icon: FileText,
    },
    {
      to: ROUTES.PENYUSUN.PELAKSANA,
      label: "Pelaksana SOP",
      icon: UserCog,
    },
    {
      to: ROUTES.PENYUSUN.PERATURAN,
      label: "Peraturan",
      icon: BookOpen,
    },
    {
      to: ROUTES.PENYUSUN.PJ_PENYUSUN_BERITA_ACARA,
      label: "Berita Acara",
      icon: FileSignature,
    },
  ],
  KEPALA_OPD: [
    { to: ROUTES.KEPALA_OPD.SOP, label: "Pantau SOP", icon: FileText },
    {
      to: ROUTES.KEPALA_OPD.PENGAJUAN,
      label: "Pengajuan SOP",
      icon: FileCheck,
    },
  ],
  EVALUATOR: [
    { to: ROUTES.EVALUATOR.EVALUASI, label: "Evaluasi SOP", icon: FileCheck },
  ],
};

function isActivePath(pathname: string, itemTo: string): boolean {
  return pathname.startsWith(itemTo.replace("/$id", ""));
}

export function DashboardLayout() {
  const { pathname } = useLocation();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const user = useAuthStore((state) => state.user);
  const isDesktopNavOpen = useUIStore((state) => state.sidebarOpen);
  const setDesktopNavOpen = useUIStore((state) => state.setSidebarOpen);
  const navRole = user?.peran !== undefined ? toNavigationRole(user.peran) : undefined;
  const sidebarItems = navRole !== undefined ? SIDEBAR_ITEMS[navRole] ?? [] : [];
  const activeItem = sidebarItems.find(({ to }) => isActivePath(pathname, to));

  useEffect(() => {
    setIsMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    try {
      setDesktopNavOpen(
        window.localStorage.getItem(DESKTOP_SIDEBAR_STORAGE_KEY) !== "true",
      );
    } catch {
      // Preferensi visual tetap opsional ketika storage browser tidak tersedia.
    }
  }, [setDesktopNavOpen]);

  const handleDesktopSidebarOpenChange = (open: boolean) => {
    setDesktopNavOpen(open);
    try {
      window.localStorage.setItem(
        DESKTOP_SIDEBAR_STORAGE_KEY,
        String(!open),
      );
    } catch {
      // Sidebar tetap dapat digunakan walau storage browser diblokir.
    }
  };

  return (
    <div suppressHydrationWarning className="flex h-[100dvh] flex-col md:flex-row md:h-screen">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[60] focus:rounded-control focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:shadow-raised focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
      >
        Lewati ke konten utama
      </a>

      {/* Mobile nav */}
      <nav
        data-print-hide
        className="shrink-0 border-b border-border bg-surface md:hidden"
        aria-label="Navigasi utama"
      >
        <div className="flex min-h-14 items-center gap-3 px-3">
          <img src={logoSvg} alt={APP_DISPLAY_NAME} className="h-9 w-9 shrink-0" />
          <span className="min-w-0 flex-1 text-ui-body font-semibold text-foreground">
            {activeItem?.label ?? APP_DISPLAY_NAME}
          </span>
          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-control text-secondary-foreground hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label={isMobileNavOpen ? "Tutup navigasi" : "Buka navigasi"}
            aria-expanded={isMobileNavOpen}
            aria-controls="mobile-main-navigation"
            onClick={() => setIsMobileNavOpen((open) => !open)}
          >
            {isMobileNavOpen ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
          </button>
        </div>
        <div
          id="mobile-main-navigation"
          className={cn("grid gap-1 border-t border-border p-2", !isMobileNavOpen && "hidden")}
        >
          {sidebarItems.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              aria-current={isActivePath(pathname, to) ? "page" : undefined}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-ui-body transition-colors",
                isActivePath(pathname, to)
                  ? "bg-primary-subtle font-semibold text-primary"
                  : "text-secondary-foreground hover:bg-surface-muted",
              )}
            >
              <Icon className="h-5 w-5 shrink-0 opacity-80" aria-hidden />
              {label}
            </Link>
          ))}
        </div>
      </nav>

      <AppSidebar
        items={sidebarItems}
        isItemActive={(to) => isActivePath(pathname, to)}
        open={isDesktopNavOpen}
        onOpenChange={handleDesktopSidebarOpenChange}
      />

      {/* Main content */}
      <div suppressHydrationWarning className="flex-1 flex flex-col min-w-0 min-h-0">
        <PageHeaderProvider>
          <HeaderBar />
          <main
            id="main-content"
            className="relative flex-1 overflow-auto bg-background scrollbar-hide"
          >
            <div data-scroll-content className="min-h-full p-3 sm:p-4 md:p-page">
              <div data-app-content className="mx-auto w-full max-w-app">
                <Outlet />
              </div>
            </div>
          </main>
        </PageHeaderProvider>
      </div>
    </div>
  );
}
