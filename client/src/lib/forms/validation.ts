export function hasRequiredStringFields<T extends Record<string, unknown>>(
  value: T,
  keys: readonly (keyof T)[],
): boolean {
  return keys.every((key) => {
    const field = value[key]
    return typeof field === 'string' && field.trim().length > 0
  })
}

export function toTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}
