import { createFileRoute } from "@tanstack/react-router";
import { PengajuanSOPPage } from "@/pages/kepala-opd/pengajuan/PengajuanSOPPage";

export const Route = createFileRoute("/kepala-opd/pengajuan/")({
  component: PengajuanSOPPage,
});
