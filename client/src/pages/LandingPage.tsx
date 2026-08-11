/**
 * Beranda publik SOPFlow (Biro Organisasi Sekda Sumbar).
 */
import { useState, useEffect } from 'react'
import { Link } from '@tanstack/react-router'
import { ROUTES } from '@/utils/constants'
import logoSvg from '@/assets/logo.svg'
import heroBg from '@/assets/Kantor_Gubernur_Sumbar_belakang.jpg'
import { APP_DISPLAY_NAME } from '@/config/env'
import {
  FileText,
  CheckCircle,
  ArrowRight,
  Clock,
  Search,
  PenTool,
  Send,
  Award,
  ChevronDown,
  Shield,
  Archive,
} from 'lucide-react'
import { cn } from '@/utils/cn'
import { Card } from '@/components/ui/card'

// ==================== DATA ====================

const workflowSteps = [
  {
    step: '01',
    title: 'Susun',
    description: 'OPD menyusun draft SOP AP lewat form dan diagram alur; komponen mengikuti pedoman PermenPAN-RB Nomor 35 Tahun 2012.',
    icon: PenTool,
    color: 'blue',
  },
  {
    step: '02',
    title: 'Evaluasi',
    description: 'Evaluator Biro Organisasi menilai format, alur, dan substansi; catatan perbaikan tersimpan di sistem.',
    icon: Search,
    color: 'amber',
  },
  {
    step: '03',
    title: 'Tanda Tangan',
    description: 'PJ Evaluator Organisasi meninjau hasil penilaian dan berita acara sebelum pengajuan ke Kepala OPD.',
    icon: CheckCircle,
    color: 'green',
  },
  {
    step: '04',
    title: 'Sahkan',
    description: 'Kepala OPD menandatangani SOP dengan TTE BSRE; status dan riwayat penandatanganan tercatat.',
    icon: Award,
    color: 'purple',
  },
]

const roleBenefits = [
  {
    role: 'Penyusun',
    description: 'Mengerjakan isi SOP dan perbaikan setelah evaluasi. Draft disimpan per versi, tidak perlu bolak-balik kirim berkas fisik.',
    features: ['Form komponen SOP AP', 'Diagram alur prosedur', 'Pratinjau dokumen', 'Riwayat revisi'],
    icon: FileText,
    gradient: 'from-blue-500 to-blue-600',
  },
  {
    role: 'Evaluator',
    description: 'Memeriksa pengajuan sesuai rubrik Biro Organisasi. Skor dan catatan per dokumen bisa dilihat PJ Evaluator Organisasi.',
    features: ['Rubrik penilaian', 'Daftar tugas evaluasi', 'Catatan per SOP', 'Status pengajuan'],
    icon: Search,
    gradient: 'from-amber-500 to-amber-600',
  },
  {
    role: 'PJ Evaluator Organisasi',
    description: 'Mengkoordinasikan evaluasi lintas OPD, mengelola tim evaluator/penyusun, dan memverifikasi berita acara.',
    features: ['Grafik evaluasi tahunan', 'Manajemen akun tim', 'Tanda tangan berita acara', 'Laporan evaluasi'],
    icon: CheckCircle,
    gradient: 'from-green-500 to-green-600',
  },
  {
    role: 'Kepala OPD',
    description: 'Melihat pengajuan SOP OPD sendiri dan mengesahkan setelah proses evaluasi di Biro selesai.',
    features: ['Daftar pengajuan OPD', 'Pengesahan TTE', 'Riwayat penandatanganan', 'Arsip SOP berlaku'],
    icon: Award,
    gradient: 'from-purple-500 to-purple-600',
  },
]

const faqs = [
  {
    question: 'Untuk apa sistem ini dipakai?',
    answer: 'Mendukung pengelolaan SOP Administrasi Pemerintahan (SOP AP) di lingkungan Pemerintah Provinsi Sumatera Barat: penyusunan di OPD, evaluasi dan verifikasi di Biro Organisasi Sekretariat Daerah, lalu pengesahan internal dan arsip digital.',
  },
  {
    question: 'Siapa yang punya akun?',
    answer: 'Akun dibuat oleh admin sesuai peran: Penyusun, PJ Penyusun, Evaluator, PJ Evaluator Organisasi, dan Kepala OPD. Hak akses mengikuti OPD masing-masing, kecuali peran Biro Organisasi yang menilai lintas OPD.',
  },
  {
    question: 'Bagaimana tanda tangan elektroniknya?',
    answer: 'Pengesahan memakai TTE BSRE. Penandatangan memasukkan PIN; sistem mencatat waktu, pengguna, dan dokumen yang ditandatangani untuk keperluan audit.',
  },
  {
    question: 'Apakah SOP lama bisa dicari?',
    answer: 'SOP yang sudah masuk sistem disimpan per versi dengan status (misalnya berlaku, digantikan, atau dicabut). Arsip publik dapat dibuka tanpa login; untuk mengubah dokumen, pengguna harus masuk sesuai perannya.',
  },
]

