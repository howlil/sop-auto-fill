/**
 * Evaluasi SOP: daftar pengajuan evaluasi (ringkas + paginasi server).
 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { Eye, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ListPageLayout } from '@/components/layout/ListPageLayout'
import { SearchToolbar } from '@/components/ui/search-toolbar'
import { RowActions } from '@/components/data/row-actions'
import {
  EvaluasiFilterTabs,
  type EvaluasiFilterTab,
} from '@/components/evaluasi/evaluasi-filter-tabs'
import { EvaluasiPengajuanGroupedList } from '@/components/evaluasi/evaluasi-pengajuan-grouped-list'
import { ROUTES } from '@/utils/constants'
import {
  STATUS_PENGAJUAN_BERJALAN_EVALUATOR,
  STATUS_RIWAYAT_FINAL_EVALUASI,
  usePengajuanEvaluasiRingkas,
} from '@/api/evaluasi'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { readPaginationMeta } from '@/lib/api/pagination'
import { DEFAULT_PAGE_SIZE } from '@/utils/constants'

export function DaftarSOPEvaluasi() {
  const navigate = useNavigate()
  const { opdId: opdIdFilter } = useSearch({
    from: '/evaluator/evaluasi/',
  })

  const [page, setPage] = useState(1)
  const [filterTab, setFilterTab] = useState<EvaluasiFilterTab>('pengajuan')
  const [searchQuery, setSearchQuery] = useState('')
  const debouncedSearch = useDebouncedValue(searchQuery, 300)

  const ringkasParams = useMemo(() => {
    const search =
      debouncedSearch.trim() !== '' ? debouncedSearch.trim() : undefined
    const base = {
      page,
      limit: DEFAULT_PAGE_SIZE,
      search,
      opdId: opdIdFilter,
    }
    if (filterTab === 'pengajuan') {
      return { ...base, statusIn: [...STATUS_PENGAJUAN_BERJALAN_EVALUATOR] }
    }
    return { ...base, statusIn: [...STATUS_RIWAYAT_FINAL_EVALUASI] }
  }, [page, debouncedSearch, opdIdFilter, filterTab])

  const { data, isLoading } = usePengajuanEvaluasiRingkas(ringkasParams)

  useEffect(() => {
    setPage(1)
  }, [filterTab, debouncedSearch, opdIdFilter])

  const items = data?.items ?? []
  const pagination = readPaginationMeta(data)

  return (
    <ListPageLayout
      breadcrumb={[{ label: 'Evaluasi SOP' }]}
      title="Evaluasi SOP"
      description="Pilih satu pengajuan evaluasi untuk membuka halaman penilaian (daftar SOP dalam pengajuan tersebut)."
      toolbar={
        <div className="flex flex-col gap-3 w-full">
          <SearchToolbar
            searchPlaceholder="Cari nama OPD..."
            searchValue={searchQuery}
            onSearchChange={(e) => setSearchQuery(e.target.value)}
          />
          <div className="flex flex-wrap items-center gap-2 w-full">
            <EvaluasiFilterTabs value={filterTab} onValueChange={setFilterTab} />
            {opdIdFilter ? (
              <Badge
                variant="secondary"
                className="gap-1 pl-2 pr-1 py-0.5 text-xs font-normal"
              >
                Filter OPD aktif
                <button
                  type="button"
                  className="rounded p-0.5 hover:bg-muted"
                  aria-label="Hapus filter OPD"
                  onClick={() =>
                    navigate({
                      to: ROUTES.EVALUATOR.EVALUASI,
                      search: {},
                      replace: true,
                    })
                  }
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ) : null}
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
                to: ROUTES.EVALUATOR.DETAIL_EVALUASI_PENGAJUAN,
                params: { id: row.pengajuanEvaluasiId },
                title: 'Buka penilaian',
              },
            ]}
          />
        )}
      />
    </ListPageLayout>
  )
}
