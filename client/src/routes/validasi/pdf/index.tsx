import { createFileRoute } from "@tanstack/react-router";
import { ValidasiPdfPage } from "@/pages/validasi/ValidasiPdfPage";

export const Route = createFileRoute("/validasi/pdf/")({
  component: ValidasiPdfPage,
});
