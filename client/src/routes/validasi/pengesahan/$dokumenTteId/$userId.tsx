import { createFileRoute } from "@tanstack/react-router";
import { ValidasiPengesahanPage } from "@/pages/validasi/ValidasiPengesahanPage";

export const Route = createFileRoute("/validasi/pengesahan/$dokumenTteId/$userId")({
  component: ValidasiPengesahanPage,
});
