import { useMemo, useState, useEffect } from 'react'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import {
  BarChart3,
  Building2,
  Award,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  ChevronDown,
} from 'lucide-react'
import { ListPageLayout } from '@/components/layout/ListPageLayout'
import { LoadingState } from '@/components/ui/loading-state'
import { GrafikEvaluasiTahunPicker } from '@/pages/pj-evaluator/grafik-evaluasi/grafik-evaluasi-tahun-picker'
import { useEvaluasiGrafikTahunan } from "@/api/evaluasi";
import type { EvaluasiGrafikTahunanQueryParams } from '@/types/dto/evaluasi.dto'
import { NILAI_OPD_SKOR_MAX } from '@/types/dto/evaluasi.dto'

interface DetailOpdPerTahun {
  tahun: string
  opdId: string
  opdNama: string
  jumlahEvaluasi: number
  rataRataSkor: number
}

/* ─── Helpers ─── */

function delta(a: number, b: number): number | null {
  if (b === 0) return null
  return Math.round(((a - b) / b) * 100)
}

function formatSkor(skor: number): string {
  if (skor <= 0) return '—'
  const clamped = Math.min(skor, NILAI_OPD_SKOR_MAX)
  return `${clamped.toFixed(1)}/${NILAI_OPD_SKOR_MAX}`
}

function skorColor(skor: number): string {
  if (skor === 0) return 'text-muted-foreground'
  if (skor >= 4) return 'text-emerald-600'
  if (skor >= 3) return 'text-blue-600'
  if (skor >= 2) return 'text-amber-600'
  return 'text-red-600'
}

const INITIAL_SHOW = 15

const TAHUN_MIN = 2000
const TAHUN_MAX = 2100
const RENTANG_DEBOUNCE_MS = 400

function clampYear(y: number): number {
  return Math.min(TAHUN_MAX, Math.max(TAHUN_MIN, Math.round(y)))
}

/** Query default untuk praprefetch route — tahun berjalan. */
export function getDefaultGrafikEvaluasiTahunQuery(): EvaluasiGrafikTahunanQueryParams {
  return { tahun: clampYear(new Date().getFullYear()) }
}

/* ─── Component ─── */

