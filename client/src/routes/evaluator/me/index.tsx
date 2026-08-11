import { createFileRoute } from "@tanstack/react-router";
import { ProfilSayaPage } from "@/pages/akun/ProfilSayaPage";

export const Route = createFileRoute("/evaluator/me/")({
  component: ProfilSayaPage,
});
