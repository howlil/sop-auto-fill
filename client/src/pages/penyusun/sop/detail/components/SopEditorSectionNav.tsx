import {
  Check,
  ClipboardCheck,
  FileText,
  ListTree,
  PackageCheck,
  Users,
} from 'lucide-react'
import { cn } from '@/utils/cn'

export type SopEditorSection = 'basic' | 'actors' | 'procedure' | 'supporting' | 'review'

export interface SopSectionProgress {
  basic: boolean
  actors: boolean
  procedure: boolean
  supporting: boolean
  review: boolean
}

const SECTIONS: Array<{
  id: SopEditorSection
  label: string
  description: string
  Icon: typeof FileText
}> = [
  { id: 'basic', label: 'Informasi Dasar', description: 'Identitas dokumen', Icon: FileText },
  { id: 'actors', label: 'Pelaksana', description: 'Siapa yang terlibat', Icon: Users },
  { id: 'procedure', label: 'Prosedur', description: 'Susun alur kerja', Icon: ListTree },
  { id: 'supporting', label: 'Informasi Pendukung', description: 'Acuan dan kelengkapan', Icon: PackageCheck },
  { id: 'review', label: 'Review', description: 'Periksa sebelum selesai', Icon: ClipboardCheck },
]

export function SopEditorSectionNav({
  activeSection,
  onSectionChange,
  progress,
  readOnly = false,
}: {
  activeSection: SopEditorSection
  onSectionChange: (section: SopEditorSection) => void
  progress: SopSectionProgress
  readOnly?: boolean
}) {
  return (
    <nav aria-label="Bagian dokumen SOP" className="w-full">
      <div className="hidden lg:block">
        <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {readOnly ? 'Isi dokumen' : 'Susun SOP'}
        </p>
        <div className="space-y-1">
          {SECTIONS.map(({ id, label, description, Icon }, index) => {
            const active = activeSection === id
            const done = progress[id]
            return (
              <button
                key={id}
                type="button"
                onClick={() => onSectionChange(id)}
                aria-current={active ? 'step' : undefined}
                className={cn(
                  'group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
                  active
                    ? 'bg-primary-subtle text-primary'
                    : 'text-secondary-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <span
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-xs font-semibold',
                    active
                      ? 'border-primary/30 bg-background text-primary'
                      : done
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-border bg-background text-muted-foreground',
                  )}
                >
                  {done && !active ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{index + 1}. {label}</span>
                  <span className={cn('mt-0.5 block text-xs', active ? 'text-primary/75' : 'text-muted-foreground')}>
                    {description}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="lg:hidden">
        <label className="block text-xs font-medium text-muted-foreground" htmlFor="sop-editor-section">
          Bagian dokumen
        </label>
        <select
          id="sop-editor-section"
          value={activeSection}
          onChange={(event) => onSectionChange(event.target.value as SopEditorSection)}
          className="mt-1.5 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground outline-none focus:ring-2 focus:ring-primary"
        >
          {SECTIONS.map(({ id, label }, index) => (
            <option key={id} value={id}>
              {progress[id] ? '✓ ' : ''}{index + 1}. {label}
            </option>
          ))}
        </select>
      </div>
    </nav>
  )
}