// ==================== COMPONENTS ====================

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex min-h-12 w-full items-center justify-between px-4 py-4 text-left transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary sm:px-5"
        aria-expanded={open}
      >
        <span className="text-sm font-medium text-foreground pr-4">{question}</span>
        <ChevronDown className={cn('w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-200', open && 'rotate-180')} />
      </button>
      <div className={cn('overflow-hidden transition-all duration-200', open ? 'max-h-48' : 'max-h-0')}>
        <p className="px-4 pb-4 text-sm leading-relaxed text-secondary-foreground sm:px-5">{answer}</p>
      </div>
    </div>
  )
}

function RoleTabs() {
  const [active, setActive] = useState(0)
  const [isTransitioning, setIsTransitioning] = useState(false)

  const tabs = [
    { label: 'Penyusun', icon: FileText },
    { label: 'Evaluator', icon: Search },
    { label: 'PJ Evaluator Organisasi', icon: CheckCircle },
    { label: 'Kepala OPD', icon: Award },
  ]

  const themes = [
    { accent: 'bg-blue-600', text: 'text-blue-600', light: 'bg-blue-50', border: 'border-blue-200', ring: 'ring-blue-500/20', glow: 'shadow-blue-500/10' },
    { accent: 'bg-amber-500', text: 'text-amber-600', light: 'bg-amber-50', border: 'border-amber-200', ring: 'ring-amber-500/20', glow: 'shadow-amber-500/10' },
    { accent: 'bg-green-600', text: 'text-green-600', light: 'bg-green-50', border: 'border-green-200', ring: 'ring-green-500/20', glow: 'shadow-green-500/10' },
    { accent: 'bg-purple-600', text: 'text-purple-600', light: 'bg-purple-50', border: 'border-purple-200', ring: 'ring-purple-500/20', glow: 'shadow-purple-500/10' },
  ]

  const handleTabClick = (index: number) => {
    if (index === active || isTransitioning) return
    setIsTransitioning(true)
    setTimeout(() => {
      setActive(index)
      setIsTransitioning(false)
    }, 200)
  }

  return (
    <div className="relative">
      {/* Tab bar */}
      <div className="mb-6 overflow-x-auto pb-2 sm:mb-8 sm:overflow-visible sm:pb-0">
        <div className="mx-auto flex w-max min-w-full gap-1 rounded-2xl bg-surface-muted p-1.5 sm:w-fit sm:min-w-0">
          {tabs.map((tab, i) => (
            <button
              key={tab.label}
              type="button"
              onClick={() => handleTabClick(i)}
              className={cn(
                'flex min-h-11 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:flex-none sm:px-5',
                active === i
                  ? 'bg-surface text-foreground shadow-surface'
                  : 'text-muted-foreground hover:text-secondary-foreground'
              )}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Card display */}
      <div className="relative min-h-[560px] sm:min-h-[500px]">
        {[0, 1, 2, 3].map((i) => {
          const t = themes[i]
          const isActive = active === i
          return (
            <div
              key={tabs[i].label}
              className={cn(
                'absolute inset-0 transition-all duration-500 ease-out',
                isActive
                  ? 'opacity-100 translate-y-0 scale-100'
                  : 'opacity-0 translate-y-4 scale-[0.98] pointer-events-none'
              )}
              style={{ transitionDuration: isTransitioning ? '200ms' : '500ms' }}
            >
              <div className={cn(
                'flex h-full flex-col rounded-2xl border p-4 transition-all duration-500 sm:rounded-3xl sm:p-8',
                isActive ? cn('bg-surface', t.border, 'shadow-xl', t.glow) : 'bg-surface-subtle border-border'
              )}>
                {/* Top accent line */}
                <div className={cn('h-1 rounded-full mb-6', t.accent)} style={{ width: '48px' }} />

                {/* Header */}
                <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-start sm:gap-4">
                  <div className={cn('w-12 h-12 rounded-2xl flex items-center justify-center', t.accent)}>
                    {(() => { const Icon = tabs[i].icon; return <Icon className="w-6 h-6 text-white" /> })()}
                  </div>
                  <div className="flex-1">
                    <h4 className="text-xl font-medium text-foreground mb-1">{tabs[i].label}</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">{roleBenefits[i].description}</p>
                  </div>
                </div>

                {/* Feature pills */}
                <div className="flex flex-wrap gap-2 mb-6">
                  {roleBenefits[i].features.map((f) => (
                    <span key={f} className={cn('text-xs px-3 py-1.5 rounded-full font-medium', t.light, t.text)}>
                      {f}
                    </span>
                  ))}
                </div>

                {/* Preview */}
                <div className="flex-1">
                  <div className={cn('rounded-2xl border p-5 h-full', t.light)}>
                    <RolePreview roleIndex={i} />
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function RolePreview({ roleIndex }: { roleIndex: number }) {
  if (roleIndex === 0) {
    return (
      <div className="space-y-1.5">
        {['Pelayanan · Draft', 'Evaluasi · Review', 'Tanda Tangan · Final'].map((item, i) => (
          <div key={i} className="flex items-center justify-between bg-surface rounded-lg border px-3 py-2">
            <div className="flex items-center gap-2 min-w-0">
              <FileText className={cn('w-3.5 h-3.5 shrink-0', i === 0 ? 'text-blue-500' : i === 1 ? 'text-amber-500' : 'text-green-500')} />
              <span className="text-[11px] text-secondary-foreground truncate">SOP {item.split(' · ')[0]}</span>
            </div>
            <span className={cn('text-[9px] px-1.5 py-0.5 rounded-full font-medium shrink-0',
              i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
            )}>{item.split(' · ')[1]}</span>
          </div>
        ))}
      </div>
    )
  }
  if (roleIndex === 1) {
    return (
      <div className="space-y-2">
        <div className="grid grid-cols-3 gap-2">
          {[{ label: 'Disetujui', value: '12', color: 'green' }, { label: 'Revisi', value: '3', color: 'amber' }, { label: 'Skor', value: '87%', color: 'blue' }].map((s) => (
            <div key={s.label} className={cn('rounded-lg border p-2.5 text-center', s.color === 'green' ? 'bg-green-50 border-green-100' : s.color === 'amber' ? 'bg-amber-50 border-amber-100' : 'bg-blue-50 border-blue-100')}>
              <div className={cn('text-lg font-medium', s.color === 'green' ? 'text-green-700' : s.color === 'amber' ? 'text-amber-700' : 'text-blue-700')}>{s.value}</div>
              <div className={cn('text-[9px]', s.color === 'green' ? 'text-green-600' : s.color === 'amber' ? 'text-amber-600' : 'text-blue-600')}>{s.label}</div>
            </div>
          ))}
        </div>
        <div className="bg-surface rounded-lg border p-3 space-y-2">
          {[{ name: 'Kelengkapan', pct: 92 }, { name: 'Kesesuaian', pct: 78 }].map((r) => (
            <div key={r.name}>
              <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                <span>{r.name}</span><span className="font-medium">{r.pct}%</span>
              </div>
              <div className="w-full h-1.5 bg-surface-muted rounded-full overflow-hidden">
                <div className={cn('h-full rounded-full', r.pct >= 90 ? 'bg-green-500' : 'bg-amber-500')} style={{ width: `${r.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }
  if (roleIndex === 2) {
    return (
      <div className="space-y-3">
        <div className="bg-surface rounded-lg border p-4">
          <div className="flex items-end gap-1.5 h-14 mb-2">
            {[40, 55, 45, 70, 55, 80, 65, 90].map((h, i) => (
              <div key={i} className="flex-1 rounded-t bg-green-500" style={{ height: `${h}%`, opacity: 0.4 + (h / 100) * 0.6 }} />
            ))}
          </div>
          <div className="flex justify-between text-[8px] text-muted-foreground">
            <span>Q1</span><span>Q2</span><span>Q3</span><span>Q4</span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[{ l: 'Total', v: '24', c: 'text-foreground' }, { l: 'Selesai', v: '18', c: 'text-green-600' }, { l: 'Revisi', v: '6', c: 'text-amber-600' }].map((s) => (
            <div key={s.l} className="bg-surface rounded-lg border p-2 text-center">
              <div className={cn('text-lg font-medium', s.c)}>{s.v}</div>
              <div className="text-[8px] text-muted-foreground">{s.l}</div>
            </div>
          ))}
        </div>
      </div>
    )
  }
  return (
    <div className="space-y-1.5">
      {['Manajemen Risiko', 'Pengadaan Barang', 'Kepegawaian'].map((name, i) => (
        <div key={name} className="flex items-center justify-between bg-surface rounded-lg border px-3 py-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className={cn('w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[8px] font-medium',
              i === 0 ? 'bg-red-100 text-red-600' : i === 1 ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-600'
            )}>{['KR', 'PB', 'KP'][i]}</div>
            <span className="text-[11px] text-secondary-foreground truncate">{name}</span>
          </div>
          <div className={cn('w-2 h-2 rounded-full shrink-0', i === 0 ? 'bg-red-500' : i === 1 ? 'bg-amber-500' : 'bg-green-500')} />
        </div>
      ))}
      <div className="bg-purple-600 rounded-lg p-2.5 text-center mt-2">
        <span className="text-[10px] text-white font-medium">Tanda Tangan Elektronik →</span>
      </div>
    </div>
  )
}

// ==================== PAGE ====================

export function LandingPage() {
  const [scrolled, setScrolled] = useState(false)

  /* Langganan scroll window: bukan data fetching (selaras react-skil §3). */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="min-h-screen overflow-x-hidden bg-surface text-foreground">
      {/* ===== HEADER ===== */}
      <header className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
        scrolled
          ? 'border-b border-border bg-surface/90 backdrop-blur-md shadow-surface'
          : 'bg-transparent border-0'
      )}>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <img src={logoSvg} alt={APP_DISPLAY_NAME} className="h-9 w-9 shrink-0" />
            <div>
              <h1 className={cn('text-sm font-semibold leading-tight transition-colors', scrolled ? 'text-foreground' : 'text-white')}>{APP_DISPLAY_NAME}</h1>
            </div>
          </div>
          <Link
            to={ROUTES.AUTH.LOGIN}
            className={cn(
              'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full px-4 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 sm:px-5 sm:text-sm',
              scrolled
                ? 'bg-blue-600 text-white shadow-surface hover:bg-blue-700'
                : 'border border-white/40 bg-surface text-blue-700 shadow-surface hover:bg-blue-50'
            )}
          >
            <span className="hidden sm:inline">Masuk ke Sistem</span>
            <span className="sm:hidden">Masuk</span>
            <ArrowRight className="w-3.5 h-3.5" aria-hidden />
          </Link>
        </div>
      </header>

      {/* ===== HERO ===== */}
      <section
        className="relative flex min-h-[100svh] w-full flex-col justify-center bg-cover bg-center bg-no-repeat px-4 pb-12 pt-24 text-sm sm:px-6 md:min-h-[720px] md:pb-20 md:pt-28 lg:px-8"
        style={{ backgroundImage: `url(${heroBg})` }}
      >
        {/* Dark overlay for readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-black/30" />

        <div className="relative mx-auto flex max-w-full flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-2xl border border-white/30 bg-surface/10 px-3 py-2 text-center backdrop-blur-sm transition-colors hover:border-white/50 sm:rounded-full sm:px-4">
          <Clock className="w-4 h-4 text-white" />
          <span className="font-medium text-white">Biro Organisasi · Sekda Provinsi Sumatera Barat</span>
          <span className="hidden text-white/60 sm:inline">—</span>
          <a href="#cara-kerja" className="flex items-center gap-1 font-medium text-white hover:text-blue-100">
            <span>Alur kerja</span>
            <svg width="19" height="19" viewBox="0 0 19 19" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
              <path d="M3.959 9.5h11.083m0 0L9.501 3.958M15.042 9.5l-5.541 5.54" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </div>

        <h2 className="relative mx-auto mt-7 max-w-4xl text-balance text-center text-[clamp(2.25rem,8vw,4.5rem)] font-semibold leading-[1.05] tracking-[-0.035em] text-white sm:mt-8">
          Pengelolaan SOP AP dari OPD hingga pengesahan internal
        </h2>

        <p className="relative mx-auto mt-5 max-w-2xl text-pretty text-center text-sm leading-relaxed text-gray-200 sm:text-base md:mt-6">
          Satu tempat untuk menyusun SOP, mengajukan evaluasi ke Biro Organisasi, mencatat revisi,
          mengesahkan dengan TTE, dan menyimpan arsip versi yang berlaku.
        </p>

        <div className="relative mx-auto mt-8 flex w-full max-w-3xl flex-col items-stretch gap-3 sm:mt-9">
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <Link
              to={ROUTES.ARSIP.PREFIX}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-white/35 bg-surface/10 px-5 py-3 text-sm font-medium text-white backdrop-blur-sm transition hover:bg-surface/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            >
              <Archive className="h-4 w-4" aria-hidden />
              Lihat Arsip SOP
            </Link>
            <Link
              to={ROUTES.VALIDASI.PDF}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-white/35 bg-surface/10 px-5 py-3 text-sm font-medium text-white backdrop-blur-sm transition hover:bg-surface/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            >
              <Shield className="h-4 w-4" aria-hidden />
              Validasi PDF
            </Link>
          </div>
        </div>
      </section>

      {/* ===== HOW IT WORKS ===== */}
      <section id="cara-kerja" className="scroll-mt-16 bg-surface-subtle py-14 sm:py-16 md:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mb-9 space-y-3 text-center sm:mb-12">
            <h3 className="text-2xl md:text-3xl font-medium text-foreground">Cara Kerja</h3>
            <p className="text-secondary-foreground max-w-xl mx-auto text-sm">
              Alur yang dipakai saat ini: OPD menyusun, Biro mengevaluasi, PJ Evaluator Organisasi memverifikasi, Kepala OPD mengesahkan.
            </p>
          </div>

          <div className="mx-auto grid gap-4 md:grid-cols-5">
            {/* Card 01 - Susun (spans 3 cols) */}
            <Card className="group overflow-hidden border-blue-200/60 bg-gradient-to-br from-blue-50 to-blue-100/50 shadow-blue-900/5 md:col-span-3 md:rounded-none md:rounded-tl-xl">
              <div className="relative p-5 sm:p-6 md:p-8">
                <div className="flex flex-col items-start gap-4 sm:flex-row sm:gap-5">
                  <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center shrink-0 shadow-lg shadow-blue-600/20">
                    <PenTool className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <span className="text-xs font-mono font-semibold text-blue-600 bg-blue-100 px-2.5 py-0.5 rounded-full">Langkah 01</span>
                    <h4 className="text-lg font-medium text-foreground mt-2 mb-1">{workflowSteps[0].title}</h4>
                    <p className="text-sm text-secondary-foreground leading-relaxed max-w-md">{workflowSteps[0].description}</p>
                  </div>
                </div>
                {/* High-level mock UI */}
                <div className="relative mt-6 bg-surface rounded-xl border overflow-hidden">
                  <div className="flex items-center gap-1.5 px-3 py-2 border-b bg-surface-subtle">
                    <div className="w-2.5 h-2.5 rounded-full bg-surface-strong" />
                    <div className="w-2.5 h-2.5 rounded-full bg-border" />
                    <div className="w-2.5 h-2.5 rounded-full bg-surface-muted" />
                    <span className="text-[10px] text-muted-foreground ml-2">Swimlane Editor</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 p-3 sm:gap-3 sm:p-4">
                    <div className="space-y-2">
                      <div className="h-2 bg-surface-muted rounded w-16" />
                      <div className="h-16 bg-surface-subtle rounded border" />
                      <div className="h-2 bg-surface-muted rounded w-12" />
                    </div>
                    <div className="space-y-2">
                      <div className="h-2 bg-surface-muted rounded w-14" />
                      <div className="h-12 bg-surface-subtle rounded border" />
                      <div className="h-8 bg-surface-muted/50 rounded" />
                      <div className="h-2 bg-surface-muted rounded w-10" />
                    </div>
                    <div className="space-y-2">
                      <div className="h-2 bg-surface-muted rounded w-16" />
                      <div className="h-14 bg-surface-subtle rounded border" />
                      <div className="h-2 bg-surface-muted rounded w-12" />
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Card 02 - Evaluasi (spans 2 cols) */}
            <Card className="group overflow-hidden border-amber-200/60 bg-gradient-to-br from-amber-50 to-amber-100/50 shadow-amber-900/5 md:col-span-2 md:rounded-none md:rounded-tr-xl">
              <div className="flex h-full flex-col p-5 sm:p-6 md:p-8">
                <div className="flex-1">
                  <div className="flex items-center gap-4 mb-5">
                    <div className="w-12 h-12 rounded-xl bg-amber-500 flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/20">
                      <Search className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <span className="text-xs font-mono font-semibold text-amber-700 bg-amber-100 px-2.5 py-0.5 rounded-full">Langkah 02</span>
                      <h4 className="text-lg font-medium text-foreground mt-1">{workflowSteps[1].title}</h4>
                    </div>
                  </div>
                  <p className="text-sm text-secondary-foreground leading-relaxed">{workflowSteps[1].description}</p>
                </div>
                {/* High-level mock UI */}
                <div className="mt-6 space-y-2">
                  <div className="flex items-center gap-2 bg-surface rounded-lg border p-3">
                    <div className="w-2 h-2 rounded-full bg-green-400" />
                    <div className="h-1.5 bg-border rounded flex-1" />
                    <div className="h-4 w-8 bg-green-100 rounded text-[9px] text-green-700 flex items-center justify-center font-medium">Pass</div>
                  </div>
                  <div className="flex items-center gap-2 bg-surface rounded-lg border p-3">
                    <div className="w-2 h-2 rounded-full bg-amber-400" />
                    <div className="h-1.5 bg-border rounded flex-1" />
                    <div className="h-4 w-10 bg-amber-100 rounded text-[9px] text-amber-700 flex items-center justify-center font-medium">Review</div>
                  </div>
                  <div className="flex items-center gap-2 bg-surface rounded-lg border p-3">
                    <div className="w-2 h-2 rounded-full bg-green-400" />
                    <div className="h-1.5 bg-border rounded flex-1" />
                    <div className="h-4 w-8 bg-green-100 rounded text-[9px] text-green-700 flex items-center justify-center font-medium">Pass</div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Card 03 - Verifikasi (spans 2 cols) */}
            <Card className="group overflow-hidden border-green-200/60 bg-gradient-to-br from-green-50 to-green-100/50 shadow-green-900/5 md:col-span-2 md:rounded-none md:rounded-bl-xl">
              <div className="p-5 sm:p-6 md:p-8">
                <div className="flex flex-col items-start gap-4 sm:flex-row sm:gap-5">
                  <div className="w-12 h-12 rounded-xl bg-green-600 flex items-center justify-center shrink-0 shadow-lg shadow-green-600/20">
                    <CheckCircle className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <span className="text-xs font-mono font-semibold text-green-700 bg-green-100 px-2.5 py-0.5 rounded-full">Langkah 03</span>
                    <h4 className="text-lg font-medium text-foreground mt-2 mb-1">{workflowSteps[2].title}</h4>
                    <p className="text-sm text-secondary-foreground leading-relaxed">{workflowSteps[2].description}</p>
                  </div>
                </div>
                {/* High-level mock UI */}
                <div className="mt-5 space-y-2">
                  <div className="flex items-center gap-2 text-xs text-secondary-foreground bg-surface rounded-lg border p-2.5">
                    <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />
                    <span>Format SOP sesuai standar</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-secondary-foreground bg-surface rounded-lg border p-2.5">
                    <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />
                    <span>Evaluasi telah lengkap</span>
                  </div>
                </div>
              </div>
            </Card>

            {/* Card 04 - Sahkan (spans 3 cols) */}
            <Card className="group overflow-hidden border-purple-200/60 bg-gradient-to-br from-purple-50 to-purple-100/50 shadow-purple-900/5 md:col-span-3 md:rounded-none md:rounded-br-xl">
              <div className="p-5 sm:p-6 md:p-8">
                <div className="flex flex-col items-start gap-4 sm:flex-row sm:gap-5">
                  <div className="w-12 h-12 rounded-xl bg-purple-600 flex items-center justify-center shrink-0 shadow-lg shadow-purple-600/20">
                    <Award className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <span className="text-xs font-mono font-semibold text-purple-700 bg-purple-100 px-2.5 py-0.5 rounded-full">Langkah 04</span>
                    <h4 className="text-lg font-medium text-foreground mt-2 mb-1">{workflowSteps[3].title}</h4>
                    <p className="text-sm text-secondary-foreground leading-relaxed max-w-md">{workflowSteps[3].description}</p>
                  </div>
                </div>
                {/* High-level mock UI */}
                <div className="mt-6 grid grid-cols-3 gap-2 sm:grid-cols-6">
                  <div className="aspect-square rounded-lg border-2 border-dashed" />
                  <div className="aspect-square rounded-lg bg-purple-100 border flex items-center justify-center">
                    <span className="text-[10px] font-medium text-purple-600">TTE</span>
                  </div>
                  <div className="aspect-square rounded-lg border-2 border-dashed" />
                  <div className="aspect-square rounded-lg bg-purple-100 border flex items-center justify-center">
                    <span className="text-[10px] font-medium text-purple-600">PIN</span>
                  </div>
                  <div className="aspect-square rounded-lg border-2 border-dashed" />
                  <div className="aspect-square rounded-lg bg-purple-100 border flex items-center justify-center">
                    <Shield className="w-4 h-4 text-purple-500" />
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* ===== ROLE BENEFITS ===== */}
      <section className="py-14 sm:py-16 md:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mb-9 space-y-3 text-center sm:mb-12">
            <h3 className="text-2xl md:text-3xl font-medium text-foreground">Tampilan menurut peran pengguna</h3>
            <p className="text-secondary-foreground max-w-xl mx-auto text-sm">
              Menu dan halaman mengikuti tugas masing-masing aktor dalam pengelolaan SOP AP.
            </p>
          </div>

          <RoleTabs />
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section className="bg-surface-subtle py-14 sm:py-16 md:py-20">
        <div className="mx-auto max-w-2xl px-4 sm:px-6">
          <div className="text-center space-y-3 mb-10">
            <h3 className="text-2xl md:text-3xl font-medium text-foreground">Pertanyaan Umum</h3>
            <p className="text-secondary-foreground text-sm">Ringkasan singkat sebelum masuk ke sistem.</p>
          </div>
          <div className="space-y-3">
            {faqs.map((faq) => (
              <FAQItem key={faq.question} {...faq} />
            ))}
          </div>
        </div>
      </section>

      {/* ===== CTA BANNER ===== */}
      <section className="bg-gradient-to-r from-blue-600 to-indigo-600 py-14 sm:py-16">
        <div className="mx-auto max-w-4xl space-y-6 px-4 text-center sm:px-6">
          <Send className="w-10 h-10 text-blue-200 mx-auto" />
          <h3 className="text-2xl md:text-3xl font-medium text-white">
            Butuh akun untuk OPD atau Biro Organisasi?
          </h3>
          <p className="text-blue-100 max-w-lg mx-auto text-sm leading-relaxed">
            Pembuatan akun dilakukan oleh admin PJ Evaluator Organisasi.
            Jika sudah punya akun, masuk lewat tombol di header; arsip SOP dan validasi PDF tetap bisa diakses tanpa login.
          </p>
          <div className="mx-auto grid max-w-md grid-cols-1 gap-3 sm:max-w-none sm:flex sm:flex-wrap sm:items-center sm:justify-center">
            <Link
              to={ROUTES.ARSIP.PREFIX}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-white/40 px-6 text-sm font-medium text-white transition hover:bg-surface/10 sm:w-auto"
            >
              <Archive className="h-4 w-4" aria-hidden />
              Lihat Arsip SOP
            </Link>
            <Link
              to={ROUTES.VALIDASI.PDF}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-white/40 px-6 text-sm font-medium text-white transition hover:bg-surface/10 sm:w-auto"
            >
              <Shield className="h-4 w-4" aria-hidden />
              Validasi PDF
            </Link>
          </div>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="border-t border-border bg-surface relative z-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-center sm:flex-row sm:px-6 sm:text-left lg:px-8">
          <div className="flex flex-col items-center gap-3 min-[400px]:flex-row sm:items-center">
            <img src={logoSvg} alt="Logo" className="w-8 h-8" />
            <span className="text-sm text-secondary-foreground">{APP_DISPLAY_NAME}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Hak cipta dilindungi.
          </p>
        </div>
      </footer>
    </div>
  )
}
