/**
 * Auth store - Zustand
 * Store untuk auth state (user info, role)
 * Note: Token disimpan di HttpOnly cookie (backend-managed), bukan localStorage
 *
 * USAGE PATTERN: Use selectors to prevent unnecessary re-renders
 *
 * ❌ WRONG: Subscribes to entire store
 * const { user, logout } = useAuthStore()
 *
 * ✅ CORRECT: Subscribe to slice only
 * const user = useAuthStore((state) => state.user)
 * const logout = useAuthStore((state) => state.logout)
 *
 * ✅ BEST: With shallow comparison for multiple values
 * import { shallow } from 'zustand/shallow'
 * const { user, logout } = useAuthStore(
 *   (state) => ({ user: state.user, logout: state.logout }),
 *   shallow
 * )
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { apiClient } from "@/lib/api/api-client";
import type {
  LoginApiResponse,
  PublicPenggunaLoginData,
  PublicPenggunaTteStatus,
} from "@/types/dto/auth.dto";
import type { User } from "@/types/dto/users.dto";
import { ROUTES } from "@/utils/constants";
import { toNavigationRole } from "@/utils/role-key";

/**
 * Core user fields used in the auth store.
 * The full User type (with pangkat, nohp, createdAt, updatedAt) is defined
 * in @/types/dto/users.dto.ts — import that when extra fields are needed.
 */
export type AuthUser = Pick<
  User,
  "id" | "email" | "nama" | "peran" | "opdId" | "nip" | "jabatan" | "nohp"
> & {
  pangkat: string;
  tte: PublicPenggunaTteStatus;
};

interface AuthState {
  user: AuthUser | null;
  setUser: (user: AuthUser | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,

      setUser: (user) => set({ user }),

      logout: () => {
        set({ user: null });
      },
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({ user: state.user }),
    },
  ),
);

// ==================== Shared Hydration Helper ====================

/**
 * Ensures Zustand persist middleware has finished hydrating from localStorage.
 * Reusable across __root.tsx and role.ts to prevent duplication.
 * Uses a shared promise to avoid multiple concurrent hydration waits.
 */
let hydrationPromise: Promise<void> | null = null;

export function mapPublicDataToAuthUser(u: PublicPenggunaLoginData): AuthUser {
  return {
    id: u.penggunaId,
    email: u.email,
    nama: u.nama,
    peran: u.peran,
    opdId: u.opdId,
    nip: u.nip,
    jabatan: u.jabatan,
    pangkat: u.pangkat,
    nohp: u.nohp,
    tte: u.tte,
  };
}

/**
 * Mengisi store dari cookie sesi (GET /auth/me + credentials).
 * Dipakai setelah refresh: cookie HttpOnly tidak bisa dibaca JS; tanpa ini guard hanya melihat localStorage.
 */
/**
 * Arahkan ke halaman login (full navigation agar state & cache query ikut reset).
 * Tidak melakukan apa-apa jika sudah di `/login`.
 */
export function redirectToLogin(redirectHref?: string): void {
  if (typeof window === "undefined") {
    return;
  }
  if (window.location.pathname.startsWith(ROUTES.AUTH.LOGIN)) {
    return;
  }
  const href = redirectHref ?? window.location.href;
  const search = new URLSearchParams({ redirect: href });
  window.location.assign(`${ROUTES.AUTH.LOGIN}?${search.toString()}`);
}

/** Kosongkan sesi klien lalu redirect ke login. */
export function handleUnauthorizedSession(redirectHref?: string): void {
  useAuthStore.getState().logout();
  redirectToLogin(redirectHref);
}

export async function syncAuthFromCookie(): Promise<boolean> {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    const res = await apiClient.get<LoginApiResponse>("/auth/me");
    useAuthStore.getState().setUser(mapPublicDataToAuthUser(res.data));
    return true;
  } catch {
    useAuthStore.getState().logout();
    return false;
  }
}

export async function ensureAuthHydrated(maxWait = 2000): Promise<void> {
  // persist middleware is unavailable during SSR (no localStorage)
  if (typeof window === "undefined") return;
  if (!useAuthStore.persist) return;
  if (useAuthStore.persist.hasHydrated()) return;

  if (!hydrationPromise) {
    hydrationPromise = new Promise((resolve) => {
      let resolved = false;

      const finish = () => {
        if (!resolved) {
          resolved = true;
          hydrationPromise = null;
          resolve();
        }
      };

      const timeout = setTimeout(finish, maxWait);
      useAuthStore.persist.onFinishHydration(() => {
        clearTimeout(timeout);
        finish();
      });
    });
  }

  await hydrationPromise;
}

/**
 * Get the current user's role string.
 * Returns undefined if no user is authenticated.
 */
export function getRole(): string | undefined {
  return useAuthStore.getState().user?.peran;
}

/**
 * Route guard: redirect if user doesn't have one of the required roles.
 * Usage in route file: beforeLoad: requireRoles(['PJ_EVALUATOR'])
 */
export function requireRoles(roles: string[]) {
  return async ({ location }: { location: { href: string } }) => {
    if (typeof window === "undefined") {
      return;
    }
    await ensureAuthHydrated();
    await syncAuthFromCookie();
    const user = useAuthStore.getState().user;
    if (!user) {
      const { redirect } = await import("@tanstack/react-router");
      throw redirect({
        to: ROUTES.AUTH.LOGIN,
        search: { redirect: location.href },
      });
    }
    const navRole = toNavigationRole(user.peran);
    if (navRole === undefined || !roles.includes(navRole)) {
      const { redirect } = await import("@tanstack/react-router");
      throw redirect({ to: ROUTES.HOME });
    }
  };
}