export function GrafikEvaluasiTahunan() {
  const [filterTahun, setFilterTahun] = useState<string>('')
  const [selectedYear, setSelectedYear] = useState(() => clampYear(new Date().getFullYear()))
  const [pickerOpen, setPickerOpen] = useState(false)
  const [rankBy, setRankBy] = useState<'skor' | 'evaluasi'>('skor')
  const [showAll, setShowAll] = useState(false)

  const queryParamsCommitted = useMemo((): EvaluasiGrafikTahunanQueryParams => {
    return { tahun: clampYear(selectedYear) }
  }, [selectedYear])

  const debouncedQuery = useDebouncedValue(queryParamsCommitted, RENTANG_DEBOUNCE_MS)

  const { data: grafik, isLoading, isFetching } = useEvaluasiGrafikTahunan(debouncedQuery)

  const summary = useMemo(() => {
    if (!grafik?.ringkasanPerTahun?.length) return []
    return grafik.ringkasanPerTahun.map((s) => ({
      tahun: String(s.tahun),
      totalOpd: s.jumlahOpdDenganPenilaian,
      rataRataNilai: s.rataRataSkorOpd ?? 0,
      totalPengajuan: s.totalPenilaian,
    }))
  }, [grafik])

  const detail = useMemo(() => {
    if (!grafik?.ringkasanPerTahun?.length) return []
    return grafik.ringkasanPerTahun.flatMap((s) =>
      s.perOpd.map((p) => ({
        tahun: String(s.tahun),
        opdId: p.opdId,
        opdNama: p.opdNama,
        jumlahEvaluasi: p.jumlahEvaluasi,
        rataRataSkor: p.rataRataSkor ?? 0,
      })),
    )
  }, [grafik])

  const opdList = useMemo(() => {
    if (!grafik?.daftarOpd?.length) return []
    return grafik.daftarOpd.map((o) => ({ id: o.opdId, nama: o.opdNama }))
  }, [grafik])

  useEffect(() => {
    const y = String(clampYear(selectedYear))
    if (summary.length === 0) {
      setFilterTahun('')
      return
    }
    const tersedia = new Set(summary.map((s) => s.tahun))
    if (tersedia.has(y)) {
      setFilterTahun(y)
      return
    }
    setFilterTahun(summary[0]!.tahun)
  }, [selectedYear, summary])

  /* ─── derived data ─── */

  const detailByTahun = useMemo(() => {
    const map: Record<string, DetailOpdPerTahun[]> = {}
    for (const row of detail) {
      ;(map[row.tahun] ??= []).push(row)
    }
    return map
  }, [detail])

  const currentYear = useMemo(
    () => summary.find((s) => s.tahun === filterTahun) ?? null,
    [summary, filterTahun],
  )

  const prevYear = useMemo(() => {
    const idx = summary.findIndex((s) => s.tahun === filterTahun)
    return idx > 0 ? summary[idx - 1] : null
  }, [summary, filterTahun])

  /* ranked horizontal bar data */
  const rankedData = useMemo(() => {
    if (!filterTahun) return []
    const rows = detailByTahun[filterTahun] ?? []
    const byOpd = new Map<string, DetailOpdPerTahun>()
    for (const row of rows) byOpd.set(row.opdId, row)

    const allRows: DetailOpdPerTahun[] = opdList.map((opd) => {
      const existing = byOpd.get(opd.id)
      if (existing) return existing
      return { tahun: filterTahun, opdId: opd.id, opdNama: opd.nama, jumlahEvaluasi: 0, rataRataSkor: 0 }
    })

    const sorted = [...allRows]
    if (rankBy === 'skor') {
      sorted.sort((a, b) => b.rataRataSkor - a.rataRataSkor || b.jumlahEvaluasi - a.jumlahEvaluasi)
    } else {
      sorted.sort((a, b) => b.jumlahEvaluasi - a.jumlahEvaluasi || b.rataRataSkor - a.rataRataSkor)
    }

    return sorted
  }, [filterTahun, detailByTahun, opdList, rankBy])

  const maxRankedValue = useMemo(() => {
    if (rankBy === 'evaluasi') {
      return Math.max(1, ...rankedData.map((r) => r.jumlahEvaluasi))
    }
    return NILAI_OPD_SKOR_MAX
  }, [rankedData, rankBy])

  const displayedData = showAll ? rankedData : rankedData.slice(0, INITIAL_SHOW)
  const hasMore = rankedData.length > INITIAL_SHOW

  /* analitik */
  const analytics = useMemo(() => {
    if (!currentYear) return null
    const rows = detailByTahun[filterTahun] ?? []
    const totalOPD = opdList.length
    const evaluatedRows = rows.filter((r) => r.jumlahEvaluasi > 0)
    const evaluated = evaluatedRows.length
    const coveragePct = totalOPD > 0 ? Math.round((evaluated / totalOPD) * 100) : 0
    const skorBuckets = { high: 0, mid: 0, low: 0, none: 0 }
    for (const r of evaluatedRows) {
      if (r.rataRataSkor >= 4) skorBuckets.high++
      else if (r.rataRataSkor >= 3) skorBuckets.mid++
      else if (r.rataRataSkor > 0) skorBuckets.low++
      else skorBuckets.none++
    }
    const topOPD = evaluatedRows.length > 0
      ? [...evaluatedRows].sort((a, b) => b.rataRataSkor - a.rataRataSkor)[0]
      : null
    return { totalOPD, evaluated, coveragePct, skorBuckets, topOPD }
  }, [currentYear, detailByTahun, filterTahun, opdList.length])

  const deltaPenilaian = currentYear && prevYear ? delta(currentYear.totalPengajuan, prevYear.totalPengajuan) : null
  const deltaOPD = currentYear && prevYear ? delta(currentYear.totalOpd, prevYear.totalOpd) : null
  const deltaSkor = currentYear && prevYear && prevYear.rataRataNilai > 0 ? delta(currentYear.rataRataNilai, prevYear.rataRataNilai) : null

  return (
    <ListPageLayout
      breadcrumb={[{ label: 'Grafik Evaluasi Tahunan' }]}
      title="Grafik Evaluasi Tahunan"
      description={`Analitik penilaian OPD per tahun (skor ${NILAI_OPD_SKOR_MAX} poin). Satu OPD dapat dievaluasi lebih dari sekali dalam setahun.`}
    >
      {isLoading ? (
        <LoadingState message="Memuat data evaluasi…" />
      ) : (
        <div className="space-y-4">
          {/* ── Tahun untuk query API ── */}
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-medium text-muted-foreground">Tahun</span>
              <GrafikEvaluasiTahunPicker
                open={pickerOpen}
                onOpenChange={setPickerOpen}
                tahunMin={TAHUN_MIN}
                tahunMax={TAHUN_MAX}
                selectedYear={selectedYear}
                onSelectYear={setSelectedYear}
              />
            </div>
            {isFetching && !isLoading ? (
              <span className="pb-2 text-[11px] text-muted-foreground" role="status">Memperbarui data…</span>
            ) : null}
          </div>

            {/* ── KPI Cards ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <KPICard
                label="Total Penilaian"
                value={currentYear?.totalPengajuan ?? 0}
                suffix="kali"
                delta={deltaPenilaian}
                icon={<BarChart3 className="w-4 h-4 text-blue-600" />}
                iconBg="bg-blue-50"
                year={filterTahun}
              />
              <KPICard
                label="OPD Dievaluasi"
                value={currentYear?.totalOpd ?? 0}
                suffix={`/ ${opdList.length}`}
                delta={deltaOPD}
                icon={<Building2 className="w-4 h-4 text-violet-600" />}
                iconBg="bg-violet-50"
                year={filterTahun}
              />
              <KPICard
                label="Rata-rata Skor"
                value={currentYear?.rataRataNilai ?? 0}
                suffix={`/ ${NILAI_OPD_SKOR_MAX}`}
                isDecimal
                delta={deltaSkor}
                icon={<Target className="w-4 h-4 text-emerald-600" />}
                iconBg="bg-emerald-50"
                year={filterTahun}
              />
              <KPICard
                label="Cakupan OPD"
                value={analytics?.coveragePct ?? 0}
                suffix="%"
                icon={<Award className="w-4 h-4 text-amber-600" />}
                iconBg="bg-amber-50"
                year={filterTahun}
                sub={
                  analytics
                    ? `${analytics.evaluated} dari ${analytics.totalOPD} OPD`
                    : undefined
                }
              />
            </div>

            {/* ── Distribusi Skor + Horizontal Ranked Bar Chart ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              {/* Distribusi skor */}
              {analytics && (
                <section className="bg-surface rounded-lg border border-border p-4">
                  <h2 className="text-sm font-semibold text-foreground mb-3">
                    Distribusi Skor — {filterTahun}
                  </h2>

                  <div className="space-y-3">
                    <ScoreBucket label="Tinggi (≥4)" count={analytics.skorBuckets.high} total={analytics.evaluated} color="bg-emerald-500" />
                    <ScoreBucket label="Sedang (3–3,9)" count={analytics.skorBuckets.mid} total={analytics.evaluated} color="bg-blue-500" />
                    <ScoreBucket label="Rendah (&lt;3)" count={analytics.skorBuckets.low} total={analytics.evaluated} color="bg-amber-500" />
                    {analytics.skorBuckets.none > 0 && (
                      <ScoreBucket label="Belum ada skor" count={analytics.skorBuckets.none} total={analytics.evaluated} color="bg-surface-strong" />
                    )}
                  </div>

                  {analytics.topOPD && (
                    <div className="mt-4 pt-3 border-t border-border">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Skor Tertinggi</p>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-foreground truncate">{analytics.topOPD.opdNama}</span>
                        <span className={`text-sm font-bold tabular-nums ${skorColor(analytics.topOPD.rataRataSkor)}`}>
                          {formatSkor(analytics.topOPD.rataRataSkor)}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Coverage ring */}
                  <div className="mt-4 pt-3 border-t border-border flex items-center gap-3">
                    <CoverageRing pct={analytics.coveragePct} />
                    <div>
                      <p className="text-xs font-medium text-foreground">Cakupan evaluasi</p>
                      <p className="text-[11px] text-muted-foreground">
                        {analytics.totalOPD - analytics.evaluated} OPD belum dievaluasi
                      </p>
                    </div>
                  </div>
                </section>
              )}

              {/* ── Horizontal Ranked Bar Chart ── */}
              <section className="lg:col-span-2 bg-surface rounded-lg border border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <h2 className="text-sm font-semibold text-foreground">
                    Peringkat OPD — {filterTahun}
                  </h2>
                  <div
                    className="flex items-center overflow-hidden rounded-md border border-border"
                    role="group"
                    aria-label="Urutkan peringkat OPD berdasarkan"
                  >
                    {(['skor', 'evaluasi'] as const).map((key) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setRankBy(key)}
                        aria-pressed={rankBy === key}
                        className={`px-2.5 py-1 text-[11px] font-medium transition-all ${
                          rankBy === key
                            ? 'bg-blue-50 text-blue-700'
                            : 'text-muted-foreground hover:bg-surface-subtle'
                        }`}
                      >
                        {key === 'skor' ? 'Skor' : 'Jumlah'}
                      </button>
                    ))}
                  </div>
                </div>

                {displayedData.length === 0 ? (
                  <div className="py-8 text-center text-xs text-muted-foreground">
                    Tidak ada data untuk filter yang dipilih.
                  </div>
                ) : (
                  <div className="space-y-1">
                    {displayedData.map((row) => {
                      const val = rankBy === 'skor' ? row.rataRataSkor : row.jumlahEvaluasi
                      const pct = (val / maxRankedValue) * 100
                      const hasEval = row.jumlahEvaluasi > 0
                      const rank = rankedData.indexOf(row) + 1
                      const barColor = rankBy === 'skor' ? skorBarColor(row.rataRataSkor) : 'bg-blue-500'

                      return (
                        <div
                          key={row.opdId}
                          className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-surface-subtle transition-all"
                        >
                          {/* rank number */}
                          <span className={`w-5 text-[11px] tabular-nums text-right shrink-0 font-semibold ${
                            rank <= 3 ? 'text-amber-600' : 'text-muted-foreground'
                          }`}>
                            {rank}
                          </span>

                          {/* OPD name */}
                          <span className="w-40 text-xs text-foreground truncate shrink-0" title={row.opdNama}>
                            {row.opdNama}
                          </span>

                          {/* horizontal bar */}
                          <div className="flex-1 h-5 bg-surface-subtle rounded overflow-hidden relative">
                            <div
                              className={`h-full rounded transition-all ${hasEval ? barColor : 'bg-border'}`}
                              style={{ width: `${Math.max(pct, hasEval ? 3 : 1)}%` }}
                            />
                          </div>

                          {/* value */}
                          <span className={`w-10 text-right text-xs font-semibold tabular-nums shrink-0 ${
                            hasEval ? skorColor(row.rataRataSkor) : 'text-muted-foreground'
                          }`}>
                            {rankBy === 'skor' ? formatSkor(row.rataRataSkor) : row.jumlahEvaluasi}
                          </span>

                          {/* secondary value */}
                          <span className="w-8 text-right text-[10px] text-muted-foreground tabular-nums shrink-0">
                            {rankBy === 'skor'
                              ? (row.jumlahEvaluasi > 0 ? `${row.jumlahEvaluasi}×` : '')
                              : (row.rataRataSkor > 0 ? formatSkor(row.rataRataSkor) : '')
                            }
                          </span>
                        </div>
                      )
                    })}

                    {/* show more / less */}
                    {hasMore && (
                      <button
                        type="button"
                        onClick={() => setShowAll((v) => !v)}
                        className="w-full flex items-center justify-center gap-1 py-2 text-[11px] text-blue-600 font-medium hover:bg-blue-50 rounded transition-all"
                      >
                        <ChevronDown className={`w-3 h-3 transition-transform ${showAll ? 'rotate-180' : ''}`} />
                        {showAll
                          ? 'Tampilkan lebih sedikit'
                          : `Tampilkan semua (${rankedData.length} OPD)`
                        }
                      </button>
                    )}

                    {/* legend */}
                    <div className="flex items-center justify-between pt-2 border-t border-border mt-1">
                      <span className="text-[10px] text-muted-foreground">
                        {displayedData.length} / {rankedData.length} OPD
                      </span>
                      {rankBy === 'skor' && (
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500" />≥4</span>
                          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-blue-500" />3–3,9</span>
                          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-400" />2–2,9</span>
                          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-400" />&lt;2</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </section>
            </div>

        </div>
      )}
    </ListPageLayout>
  )
}

/* ─── Sub-components ─── */

function skorBarColor(skor: number): string {
  if (skor >= 4) return 'bg-emerald-500'
  if (skor >= 3) return 'bg-blue-500'
  if (skor >= 2) return 'bg-amber-400'
  if (skor > 0) return 'bg-red-400'
  return 'bg-border'
}

function CoverageRing({ pct }: { pct: number }) {
  const circumference = 2 * Math.PI * 14
  const filled = (pct / 100) * circumference
  return (
    <div className="relative w-14 h-14 shrink-0">
      <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90" aria-hidden>
        <circle cx="18" cy="18" r="14" fill="none" stroke="#f3f4f6" strokeWidth="3" />
        <circle
          cx="18" cy="18" r="14"
          fill="none"
          stroke="#3b82f6"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference - filled}`}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-foreground">
        {pct}%
      </span>
    </div>
  )
}

function KPICard({
  label,
  value,
  suffix,
  delta: pctDelta,
  icon,
  iconBg,
  year,
  isDecimal,
  sub,
}: {
  label: string
  value: number
  suffix?: string
  delta?: number | null
  icon: React.ReactNode
  iconBg: string
  year: string
  isDecimal?: boolean
  sub?: string
}) {
  return (
    <div className="bg-surface rounded-lg border border-border p-3 hover:shadow-surface transition-all">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] text-muted-foreground font-medium">{label}</p>
        <div className={`w-7 h-7 rounded-md ${iconBg} flex items-center justify-center shrink-0`}>
          {icon}
        </div>
      </div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="text-xl font-bold text-foreground tabular-nums">
          {isDecimal ? value.toFixed(1) : value}
        </span>
        {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
      </div>
      <div className="mt-1 flex items-center gap-1.5">
        {pctDelta != null && <DeltaBadge value={pctDelta} />}
        {sub ? (
          <span className="text-[10px] text-muted-foreground">{sub}</span>
        ) : (
          <span className="text-[10px] text-muted-foreground">tahun {year}</span>
        )}
      </div>
    </div>
  )
}

function DeltaBadge({ value }: { value: number }) {
  const isPositive = value >= 0
  return (
    <span
      className={`inline-flex items-center gap-0.5 px-1 py-px rounded text-[10px] font-semibold ${
        isPositive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
      }`}
    >
      {isPositive ? (
        <ArrowUpRight className="w-2.5 h-2.5" />
      ) : (
        <ArrowDownRight className="w-2.5 h-2.5" />
      )}
      {isPositive ? '+' : ''}{value}%
    </span>
  )
}

function ScoreBucket({
  label,
  count,
  total,
  color,
}: {
  label: string
  count: number
  total: number
  color: string
}) {
  const pct = total > 0 ? (count / total) * 100 : 0
  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-xs text-secondary-foreground">{label}</span>
        <span className="text-xs font-semibold text-foreground tabular-nums">{count}</span>
      </div>
      <div className="h-2 bg-surface-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${Math.max(pct, count > 0 ? 4 : 0)}%` }} />
      </div>
    </div>
  )
}
