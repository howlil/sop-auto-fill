import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

export type EvaluasiFilterTab = 'pengajuan' | 'riwayat'

export interface EvaluasiFilterTabsProps {
  value: EvaluasiFilterTab
  onValueChange: (value: EvaluasiFilterTab) => void
}

const FILTER_TABS: { id: EvaluasiFilterTab; label: string }[] = [
  { id: 'pengajuan', label: 'Pengajuan' },
  { id: 'riwayat', label: 'Riwayat' },
]

export function EvaluasiFilterTabs({
  value,
  onValueChange,
}: EvaluasiFilterTabsProps) {
  return (
    <Tabs
      className="w-full"
      value={value}
      onValueChange={(nextValue) => onValueChange(nextValue as EvaluasiFilterTab)}
    >
      <TabsList className="h-8 p-0.5 w-full grid grid-cols-2">
        {FILTER_TABS.map((tab) => (
          <TabsTrigger key={tab.id} value={tab.id} className="h-7 text-xs">
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
