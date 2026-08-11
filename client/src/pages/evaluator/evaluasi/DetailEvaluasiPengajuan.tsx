import { EvaluasiWorkspacePage } from "@/pages/evaluator/evaluasi/evaluasi-workspace-page";
import { ROUTES } from "@/utils/constants";
import { useParams, useSearch } from "@tanstack/react-router";

export function DetailEvaluasiPengajuan() {
  const { id: pengajuanEvaluasiId } = useParams({
    from: "/evaluator/evaluasi/pengajuan/$id",
  });
  const { sopId } = useSearch({
    from: "/evaluator/evaluasi/pengajuan/$id",
  });
  return (
    <EvaluasiWorkspacePage
      mode="pengajuan"
      pengajuanEvaluasiId={pengajuanEvaluasiId}
      preferredSopId={sopId}
      listHref={ROUTES.EVALUATOR.EVALUASI}
    />
  );
}
