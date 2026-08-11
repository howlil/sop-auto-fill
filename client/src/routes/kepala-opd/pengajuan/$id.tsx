import { createFileRoute } from "@tanstack/react-router";
import { DetailPengajuanSOPPage } from "@/pages/kepala-opd/pengajuan/DetailPengajuanSOPPage";

export const Route = createFileRoute("/kepala-opd/pengajuan/$id")({
  component: DetailPengajuanSOPPage,
});
