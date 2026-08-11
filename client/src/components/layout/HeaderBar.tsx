import { useNavigate } from "@tanstack/react-router";
import { CircleUserRound, LogOut } from "lucide-react";
import { ROUTES } from "@/utils/constants";
import { getMeRoute } from "@/utils/role-routing";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NotificationBell } from "./NotificationBell";
import { usePageHeaderContext } from "@/components/layout/PageHeaderProvider";
import { useAppRole } from "@/hooks/useAppRole";
import { useAuth } from "@/api/auth";

export function HeaderBar() {
  const navigate = useNavigate();
  const { role, getRoleLabel, getRoleNip, getRoleDisplayName } = useAppRole();
  const { logout: logoutSession } = useAuth();
  const pageHeader = usePageHeaderContext();
  const headerContent = pageHeader?.headerContent;

  const handleLogout = async () => {
    await logoutSession();
    navigate({
      to: ROUTES.HOME,
      search: { denied: undefined, redirect: undefined },
    });
  };

  const roleLabel = role ? getRoleLabel(role) : "";
  const displayName = getRoleDisplayName();
  const nip = getRoleNip();

  return (
    <header
      data-print-hide
      className="flex min-h-[var(--header-height)] flex-shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-3 py-1.5 shadow-surface sm:px-4 md:px-page"
    >
      <div suppressHydrationWarning className="order-1 flex min-w-0 flex-1 items-center gap-2">
        {headerContent ? (
          <>
            {headerContent.leading && (
              <div className="flex-shrink-0">{headerContent.leading}</div>
            )}
            <h1 className="min-w-0 truncate text-ui-title font-semibold text-foreground">
              {headerContent.title}
            </h1>
          </>
        ) : null}
      </div>
      <div
        suppressHydrationWarning
        className={
          headerContent
            ? "order-2 flex w-full flex-shrink-0 flex-wrap items-center justify-between gap-2 sm:w-auto sm:justify-end"
            : "order-2 ml-auto flex flex-shrink-0 items-center justify-end gap-2"
        }
      >
        {headerContent?.actions}
        <NotificationBell />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full bg-surface-muted p-0 text-primary transition-colors hover:bg-border"
              aria-label="Profil"
            >
              <CircleUserRound className="w-4 h-4" strokeWidth={1.5} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col gap-0.5">
                <p className="text-sm font-medium text-foreground">
                  {displayName}
                </p>
                <p className="text-xs text-muted-foreground">{roleLabel}</p>
                {nip && nip !== "" && (
                  <p className="text-xs text-muted-foreground">NIP. {nip}</p>
                )}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {getMeRoute(role) ? (
              <DropdownMenuItem
                className="cursor-pointer"
                onSelect={() => {
                  const mePath = getMeRoute(role);
                  if (mePath) {
                    navigate({ to: mePath });
                  }
                }}
              >
                Profil Saya
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem
              className="text-danger focus:text-danger-foreground focus:bg-danger-subtle cursor-pointer"
              onSelect={() => {
                void handleLogout();
              }}
            >
              <LogOut className="w-3.5 h-3.5 mr-2" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
