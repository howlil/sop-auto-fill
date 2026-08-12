import { FormEvent, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { FolderOpen, LogOut, Plus } from "lucide-react";
import { useAuth } from "@/api/auth";
import { workspaceApi } from "@/api/workspaces";
import { queryClient } from "@/config/query-client";
import { useAuthStore } from "@/stores/authStore";

export function WorkspacesPage() {
  const [name, setName] = useState("");
  const user = useAuthStore((state) => state.user);
  const { logout } = useAuth();
  const workspaces = useQuery({
    queryKey: ["workspaces"],
    queryFn: () => workspaceApi.list(),
  });
  const createWorkspace = useMutation({
    mutationFn: (workspaceName: string) => workspaceApi.create(workspaceName),
    onSuccess: async () => {
      setName("");
      await queryClient.invalidateQueries({ queryKey: ["workspaces"] });
    },
  });

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    void createWorkspace.mutateAsync(trimmed);
  };

  const items = workspaces.data?.data ?? [];

  return (
    <main className="min-h-screen bg-surface-subtle">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Workspace</h1>
            <p className="text-sm text-muted-foreground">Kelola project SOP Anda</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-sm font-medium text-foreground">{user?.name}</div>
              <div className="text-xs text-muted-foreground">{user?.email}</div>
            </div>
            <button
              type="button"
              onClick={() => void logout()}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm font-medium hover:bg-muted"
            >
              <LogOut className="h-4 w-4" /> Keluar
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-8">
        <form onSubmit={onSubmit} className="mb-8 flex max-w-xl gap-3">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Nama workspace, mis. Project SOP Internal"
            maxLength={120}
            className="h-11 flex-1 rounded-lg border border-border bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={createWorkspace.isPending || !name.trim()}
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> Buat Workspace
          </button>
        </form>

        {workspaces.isLoading ? (
          <p className="text-sm text-muted-foreground">Memuat workspace...</p>
        ) : workspaces.isError ? (
          <p className="text-sm text-destructive">Gagal memuat workspace.</p>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-background p-10 text-center">
            <FolderOpen className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="font-medium text-foreground">Belum ada workspace</p>
            <p className="mt-1 text-sm text-muted-foreground">Buat workspace pertama untuk mulai menyusun SOP.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((workspace) => (
              <a
                key={workspace.workspaceId}
                href={`/workspaces/${workspace.workspaceId}`}
                className="rounded-xl border border-border bg-background p-5 transition hover:border-blue-300 hover:shadow-sm"
              >
                <FolderOpen className="mb-4 h-6 w-6 text-blue-600" />
                <h2 className="font-semibold text-foreground">{workspace.name}</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Diperbarui {new Date(workspace.updatedAt).toLocaleDateString("id-ID")}
                </p>
              </a>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
