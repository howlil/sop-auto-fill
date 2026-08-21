import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  FilePlus2,
  FileText,
  LayoutTemplate,
  Plus,
  Search,
  Sparkles,
} from "lucide-react";
import { workspaceApi } from "@/api/workspaces";
import {
  workspaceSopApi,
  type AiDraftProposal,
  type WorkspaceSopRow,
} from "@/api/workspace-sops";
import { queryClient } from "@/config/query-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/utils/cn";

type CreateSource = "blank" | "template" | "ai";
type StatusFilter = "ALL" | WorkspaceSopRow["status"];

const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: "ALL", label: "Semua" },
  { value: "DRAFT", label: "Draft" },
  { value: "COMPLETED", label: "Selesai" },
  { value: "ARCHIVED", label: "Arsip" },
];

const CREATE_OPTIONS: Array<{
  id: CreateSource;
  title: string;
  description: string;
  badge?: string;
  Icon: typeof Sparkles;
}> = [
  {
    id: "ai",
    title: "Buat dengan AI",
    description: "Ceritakan prosesnya, lalu tinjau draft terstruktur sebelum dibuat.",
    badge: "Direkomendasikan",
    Icon: Sparkles,
  },
  {
    id: "template",
    title: "Gunakan template",
    description: "Mulai dari struktur SOP sistem yang sudah memiliki langkah awal.",
    Icon: LayoutTemplate,
  },
  {
    id: "blank",
    title: "Mulai kosong",
    description: "Buat dokumen baru dan susun seluruh isinya sendiri.",
    Icon: FilePlus2,
  },
];

