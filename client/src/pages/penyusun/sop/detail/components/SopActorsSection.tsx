import { FormEvent, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, UserPlus, Users, X } from 'lucide-react'
import { pelaksanaApi } from '@/api/pelaksana'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useSopEditor } from '../SopEditorContext'

export function SopActorsSection({ workspaceId }: { workspaceId: string }) {
  const { implementers, setImplementers, isReadOnly } = useSopEditor()
  const [newActorName, setNewActorName] = useState('')
  const queryClient = useQueryClient()

  const actors = useQuery({
    queryKey: ['workspace-pelaksana', workspaceId],
    queryFn: () => pelaksanaApi.list(workspaceId),
    enabled: workspaceId.length > 0,
  })

  const createActor = useMutation({
    mutationFn: (name: string) => pelaksanaApi.create(workspaceId, name),
    onSuccess: async (response) => {
      const actor = response.data
      setImplementers((current) => {
        if (current.some((item) => item.id === actor.id)) return current
        return [...current, { id: actor.id, name: actor.namaPelaksana }]
      })
      setNewActorName('')
      await queryClient.invalidateQueries({ queryKey: ['workspace-pelaksana', workspaceId] })
    },
  })

  const workspaceActors = actors.data?.data ?? []
  const availableActors = useMemo(
    () => workspaceActors.filter((actor) => !implementers.some((item) => item.id === actor.id)),
    [workspaceActors, implementers],
  )

  const addExistingActor = (id: string, name: string) => {
    setImplementers((current) => {
      if (current.some((item) => item.id === id)) return current
      return [...current, { id, name }]
    })
  }

  const onCreateActor = (event: FormEvent) => {
    event.preventDefault()
    const name = newActorName.trim()
    if (!name || isReadOnly || createActor.isPending) return
    void createActor.mutateAsync(name)
  }

  return (
    <section className="mx-auto w-full max-w-3xl">
      <div className="mb-7">
        <div className="flex items-center gap-2 text-primary">
          <Users className="h-5 w-5" />
          <span className="text-sm font-semibold">Langkah 2</span>
        </div>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">Pelaksana</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Tentukan siapa yang terlibat dalam SOP ini. Pelaksana yang sudah ada di workspace dapat dipakai ulang tanpa dibuat lagi.
        </p>
      </div>

      <div className="space-y-6">
        <div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Pelaksana SOP</h3>
              <p className="mt-1 text-sm text-muted-foreground">Urutan di bawah digunakan sebagai referensi pada langkah prosedur.</p>
            </div>
            <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
              {implementers.length} pelaksana
            </span>
          </div>

          {implementers.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-border px-5 py-8 text-center">
              <Users className="mx-auto h-7 w-7 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium text-foreground">Belum ada pelaksana</p>
              <p className="mt-1 text-sm text-muted-foreground">Tambahkan minimal satu pelaksana sebelum menyusun langkah prosedur.</p>
            </div>
          ) : (
            <ol className="mt-4 space-y-2">
              {implementers.map((actor, index) => (
                <li
                  key={actor.id}
                  className="flex items-center gap-3 rounded-xl border border-border bg-background px-4 py-3"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-sm font-semibold text-muted-foreground">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{actor.name}</span>
                  {!isReadOnly ? (
                    <button
                      type="button"
                      onClick={() => setImplementers((current) => current.filter((item) => item.id !== actor.id))}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-red-50 hover:text-red-600"
                      aria-label={`Hapus ${actor.name} dari SOP`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
        </div>

        {!isReadOnly ? (
          <>
            <div className="rounded-xl border border-border bg-background p-4">
              <div className="flex items-start gap-3">
                <UserPlus className="mt-0.5 h-5 w-5 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-foreground">Buat pelaksana baru</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Pelaksana baru disimpan di workspace dan langsung dipakai pada SOP ini.
                  </p>
                  <form onSubmit={onCreateActor} className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <Input
                      value={newActorName}
                      onChange={(event) => setNewActorName(event.target.value)}
                      placeholder="Contoh: Evaluator, Admin OPD, Kepala Bagian"
                      maxLength={255}
                      className="h-11 flex-1"
                    />
                    <Button type="submit" variant="outline" className="h-11 gap-2" disabled={!newActorName.trim() || createActor.isPending}>
                      <Plus className="h-4 w-4" />
                      {createActor.isPending ? 'Menambahkan…' : 'Tambah'}
                    </Button>
                  </form>
                  {createActor.isError ? <p className="mt-2 text-sm text-destructive">Pelaksana gagal dibuat. Coba lagi.</p> : null}
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-foreground">Gunakan dari workspace</h3>
              <p className="mt-1 text-sm text-muted-foreground">Tambahkan pelaksana yang sudah pernah digunakan pada SOP lain.</p>
              {actors.isLoading ? (
                <p className="mt-3 text-sm text-muted-foreground">Memuat pelaksana...</p>
              ) : actors.isError ? (
                <p className="mt-3 text-sm text-destructive">Daftar pelaksana workspace gagal dimuat.</p>
              ) : availableActors.length === 0 ? (
                <p className="mt-3 rounded-lg bg-muted/45 px-3 py-3 text-sm text-muted-foreground">
                  Semua pelaksana workspace sudah digunakan pada SOP ini.
                </p>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  {availableActors.map((actor) => (
                    <Button
                      key={actor.id}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => addExistingActor(actor.id, actor.namaPelaksana)}
                    >
                      <Plus className="h-3.5 w-3.5" /> {actor.namaPelaksana}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </section>
  )
}
