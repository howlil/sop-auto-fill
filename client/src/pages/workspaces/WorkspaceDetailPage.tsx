import { FormEvent, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, FileText, Plus, Users } from "lucide-react";
import { pelaksanaApi } from "@/api/pelaksana";
import { workspaceApi } from "@/api/workspaces";
import { workspaceSopApi } from "@/api/workspace-sops";
import { queryClient } from "@/config/query-client";

type CreateSource = "blank" | "template";

export function WorkspaceDetailPage({ workspaceId }: { workspaceId: string }) {
  const [createSource, setCreateSource] = useState<CreateSource>("blank");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [judul, setJudul] = useState("");
  const [nomorSop, setNomorSop] = useState("");
  const [namaLembaga, setNamaLembaga] = useState("");
  const [namaPelaksana, setNamaPelaksana] = useState("");

  const workspace = useQuery({
    queryKey: ["workspace", workspaceId],
    queryFn: () => workspaceApi.get(workspaceId),
  });
  const sops = useQuery({
    queryKey: ["workspace-sops", workspaceId],
    queryFn: () => workspaceSopApi.list(workspaceId),
  });
  const pelaksana = useQuery({
    queryKey: ["workspace-pelaksana", workspaceId],
    queryFn: () => pelaksanaApi.list(workspaceId),
  });
  const templates = useQuery({
    queryKey: ["sop-templates"],
    queryFn: () => workspaceSopApi.listTemplates(),
    enabled: createSource === "template",
  });
  const templatePreview = useQuery({
    queryKey: ["sop-template-preview", selectedTemplateId, workspaceId],
    queryFn: () => workspaceSopApi.previewTemplate(selectedTemplateId, workspaceId),
    enabled: createSource === "template" && selectedTemplateId.length > 0,
  });

  const createPelaksana = useMutation({
    mutationFn: () => pelaksanaApi.create(workspaceId, namaPelaksana.trim()),
    onSuccess: async () => {
      setNamaPelaksana("");
      await queryClient.invalidateQueries({ queryKey: ["workspace-pelaksana", workspaceId] });
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
      return workspaceSopApi.create({
        workspaceId,
        judul: judul.trim(),
        nomorSop: nomorSop.trim(),
      });
    },
    onSuccess: async (response) => {
      setJudul("");
      setNomorSop("");
      setNamaLembaga("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["workspace-sops", workspaceId] }),
        queryClient.invalidateQueries({ queryKey: ["workspace-pelaksana", workspaceId] }),
      ]);
      const detailId = response.data.detailSopId;
      if (detailId) window.location.assign(`/workspaces/${workspaceId}/sops/${detailId}`);
    },
  });

  const onPelaksanaSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!namaPelaksana.trim()) return;
    void createPelaksana.mutateAsync();
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!judul.trim() || !nomorSop.trim()) return;
    if (
      createSource === "template" &&
      (!selectedTemplateId || !namaLembaga.trim() || !templatePreview.isSuccess)
    ) {
      return;
    }
    void createSop.mutateAsync();
  };

  const switchCreateSource = (source: CreateSource) => {
    setCreateSource(source);
    if (source === "blank") {
      setSelectedTemplateId("");
      setNamaLembaga("");
    }
  };

  const items = sops.data?.data ?? [];
  const pelaksanaItems = pelaksana.data?.data ?? [];
  const templateItems = templates.data?.data ?? [];
  const preview = templatePreview.data?.data;
  const canCreate =
    judul.trim().length > 0 &&
    nomorSop.trim().length > 0 &&
    (createSource === "blank" ||
      (selectedTemplateId.length > 0 && namaLembaga.trim().length > 0 && templatePreview.isSuccess));

  return (
    <main className="min-h-screen bg-surface-subtle">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-6 py-4">
          <a href="/workspaces" className="rounded-lg border border-border p-2 hover:bg-muted" aria-label="Kembali ke workspace">
            <ArrowLeft className="h-4 w-4" />
          </a>
          <div>
            <h1 className="text-xl font-semibold text-foreground">{workspace.data?.data.name ?? "Workspace"}</h1>
            <p className="text-sm text-muted-foreground">SOP dan pelaksana dalam project ini</p>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-8">
        <section className="mb-6 rounded-xl border border-border bg-background p-5" aria-labelledby="workspace-pelaksana-title">
          <div className="mb-4 flex items-start gap-3">
            <Users className="mt-0.5 h-5 w-5 text-muted-foreground" aria-hidden />
            <div>
              <h2 id="workspace-pelaksana-title" className="font-semibold text-foreground">Pelaksana workspace</h2>
              <p className="mt-1 text-sm text-muted-foreground">Buat aktor yang dapat dipakai pada langkah SOP di workspace ini.</p>
            </div>
          </div>
          <form onSubmit={onPelaksanaSubmit} className="flex flex-col gap-3 sm:flex-row">
            <input
              value={namaPelaksana}
              onChange={(event) => setNamaPelaksana(event.target.value)}
              placeholder="Nama pelaksana"
              maxLength={255}
              className="h-11 flex-1 rounded-lg border border-border px-4 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={createPelaksana.isPending || !namaPelaksana.trim()}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground hover:bg-muted disabled:opacity-50"
            >
              <Plus className="h-4 w-4" /> Tambah Pelaksana
            </button>
          </form>
          {createPelaksana.isError ? (
            <p className="mt-3 text-sm text-destructive">Gagal menambahkan pelaksana.</p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2" aria-label="Daftar pelaksana workspace">
            {pelaksana.isLoading ? (
              <p className="text-sm text-muted-foreground">Memuat pelaksana...</p>
            ) : pelaksana.isError ? (
              <p className="text-sm text-destructive">Gagal memuat pelaksana.</p>
            ) : pelaksanaItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada pelaksana.</p>
            ) : (
              pelaksanaItems.map((item) => (
                <span key={item.id} className="rounded-full border border-border bg-surface-subtle px-3 py-1.5 text-sm text-foreground">
                  {item.namaPelaksana}
                </span>
              ))
            )}
          </div>
        </section>

        <section className="mb-8 rounded-xl border border-border bg-background p-5" aria-labelledby="create-sop-title">
          <div className="mb-4">
            <h2 id="create-sop-title" className="font-semibold text-foreground">Buat SOP</h2>
            <p className="mt-1 text-sm text-muted-foreground">Mulai dari dokumen kosong atau gunakan template sistem sebagai titik awal.</p>
          </div>

          <div className="mb-5 inline-flex rounded-lg border border-border bg-surface-subtle p-1" role="group" aria-label="Sumber pembuatan SOP">
            <button
              type="button"
              aria-pressed={createSource === "blank"}
              onClick={() => switchCreateSource("blank")}
              className={`rounded-md px-4 py-2 text-sm font-medium ${createSource === "blank" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
            >
              SOP Kosong
            </button>
            <button
              type="button"
              aria-pressed={createSource === "template"}
              onClick={() => switchCreateSource("template")}
              className={`rounded-md px-4 py-2 text-sm font-medium ${createSource === "template" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
            >
              Dari Template
            </button>
          </div>

          {createSource === "template" ? (
            <div className="mb-5 space-y-4">
              <label className="block text-sm font-medium text-foreground">
                Template sistem
                <select
                  value={selectedTemplateId}
                  onChange={(event) => setSelectedTemplateId(event.target.value)}
                  disabled={templates.isLoading || templates.isError}
                  className="mt-2 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Pilih template</option>
                  {templateItems.map((template) => (
                    <option key={template.templateId} value={template.templateId}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </label>

              {templates.isLoading ? <p className="text-sm text-muted-foreground">Memuat template...</p> : null}
              {templates.isError ? <p className="text-sm text-destructive">Gagal memuat template SOP.</p> : null}
              {selectedTemplateId && templatePreview.isLoading ? (
                <p className="text-sm text-muted-foreground">Menyiapkan preview template...</p>
              ) : null}
              {templatePreview.isError ? (
                <p className="text-sm text-destructive">Gagal menyiapkan preview template.</p>
              ) : null}

              {preview ? (
                <div className="rounded-lg border border-border bg-surface-subtle p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-foreground">{preview.template.name}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{preview.template.description}</p>
                    </div>
                    <span className="rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground">
                      {preview.stepCount} langkah
                    </span>
                  </div>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Aktor dipakai ulang</p>
                      <p className="mt-1 text-sm text-foreground">
                        {preview.actorsToReuse.length > 0
                          ? preview.actorsToReuse.map((actor) => actor.name).join(", ")
                          : "Tidak ada"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Aktor baru</p>
                      <p className="mt-1 text-sm text-foreground">
                        {preview.actorsToCreate.length > 0 ? preview.actorsToCreate.join(", ") : "Tidak ada"}
                      </p>
                    </div>
                  </div>
                  {Object.keys(preview.lampiranDefaults).length > 0 ? (
                    <p className="mt-4 text-xs text-muted-foreground">Template juga mengisi lampiran awal yang masih dapat diedit di editor.</p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-2">
            <input
              value={judul}
              onChange={(event) => setJudul(event.target.value)}
              placeholder="Judul SOP"
              maxLength={500}
              className="h-11 rounded-lg border border-border px-4 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              value={nomorSop}
              onChange={(event) => setNomorSop(event.target.value)}
              placeholder="Nomor SOP"
              maxLength={255}
              className="h-11 rounded-lg border border-border px-4 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
            {createSource === "template" ? (
              <input
                value={namaLembaga}
                onChange={(event) => setNamaLembaga(event.target.value)}
                placeholder="Nama lembaga"
                maxLength={500}
                className="h-11 rounded-lg border border-border px-4 text-sm outline-none focus:ring-2 focus:ring-blue-500 md:col-span-2"
              />
            ) : null}
            <div className="flex items-center gap-3 md:col-span-2">
              <button
                type="submit"
                disabled={createSop.isPending || !canCreate}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                {createSource === "template" ? "Buat dari Template" : "Buat SOP"}
              </button>
              {createSop.isError ? <p className="text-sm text-destructive">Gagal membuat SOP.</p> : null}
            </div>
          </form>
        </section>

        {sops.isLoading ? (
          <p className="text-sm text-muted-foreground">Memuat SOP...</p>
        ) : sops.isError ? (
          <p className="text-sm text-destructive">Gagal memuat SOP.</p>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-background p-10 text-center">
            <FileText className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="font-medium text-foreground">Belum ada SOP</p>
            <p className="mt-1 text-sm text-muted-foreground">Buat SOP pertama pada workspace ini.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-background">
            <div className="divide-y divide-border">
              {items.map((sop) => (
                <a
                  key={sop.id}
                  href={sop.detailSopId ? `/workspaces/${workspaceId}/sops/${sop.detailSopId}` : "#"}
                  className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-muted/40"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">{sop.judul}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {sop.nomorSop ?? "Belum ada nomor"} · Versi {sop.versi ?? 1}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground">
                    {sop.statusLabel}
                  </span>
                </a>
              ))}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
