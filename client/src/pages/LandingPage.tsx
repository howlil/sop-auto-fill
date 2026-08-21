import { Link } from '@tanstack/react-router'
import {
  ArrowRight,
  Check,
  FileText,
  GitBranch,
  LayoutTemplate,
  Network,
  Sparkles,
} from 'lucide-react'
import logoSvg from '@/assets/logo.svg'
import { APP_DISPLAY_NAME } from '@/config/env'
import { Button } from '@/components/ui/button'

const workflow = [
  {
    step: '01',
    title: 'Mulai dengan cara yang paling cepat',
    description: 'Gunakan AI, template, atau dokumen kosong tanpa harus menyiapkan struktur sistem terlebih dahulu.',
  },
  {
    step: '02',
    title: 'Susun SOP secara terarah',
    description: 'Lengkapi informasi dasar, pelaksana, prosedur, dan informasi pendukung melalui editor berbasis tugas.',
  },
  {
    step: '03',
    title: 'Periksa dan lihat hasilnya',
    description: 'Review kualitas dokumen, lihat representasi Flowchart/BPMN, lalu cek dokumen final sebelum dikunci.',
  },
  {
    step: '04',
    title: 'Selesaikan dan versioning',
    description: 'Versi yang selesai menjadi immutable. Perubahan selanjutnya dibuat melalui versi baru agar riwayat tetap jelas.',
  },
]

const capabilities = [
  {
    title: 'Guided SOP authoring',
    description: 'Editor mengikuti urutan pekerjaan user, bukan struktur module aplikasi.',
    Icon: FileText,
  },
  {
    title: 'Template & AI drafting',
    description: 'Bangun draft awal lebih cepat lalu tetap tinjau dan edit dengan kontrol penuh.',
    Icon: Sparkles,
  },
  {
    title: 'Flowchart & BPMN',
    description: 'Diagram dihasilkan dari langkah prosedur yang sama sehingga authoring tetap fokus pada proses.',
    Icon: Network,
  },
  {
    title: 'Versioned documents',
    description: 'Dokumen selesai dikunci dan perubahan berikutnya tidak menimpa versi sebelumnya.',
    Icon: GitBranch,
  },
]

