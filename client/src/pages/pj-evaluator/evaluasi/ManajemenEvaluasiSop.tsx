import { useEffect, useMemo, useState } from 'react'
import { Eye } from 'lucide-react'
import {
  STATUS_PENGAJUAN_SIAP_TTD_PJ_EVALUATOR,
  STATUS_RIWAYAT_FINAL_EVALUASI,
  usePengajuanEvaluasiRingkas,
} from '@/api/evaluasi'
import { ListPageLayout } from '@/components/layout/ListPageLayout'
import { SearchToolbar } from '@/components/ui/search-toolbar'
import { RowActions } from '@/components/data/row-actions'
import {
  EvaluasiFilterTabs,
  type EvaluasiFilterTab,
} from '@/components/evaluasi/evaluasi-filter-tabs'
import { EvaluasiPengajuanGroupedList } from '@/components/evaluasi/evaluasi-pengajuan-grouped-list'
import { readPaginationMeta } from '@/lib/api/pagination'
import { ROUTES, IA, DEFAULT_PAGE_SIZE } from '@/utils/constants'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { useDebouncedValue } from '@/hooks/use-debounced-value'

export function ManajemenEvaluasiSop() {
  useDocumentTitle(`${IA.NAV_BIRO_EVALUASI_REQUEST_EVALUATOR} — PJ Evaluator`)
  const [page, setPage] = useState(1)
  const [filterTab, setFilterTab] = useState<EvaluasiFilterTab>('pengajuan')
  const [searchQuery, setSearchQuery] = useState('')
  const debouncedSearch = useDebouncedValue(searchQuery, 300)

  const ringkasParams = useMemo(() => {
    const search =
      debouncedSearch.trim() !== '' ? debouncedSearch.trim() : undefined
    const base = { page, limit: DEFAULT_PAGE_SIZE, search }
    if (filterTab === 'pengajuan') {
      return { ...base, statusIn: [...STATUS_PENGAJUAN_SIAP_TTD_PJ_EVALUATOR] }
    }
    return { ...base, statusIn: [...STATUS_RIWAYAT_FINAL_EVALUASI] }
  }, [page, debouncedSearch, filterTab])

  const { data, isLoading } = usePengajuanEvaluasiRingkas(ringkasParams)

  useEffect(() => {
    setPage(1)
  }, [filterTab, debouncedSearch])

  const items = data?.items ?? []
  const pagination = readPaginationMeta(data)

  return (
    <ListPageLayout
      breadcrumb={[{ label: IA.NAV_BIRO_BATCH_BA }]}
      title={IA.NAV_BIRO_BATCH_BA}
      description={`${IA.PENGAJUAN_EVALUASI_OPD} per OPD. Buka detail untuk ${IA.VERIFIKASI_BA_BIRO} pada dokumen ${IA.BERITA_ACARA}.`}
      toolbar={
        <div className="flex flex-col gap-3 w-full">
          <SearchToolbar
            searchPlaceholder="Cari OPD..."
            searchValue={searchQuery}
            onSearchChange={(e) => setSearchQuery(e.target.value)}
          />
          <div className="w-full">
            <EvaluasiFilterTabs value={filterTab} onValueChange={setFilterTab} />
          </div>
        </div>
      }
    >
      <EvaluasiPengajuanGroupedList
        rows={items}
        isLoading={isLoading}
        pagination={pagination}
        onPageChange={setPage}
        renderAction={(row) => (
          <RowActions
            actions={[
              {
                icon: Eye,
                to: ROUTES.PJ_EVALUATOR.DETAIL_EVALUASI,
                params: { id: row.pengajuanEvaluasiId },
                title: 'Detail evaluasi',
              },
            ]}
          />
        )}
      />
    </ListPageLayout>
  )
}