function formatUpdatedAt(value: string | null): string {
  if (!value) return "Belum ada aktivitas";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function WorkspaceDetailPage({ workspaceId }: { workspaceId: string }) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createSource, setCreateSource] = useState<CreateSource | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [judul, setJudul] = useState("");
  const [nomorSop, setNomorSop] = useState("");
  const [namaLembaga, setNamaLembaga] = useState("");
  const [deskripsiProses, setDeskripsiProses] = useState("");
  const [tujuanProses, setTujuanProses] = useState("");
  const [catatanTambahan, setCatatanTambahan] = useState("");
  const [aiProposal, setAiProposal] = useState<AiDraftProposal | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  const workspace = useQuery({
    queryKey: ["workspace", workspaceId],
    queryFn: () => workspaceApi.get(workspaceId),
  });
  const sops = useQuery({
    queryKey: ["workspace-sops", workspaceId],
    queryFn: () => workspaceSopApi.list(workspaceId),
  });
  const templates = useQuery({
    queryKey: ["sop-templates"],
    queryFn: () => workspaceSopApi.listTemplates(),
    enabled: isCreateOpen && createSource === "template",
  });
  const templatePreview = useQuery({
    queryKey: ["sop-template-preview", selectedTemplateId, workspaceId],
    queryFn: () => workspaceSopApi.previewTemplate(selectedTemplateId, workspaceId),
    enabled:
      isCreateOpen &&
      createSource === "template" &&
      selectedTemplateId.length > 0,
  });
  const aiAvailability = useQuery({
    queryKey: ["sop-ai-draft-availability"],
    queryFn: () => workspaceSopApi.aiDraftAvailability(),
    enabled: isCreateOpen && createSource === "ai",
  });

  const generateAiDraft = useMutation({
    mutationFn: () =>
      workspaceSopApi.generateAiDraft({
        workspaceId,
        deskripsiProses: deskripsiProses.trim(),
        ...(tujuanProses.trim() ? { tujuanProses: tujuanProses.trim() } : {}),
        ...(catatanTambahan.trim() ? { catatanTambahan: catatanTambahan.trim() } : {}),
      }),
    onSuccess: (response) => {
      setAiProposal(response.data.proposal);
      setJudul(response.data.proposal.suggestedTitle);
    },
  });

  const createSop = useMutation({
    mutationFn: async () => {
      if (createSource === "template") {
        if (!selectedTemplateId) throw new Error("Template SOP belum dipilih");
        return workspaceSopApi.createFromTemplate(selectedTemplateId, {
          workspaceId,
          judul: judul.trim(),
          nomorSop: nomorSop.trim(),
          namaLembaga: namaLembaga.trim(),
        });
      }
      if (createSource === "ai") {
        if (!aiProposal) throw new Error("Draft AI belum digenerate");
        return workspaceSopApi.createFromAiDraft({
          workspaceId,
          judul: judul.trim(),
          nomorSop: nomorSop.trim(),
          namaLembaga: namaLembaga.trim(),
          proposal: aiProposal,
        });
      }
      return workspaceSopApi.create({
        workspaceId,
        judul: judul.trim(),
        nomorSop: nomorSop.trim(),
      });
    },
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: ["workspace-sops", workspaceId] });
      const detailId = response.data.detailSopId;
      if (detailId) window.location.assign(`/workspaces/${workspaceId}/sops/${detailId}`);
    },
  });

  const items = sops.data?.data ?? [];
  const templateItems = templates.data?.data ?? [];
  const preview = templatePreview.data?.data;
  const aiEnabled = aiAvailability.data?.data.enabled === true;
  const workspaceName = workspace.data?.data.name ?? "Workspace";

  const visibleItems = useMemo(() => {
    const needle = searchQuery.trim().toLocaleLowerCase("id-ID");
    return items.filter((sop) => {
      if (statusFilter !== "ALL" && sop.status !== statusFilter) return false;
      if (!needle) return true;
      return [sop.judul, sop.nomorSop ?? "", sop.statusLabel]
        .join(" ")
        .toLocaleLowerCase("id-ID")
        .includes(needle);
    });
  }, [items, searchQuery, statusFilter]);

  const draftCount = items.filter((item) => item.status === "DRAFT").length;
  const completedCount = items.filter((item) => item.status === "COMPLETED").length;

  const canCreate =
    createSource !== null &&
    judul.trim().length > 0 &&
    nomorSop.trim().length > 0 &&
    (createSource === "blank" ||
      (createSource === "template" &&
        selectedTemplateId.length > 0 &&
        namaLembaga.trim().length > 0 &&
        templatePreview.isSuccess) ||
      (createSource === "ai" && aiProposal !== null && namaLembaga.trim().length > 0));

  const resetCreateState = () => {
    setCreateSource(null);
    setSelectedTemplateId("");
    setJudul("");
    setNomorSop("");
    setNamaLembaga("");
    setDeskripsiProses("");
    setTujuanProses("");
    setCatatanTambahan("");
    setAiProposal(null);
  };

  const handleCreateOpenChange = (open: boolean) => {
    setIsCreateOpen(open);
    if (!open) resetCreateState();
  };

  const chooseSource = (source: CreateSource) => {
    setCreateSource(source);
    setSelectedTemplateId("");
    setAiProposal(null);
    setJudul("");
    setNomorSop("");
    setNamaLembaga("");
  };

  const invalidateAiProposal = () => setAiProposal(null);

  const onGenerateAiDraft = () => {
    if (deskripsiProses.trim().length < 20 || !aiEnabled) return;
    void generateAiDraft.mutateAsync();
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!canCreate) return;
    void createSop.mutateAsync();
  };

  return (
    <main data-workspace-shell="workbench" className="min-h-screen bg-surface-subtle">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-5 py-3 sm:px-6">
          <a href="/workspaces" className="shrink-0 text-sm font-semibold text-foreground">
            SOP Auto Fill
          </a>
          <div className="hidden min-w-0 flex-1 items-center gap-2 text-sm text-muted-foreground sm:flex">
            <span>/</span>
            <a href="/workspaces" className="hover:text-foreground">Workspaces</a>
            <span>/</span>
            <span className="truncate font-medium text-foreground">{workspaceName}</span>
          </div>
          <Button type="button" className="ml-auto h-9 gap-2 px-4" onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            Buat SOP
          </Button>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl lg:min-h-[calc(100vh-57px)] lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside
          aria-label="Navigasi workspace"
          className="hidden border-r border-border bg-background px-4 py-6 lg:block"
        >
          <div className="px-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Workspace</p>
            <p className="mt-2 truncate text-sm font-semibold text-foreground">{workspaceName}</p>
            <p className="mt-1 text-xs text-muted-foreground">{items.length} SOP</p>
          </div>

          <nav className="mt-7 space-y-1">
            <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Navigasi</p>
            <a
              href={`/workspaces/${workspaceId}`}
              aria-current="page"
              className="flex items-center gap-2 rounded-lg bg-primary-subtle px-3 py-2 text-sm font-medium text-primary"
            >
              <FileText className="h-4 w-4" />
              Dokumen SOP
            </a>
          </nav>

          <a
            href="/workspaces"
            className="mt-8 flex items-center gap-2 px-2 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Kembali ke Workspaces
          </a>
        </aside>

        <section className="min-w-0 px-5 py-6 sm:px-6 sm:py-8 lg:px-8">
          <a
            href="/workspaces"
            className="mb-4 inline-flex items-center gap-2 text-xs font-medium text-muted-foreground lg:hidden"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Kembali ke Workspaces
          </a>

          <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Workspace</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{workspaceName}</h1>
              <p className="mt-1 text-sm text-muted-foreground">Kelola seluruh dokumen SOP dari satu workbench.</p>
            </div>
          </div>

          <div className="mb-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-border bg-background px-4 py-3">
              <p className="text-xs font-medium text-muted-foreground">Total SOP</p>
              <p className="mt-1 text-xl font-semibold text-foreground">{items.length}</p>
            </div>
            <div className="rounded-lg border border-border bg-background px-4 py-3">
              <p className="text-xs font-medium text-muted-foreground">Draft</p>
              <p className="mt-1 text-xl font-semibold text-foreground">{draftCount}</p>
            </div>
            <div className="rounded-lg border border-border bg-background px-4 py-3">
              <p className="text-xs font-medium text-muted-foreground">Selesai</p>
              <p className="mt-1 text-xl font-semibold text-foreground">{completedCount}</p>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-background">
            <div className="flex flex-col gap-4 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Dokumen SOP</h2>
                <p className="mt-1 text-xs text-muted-foreground">Cari, filter, lalu buka dokumen untuk melanjutkan pekerjaan.</p>
              </div>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                <label className="relative block min-w-0 sm:w-64">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Cari judul atau nomor SOP"
                    className="h-9 pl-9"
                    aria-label="Cari SOP"
                  />
                </label>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                  className="h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
                  aria-label="Filter status SOP"
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {sops.isLoading ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Memuat SOP...</div>
            ) : sops.isError ? (
              <div className="p-8 text-center text-sm text-destructive">Gagal memuat SOP.</div>
            ) : visibleItems.length === 0 ? (
              <div className="px-6 py-14 text-center">
                <FileText className="mx-auto mb-3 h-9 w-9 text-muted-foreground" />
                <p className="font-medium text-foreground">
                  {items.length === 0 ? "Belum ada SOP" : "Tidak ada SOP yang cocok"}
                </p>
                <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                  {items.length === 0
                    ? "Mulai dari AI, template, atau dokumen kosong."
                    : "Ubah kata pencarian atau filter status untuk melihat dokumen lain."}
                </p>
                {items.length === 0 ? (
                  <Button className="mt-5 gap-2" onClick={() => setIsCreateOpen(true)}>
                    <Plus className="h-4 w-4" /> Buat SOP pertama
                  </Button>
                ) : null}
              </div>
            ) : (
              <div className="divide-y divide-border">
                {visibleItems.map((sop) => (
                  <a
                    key={sop.id}
                    href={sop.detailSopId ? `/workspaces/${workspaceId}/sops/${sop.detailSopId}` : "#"}
                    className="group flex items-center justify-between gap-4 px-4 py-3.5 transition-colors hover:bg-muted/40"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-medium text-foreground group-hover:text-primary">{sop.judul}</p>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[11px] font-medium",
                            sop.status === "DRAFT" && "bg-amber-50 text-amber-700",
                            sop.status === "COMPLETED" && "bg-emerald-50 text-emerald-700",
                            sop.status === "ARCHIVED" && "bg-slate-100 text-slate-600",
                          )}
                        >
                          {sop.statusLabel}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {sop.nomorSop ?? "Belum ada nomor"} · v{sop.versi ?? 1} · Diperbarui {formatUpdatedAt(sop.terakhirDiperbarui)}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs font-medium text-muted-foreground transition-colors group-hover:text-foreground">Buka →</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      <Dialog open={isCreateOpen} onOpenChange={handleCreateOpenChange}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{createSource ? "Siapkan SOP baru" : "Buat SOP baru"}</DialogTitle>
            <DialogDescription>
              {createSource
                ? "Lengkapi informasi minimum. Detail lainnya dapat disusun setelah draft dibuat."
                : "Pilih cara memulai yang paling sesuai dengan kondisi dokumen Anda."}
            </DialogDescription>
          </DialogHeader>

          {createSource === null ? (
            <div className="grid gap-3 sm:grid-cols-3">
              {CREATE_OPTIONS.map(({ id, title, description, badge, Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => chooseSource(id)}
                  className={cn(
                    "relative flex min-h-48 flex-col rounded-xl border p-4 text-left transition-all",
                    id === "ai"
                      ? "border-primary/40 bg-primary-subtle/40 hover:border-primary hover:bg-primary-subtle/70"
                      : "border-border bg-background hover:border-primary/40 hover:bg-muted/40",
                  )}
                >
                  {badge ? (
                    <span className="absolute right-3 top-3 rounded-full bg-primary px-2 py-1 text-[11px] font-semibold text-primary-foreground">{badge}</span>
                  ) : null}
                  <span className="mb-8 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-foreground">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="mt-auto text-base font-semibold text-foreground">{title}</span>
                  <span className="mt-1.5 text-sm leading-5 text-muted-foreground">{description}</span>
                </button>
              ))}
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-5">
              <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 px-3 py-2.5">
                <div className="flex items-center gap-2 text-sm">
                  {createSource === "ai" ? <Sparkles className="h-4 w-4" /> : null}
                  {createSource === "template" ? <LayoutTemplate className="h-4 w-4" /> : null}
                  {createSource === "blank" ? <FilePlus2 className="h-4 w-4" /> : null}
                  <span className="font-medium text-foreground">{CREATE_OPTIONS.find((option) => option.id === createSource)?.title}</span>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => setCreateSource(null)}>Ganti cara</Button>
              </div>

              {createSource === "ai" ? (
                <div className="space-y-4">
                  <label className="block text-sm font-medium text-foreground">
                    Apa proses yang ingin Anda dokumentasikan?
                    <Textarea
                      value={deskripsiProses}
                      onChange={(event) => {
                        setDeskripsiProses(event.target.value);
                        invalidateAiProposal();
                      }}
                      placeholder="Contoh: Proses dimulai ketika unit mengajukan dokumen. Admin memeriksa kelengkapan, evaluator menilai, lalu kepala bagian menyetujui hasil..."
                      maxLength={8000}
                      rows={6}
                      className="mt-2 text-sm"
                    />
                    <span className="mt-1.5 block text-xs font-normal text-muted-foreground">Sebutkan pelaksana, aktivitas utama, keputusan penting, input, dan hasil proses.</span>
                  </label>
                  <details className="rounded-lg border border-border px-4 py-3">
                    <summary className="cursor-pointer text-sm font-medium text-foreground">Tambahkan konteks opsional</summary>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <label className="text-sm font-medium text-foreground">
                        Tujuan proses
                        <Textarea
                          value={tujuanProses}
                          onChange={(event) => {
                            setTujuanProses(event.target.value);
                            invalidateAiProposal();
                          }}
                          rows={3}
                          maxLength={2000}
                          className="mt-2"
                        />
                      </label>
                      <label className="text-sm font-medium text-foreground">
                        Catatan tambahan
                        <Textarea
                          value={catatanTambahan}
                          onChange={(event) => {
                            setCatatanTambahan(event.target.value);
                            invalidateAiProposal();
                          }}
                          rows={3}
                          maxLength={2000}
                          className="mt-2"
                        />
                      </label>
                    </div>
                  </details>

                  {aiAvailability.isSuccess && !aiEnabled ? (
                    <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">AI drafting belum aktif pada environment ini. Gunakan template atau dokumen kosong.</p>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2"
                    onClick={onGenerateAiDraft}
                    disabled={!aiEnabled || generateAiDraft.isPending || deskripsiProses.trim().length < 20}
                  >
                    <Sparkles className="h-4 w-4" />
                    {generateAiDraft.isPending ? "Menyusun draft…" : aiProposal ? "Generate ulang" : "Generate draft"}
                  </Button>
                  {generateAiDraft.isError ? <p className="text-sm text-destructive">Draft AI gagal dibuat. Periksa deskripsi lalu coba lagi.</p> : null}
                  {aiProposal ? (
                    <div className="rounded-xl border border-border bg-muted/30 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-foreground">{aiProposal.suggestedTitle}</p>
                          <p className="mt-1 text-sm text-muted-foreground">{aiProposal.actors.length} pelaksana · {aiProposal.steps.length} langkah. Tinjau sebelum membuat draft.</p>
                        </div>
                        <span className="rounded-full bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground">Preview AI</span>
                      </div>
                      <ol className="mt-4 space-y-2">
                        {aiProposal.steps.slice(0, 6).map((step) => (
                          <li key={step.urutan} className="flex gap-3 text-sm">
                            <span className="font-semibold text-muted-foreground">{step.urutan}.</span>
                            <span className="text-foreground">{step.kegiatan}<span className="ml-2 text-muted-foreground">· {step.actorName}</span></span>
                          </li>
                        ))}
                      </ol>
                      {aiProposal.steps.length > 6 ? <p className="mt-2 text-xs text-muted-foreground">+{aiProposal.steps.length - 6} langkah lainnya</p> : null}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {createSource === "template" ? (
                <div className="space-y-4">
                  <label className="block text-sm font-medium text-foreground">
                    Template sistem
                    <select
                      value={selectedTemplateId}
                      onChange={(event) => setSelectedTemplateId(event.target.value)}
                      disabled={templates.isLoading || templates.isError}
                      className="mt-2 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="">Pilih template</option>
                      {templateItems.map((template) => (
                        <option key={template.templateId} value={template.templateId}>{template.name}</option>
                      ))}
                    </select>
                  </label>
                  {preview ? (
                    <div className="rounded-xl border border-border bg-muted/30 p-4">
                      <p className="font-medium text-foreground">{preview.template.name}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{preview.template.description}</p>
                      <p className="mt-3 text-sm text-foreground">{preview.stepCount} langkah · {preview.actorsToReuse.length + preview.actorsToCreate.length} pelaksana</p>
                    </div>
                  ) : null}
                  {templatePreview.isError ? <p className="text-sm text-destructive">Preview template gagal dimuat.</p> : null}
                </div>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-medium text-foreground sm:col-span-2">
                  Judul SOP
                  <Input
                    value={judul}
                    onChange={(event) => setJudul(event.target.value)}
                    placeholder="Contoh: SOP Verifikasi Dokumen"
                    maxLength={500}
                    className="mt-2 h-11"
                  />
                </label>
                <label className="text-sm font-medium text-foreground">
                  Nomor SOP
                  <Input
                    value={nomorSop}
                    onChange={(event) => setNomorSop(event.target.value)}
                    placeholder="Contoh: SOP-ORG-001"
                    maxLength={255}
                    className="mt-2 h-11"
                  />
                </label>
                {createSource === "template" || createSource === "ai" ? (
                  <label className="text-sm font-medium text-foreground">
                    Nama lembaga
                    <Input
                      value={namaLembaga}
                      onChange={(event) => setNamaLembaga(event.target.value)}
                      placeholder="Nama instansi / unit"
                      maxLength={500}
                      className="mt-2 h-11"
                    />
                  </label>
                ) : null}
              </div>

              {createSop.isError ? <p className="text-sm text-destructive">Gagal membuat SOP.</p> : null}

              <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-between">
                <Button type="button" variant="ghost" onClick={() => setCreateSource(null)}>← Kembali</Button>
                <Button type="submit" disabled={!canCreate || createSop.isPending} className="gap-2">
                  <Plus className="h-4 w-4" />
                  {createSop.isPending ? "Membuat draft…" : "Buat dan lanjutkan"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
