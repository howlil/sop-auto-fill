export type Side = 'top' | 'right' | 'bottom' | 'left'

export type UsedSides = Record<
  string,
  {
    in?: Partial<Record<Side, string[]>>
    out?: Partial<Record<Side, string[]>>
  }
>
