
import {
  useMutation,
  useQueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import { useToast, showErrorMessages } from "@/hooks/useToast";

interface UseMutationWithToastOptions<TData = unknown, TVariables = unknown> {
  /** The mutation function to execute */
  mutationFn: (variables: TVariables) => Promise<TData>;
  /** Query keys to invalidate on success (optional for mutations that don't need cache invalidation) */
  invalidateKeys?: readonly QueryKey[];
  /** Toast message shown on success */
  successMessage: string;
  /** Use detailed error messages (showErrorMessages) instead of simple toast */
  useDetailedErrors?: boolean;
  /** Prefix for error toast message (used when useDetailedErrors is false) */
  errorMessagePrefix?: string;
  /** Optional additional onSuccess callback */
  onSuccess?: (data: TData, variables: TVariables) => void | Promise<void>;
  /** Optional additional onError callback */
  onError?: (error: Error, variables: TVariables) => void;
  /** Suppress the default error toast for errors that will be handled by the caller UI. */
  shouldSuppressErrorToast?: (error: Error, variables: TVariables) => boolean;
}

export function useMutationWithToast<TData = unknown, TVariables = unknown>(
  options: UseMutationWithToastOptions<TData, TVariables>,
) {
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: options.mutationFn,
    onSuccess: async (data, variables) => {
      await options.onSuccess?.(data, variables);

      // Invalidate specified query keys if provided
      if (options.invalidateKeys) {
        await Promise.all(
          options.invalidateKeys.map((key) =>
            queryClient.invalidateQueries({ queryKey: key }),
          ),
        );
      }
      showToast(options.successMessage, "success");
    },
    onError: (error: Error, variables) => {
      if (!options.shouldSuppressErrorToast?.(error, variables)) {
        // Always use showErrorMessages for consistent error handling.
        // This handles both ApiError (with errors array) and regular errors.
        showErrorMessages(
          error,
          options.errorMessagePrefix || "Terjadi kesalahan",
        );
      }
      options.onError?.(error, variables);
    },
  });
}
