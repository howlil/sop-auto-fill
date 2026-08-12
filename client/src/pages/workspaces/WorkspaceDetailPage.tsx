import { FormEvent, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, FileText, Plus, Users } from "lucide-react";
import { pelaksanaApi } from "@/api/pelaksana";
import { workspaceApi } from "@/api/workspaces";
import { workspaceSopApi } from "@/api/workspace-sops";
import { queryClient } from "@/config/query-client";

export function WorkspaceDetailPage({ workspaceId }: { workspaceId: string }) {
  const [judul, setJudul] = useState("");
  const [nomorSop, setNomorSop] = useState("");
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

  const createPelaksana = useMutation({
    mutationFn: () => pelaksanaApi.create(workspaceId, namaPelaksana.trim()),
    onSuccess: async () => {
      setNamaPelaksana("");
      await queryClient.invalidateQueries({ queryKey: ["workspace-pelaksana", workspaceId] });
    },
  });

  const createSop = useMutation({
    mutationFn: () => workspaceSopApi.create({ workspaceId, judul: judul.trim(), nomorSop: nomorSop.trim() }),
    onSuccess: async (response) => {
      setJudul("");
      setNomorSop("");
      await queryClient.invalidateQueries({ queryKey: ["workspace-sops", workspaceId] });
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
    void createSop.mutateAsync();
  };

  const items = sops.data?.data ?? [];
  const pelaksanaItems = pelaksana.data?.data ?? [];

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

        <form onSubmit={onSubmit} className="mb-8 grid gap-3 rounded-xl border border-border bg-background p-5 md:grid-cols-[1fr_220px_auto]">
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
          <button
            type="submit"
            disabled={createSop.isPending || !judul.trim() || !nomorSop.trim()}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> Buat SOP
          </button>
        </form>

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
