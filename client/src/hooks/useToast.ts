import { useCallback } from "react";
import { useUIStore } from "@/stores/uiStore";
import type { ToastType } from "@/stores/uiStore";
import { getUserFriendlyMessage } from "@/utils/error-codes";

export function useToast() {
  // Use selectors to prevent unnecessary re-renders
  const toasts = useUIStore((state) => state.toasts);
  const addToast = useUIStore((state) => state.addToast);
  const removeToast = useUIStore((state) => state.removeToast);

  const toast = toasts[0] || {
    message: null,
    type: "success" as ToastType,
    id: "",
  };

  const showToast = useCallback(
    (message: string, type: ToastType = "success") => {
      addToast(message, type);
    },
    [addToast],
  );

  const clearToast = useCallback(() => {
    if (toasts.length > 0) {
      removeToast(toasts[0].id);
    }
  }, [toasts, removeToast]);

  return {
    showToast,
    toast: { message: toast.message, type: toast.type },
    clearToast,
  };
}


export function showErrorMessages(
  error: unknown,
  fallbackMessage: string = "Terjadi kesalahan",
) {
  const { addToast } = useUIStore.getState();

  // Use error code utility to get user-friendly message
  const message = getUserFriendlyMessage(error) || fallbackMessage;
  
  // If we have detailed errors, still show them
  if (error && typeof error === "object" && "errors" in error) {
    const apiError = error as { errors?: string[]; message?: string };
    const errors = apiError.errors;

    if (errors && errors.length > 0) {
      // Show main error code message followed by detailed errors
      const allErrors = [
        message,
        ...errors,
      ].join("\n");

      addToast(allErrors, "error");
      return;
    }
  }

  // Fallback to error code message or original message
  addToast(message, "error");
}
