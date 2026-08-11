import { useNavigate } from "@tanstack/react-router";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useAppRole } from "@/hooks/useAppRole";
import { getMeRoute, navigateToAppPath } from "@/utils/role-routing";

interface TteSetupRequiredDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TteSetupRequiredDialog({
  open,
  onOpenChange,
}: TteSetupRequiredDialogProps) {
  const navigate = useNavigate();
  const { role } = useAppRole();

  const handleOpenProfile = () => {
    onOpenChange(false);
    const meRoute = getMeRoute(role);
    if (meRoute !== undefined) {
      navigateToAppPath(navigate, meRoute);
    }
  };

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Setup TTE diperlukan"
      description="Anda perlu menyiapkan PIN dan sertifikat TTE terlebih dahulu sebelum menandatangani BA atau mengesahkan SOP."
      cancelLabel="Nanti"
      confirmLabel="Buka Setup TTE"
      onConfirm={handleOpenProfile}
    />
  );
}
