import { useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Toast } from "@/components/ui/toast";
import { useUIStore } from "@/stores/uiStore";

const AUTO_CLOSE_MS = 5000;

export function GlobalToast() {
  const firstToast = useUIStore((state) => state.toasts[0]);
  const removeToast = useUIStore((state) => state.removeToast);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (!firstToast) return;
    const t = setTimeout(() => removeToast(firstToast.id), AUTO_CLOSE_MS);
    return () => clearTimeout(t);
  }, [firstToast?.id, removeToast]);

  if (!firstToast) return null;

  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-[9999] sm:left-auto sm:right-4 sm:w-full sm:max-w-sm">
      <AnimatePresence>
        <motion.div
          initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.95 }}
          animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
          exit={{
            opacity: 0,
            ...(shouldReduceMotion ? {} : { y: 10, scale: 0.95 }),
            transition: { duration: 0.2 },
          }}
          className="pointer-events-auto"
        >
          <Toast
            message={firstToast.message}
            type={firstToast.type}
            role={firstToast.type === "error" ? "alert" : "status"}
            onDismiss={() => removeToast(firstToast.id)}
          />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
