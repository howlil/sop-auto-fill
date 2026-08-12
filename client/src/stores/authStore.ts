import { create } from "zustand";
import { persist } from "zustand/middleware";
import { apiClient } from "@/lib/api/api-client";
import type { AuthApiResponse, PublicUserData } from "@/types/dto/auth.dto";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

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
      logout: () => set({ user: null }),
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({ user: state.user }),
    },
  ),
);

let hydrationPromise: Promise<void> | null = null;

export function mapPublicDataToAuthUser(user: PublicUserData): AuthUser {
  return {
    id: user.userId,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
  };
}

export async function syncAuthFromCookie(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    const response = await apiClient.get<AuthApiResponse>("/auth/me");
    useAuthStore.getState().setUser(mapPublicDataToAuthUser(response.data));
    return true;
  } catch {
    useAuthStore.getState().logout();
    return false;
  }
}

export async function ensureAuthHydrated(maxWait = 2000): Promise<void> {
  if (typeof window === "undefined" || !useAuthStore.persist) return;
  if (useAuthStore.persist.hasHydrated()) return;

  if (!hydrationPromise) {
    hydrationPromise = new Promise((resolve) => {
      let resolved = false;
      const finish = () => {
        if (resolved) return;
        resolved = true;
        hydrationPromise = null;
        resolve();
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

export async function requireAuthenticatedUser({
  location,
}: {
  location: { href: string };
}): Promise<void> {
  if (typeof window === "undefined") return;
  await ensureAuthHydrated();
  if (!useAuthStore.getState().user) {
    await syncAuthFromCookie();
  }
  if (!useAuthStore.getState().user) {
    const { redirect } = await import("@tanstack/react-router");
    throw redirect({
      to: "/login",
      search: { redirect: location.href },
    });
  }
}