export function LandingPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-6">
          <Link to="/" className="flex items-center gap-3" aria-label={`${APP_DISPLAY_NAME} beranda`}>
            <img src={logoSvg} alt="" className="h-9 w-9" />
            <div>
              <p className="text-sm font-semibold text-foreground">{APP_DISPLAY_NAME}</p>
              <p className="text-xs text-muted-foreground">SOP authoring workspace</p>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/login">Masuk</Link>
            </Button>
            <Button size="sm" className="gap-1.5" asChild>
              <Link to="/workspaces">
                Buka workspace <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="border-b border-border bg-surface-subtle">
        <div className="mx-auto grid max-w-6xl gap-12 px-5 py-16 sm:px-6 md:py-24 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-secondary-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Dari proses menjadi SOP yang terstruktur
            </div>
            <h1 className="mt-6 max-w-3xl text-balance text-4xl font-semibold tracking-[-0.035em] text-foreground sm:text-5xl lg:text-6xl">
              Susun SOP tanpa tersesat di dalam workflow aplikasi.
            </h1>
            <p className="mt-5 max-w-2xl text-pretty text-base leading-7 text-secondary-foreground sm:text-lg">
              Fokus pada isi proses. Pilih cara memulai, susun langkah secara terarah, review kualitasnya, lalu lihat dokumen, Flowchart, dan BPMN dari satu sumber data.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button size="lg" className="gap-2" asChild>
                <Link to="/workspaces">
                  Mulai menyusun SOP <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <a href="#workflow">Lihat cara kerja</a>
              </Button>
            </div>
          </div>

          <div className="rounded-3xl border border-border bg-background p-5 shadow-sm sm:p-6">
            <div className="flex items-center justify-between gap-3 border-b border-border pb-4">
              <div>
                <p className="text-sm font-semibold text-foreground">SOP Verifikasi Dokumen</p>
                <p className="mt-1 text-xs text-muted-foreground">Draft · v1 · Tersimpan</p>
              </div>
              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">Draft</span>
            </div>
            <div className="grid gap-4 pt-5 sm:grid-cols-[150px_1fr]">
              <div className="space-y-1.5">
                {['Informasi Dasar', 'Pelaksana', 'Prosedur', 'Informasi Pendukung', 'Review'].map((item, index) => (
                  <div
                    key={item}
                    className={`rounded-lg px-3 py-2 text-xs font-medium ${index === 2 ? 'bg-primary-subtle text-primary' : 'text-muted-foreground'}`}
                  >
                    {index + 1}. {item}
                  </div>
                ))}
              </div>
              <div className="rounded-2xl bg-surface-subtle p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Langkah 3</p>
                <p className="mt-2 text-sm font-semibold text-foreground">Prosedur</p>
                <div className="mt-4 space-y-3">
                  {[
                    ['1', 'Menerima dokumen pengajuan'],
                    ['2', 'Memeriksa kelengkapan'],
                    ['3', 'Dokumen lengkap?'],
                  ].map(([number, text]) => (
                    <div key={number} className="flex items-center gap-3 rounded-xl border border-border bg-background px-3 py-3">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted text-xs font-semibold text-muted-foreground">{number}</span>
                      <span className="text-sm text-foreground">{text}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex gap-2">
                  <span className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-secondary-foreground">+ Tambah langkah</span>
                  <span className="rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground">Lanjut</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="workflow" className="scroll-mt-20 border-b border-border bg-background py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-5 sm:px-6">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-primary">Workflow</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">Satu alur dari ide sampai versi final.</h2>
            <p className="mt-3 text-base leading-7 text-muted-foreground">
              Setiap tahap mempunyai tujuan yang jelas dan membawa user ke aksi berikutnya tanpa harus memahami struktur internal aplikasi.
            </p>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {workflow.map((item) => (
              <article key={item.step} className="rounded-2xl border border-border bg-surface-subtle p-5 sm:p-6">
                <span className="text-xs font-semibold tracking-wider text-primary">{item.step}</span>
                <h3 className="mt-3 text-lg font-semibold text-foreground">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-surface-subtle py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-5 sm:px-6">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
            <div>
              <p className="text-sm font-semibold text-primary">Capability</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">Feature tetap lengkap, tetapi tidak menguasai workflow.</h2>
              <p className="mt-3 text-base leading-7 text-muted-foreground">
                AI, diagram, versioning, dan template hadir ketika dibutuhkan. Primary flow tetap sederhana: buat, susun, review, preview, complete.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {capabilities.map(({ title, description, Icon }) => (
                <article key={title} className="rounded-2xl border border-border bg-background p-5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-foreground">
                    <Icon className="h-4.5 w-4.5" />
                  </span>
                  <h3 className="mt-4 text-base font-semibold text-foreground">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-background py-14">
        <div className="mx-auto flex max-w-4xl flex-col items-center px-5 text-center sm:px-6">
          <LayoutTemplate className="h-8 w-8 text-primary" />
          <h2 className="mt-4 text-2xl font-semibold text-foreground">Mulai dari proses yang sudah Anda pahami.</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            Draft dapat dibuat dengan AI atau template, tetapi keputusan akhir tetap berada pada user sebelum dokumen diselesaikan.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-secondary-foreground">
            {['Autosave', 'AI advisory', 'Flowchart & BPMN', 'Immutable completed version'].map((item) => (
              <span key={item} className="inline-flex items-center gap-1.5">
                <Check className="h-4 w-4 text-emerald-600" /> {item}
              </span>
            ))}
          </div>
          <Button className="mt-7 gap-2" asChild>
            <Link to="/workspaces">
              Buka workspace <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      <footer className="border-t border-border bg-surface-subtle">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span>{APP_DISPLAY_NAME}</span>
          <span>SOP authoring · review · preview · versioning</span>
        </div>
      </footer>
    </main>
  )
}
