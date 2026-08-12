import { useMutation } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { queryClient } from "@/config/query-client";
import { useToast, showErrorMessages } from "@/hooks/useToast";
import { apiClient } from "@/lib/api/api-client";
import {
  mapPublicDataToAuthUser,
  useAuthStore,
} from "@/stores/authStore";
import type {
  AuthApiResponse,
  GoogleLoginRequestDto,
} from "@/types/dto/auth.dto";

export const authApi = {
  loginWithGoogle: (payload: GoogleLoginRequestDto) =>
    apiClient.post<AuthApiResponse>("/auth/google", payload),
  me: () => apiClient.get<AuthApiResponse>("/auth/me"),
  logout: async () => {
    try {
      await apiClient.post<{ message: string }>("/auth/logout");
    } catch {
      // Local session cleanup must still happen when network logout fails.
    }
  },
};

export function useAuth() {
  const navigate = useNavigate();
  const { redirect } = useSearch({ strict: false }) as { redirect?: string };
  const { showToast } = useToast();
  const setUser = useAuthStore((state) => state.setUser);
  const clearUser = useAuthStore((state) => state.logout);

  const loginMutation = useMutation({
    mutationFn: (credential: string) => authApi.loginWithGoogle({ credential }),
    onSuccess: async (response) => {
      queryClient.clear();
      setUser(mapPublicDataToAuthUser(response.data));
      showToast(`Selamat datang, ${response.data.name}!`, "success");
      const destination =
        typeof redirect === "string" && redirect.startsWith("/")
          ? redirect
          : "/workspaces";
      await navigate({ to: destination });
    },
    onError: (error: Error) => showErrorMessages(error, "Login Google gagal"),
  });

  const logout = async () => {
    await authApi.logout();
    clearUser();
    queryClient.clear();
    await navigate({ to: "/login" });
  };

  return {
    loginWithGoogle: loginMutation.mutateAsync,
    isLoggingIn: loginMutation.isPending,
    logout,
  };
}
