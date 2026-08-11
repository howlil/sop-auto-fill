import { useCallback, useState } from "react";
import { useTTEProfil } from "@/api/tte";
import {
  isTteProfileReady,
  isTteSetupRequiredError,
} from "@/lib/tte/tte-setup-state";

export function useRequireTteSetup() {
  const [tteSetupDialogOpen, setTteSetupDialogOpen] = useState(false);
  const { data: tteProfile, refetch: refetchTteProfile } = useTTEProfil();

  const requireTteReady = useCallback(
    async (onReady: () => void) => {
      if (isTteProfileReady(tteProfile)) {
        onReady();
        return;
      }

      const result = await refetchTteProfile();
      if (isTteProfileReady(result.data)) {
        onReady();
        return;
      }

      setTteSetupDialogOpen(true);
    },
    [refetchTteProfile, tteProfile],
  );

  const handleTteSigningError = useCallback(
    (error: unknown, closePinDialog: () => void) => {
      if (!isTteSetupRequiredError(error)) {
        return;
      }

      closePinDialog();
      setTteSetupDialogOpen(true);
    },
    [],
  );

  return {
    tteSetupDialogOpen,
    setTteSetupDialogOpen,
    requireTteReady,
    handleTteSigningError,
  };
}
