import { z } from 'zod'
import type { TTESignaturePayload } from '@/types/dto/tte.dto'

/** Skema runtime untuk payload tanda tangan TTE dari API (JSON). */
export const tteSignaturePayloadSchema = z.object({
  id: z.string(),
  dokumenTteId: z.string().uuid(),
  userId: z.string().uuid(),
  nip: z.string(),
  namaLengkap: z.string(),
  jabatan: z.string().optional(),
  signedAt: z.string().optional(),
})

/**
 * Menyempitkan `unknown` dari API ke `TTESignaturePayload` atau `undefined` jika tidak valid.
 */
export function parseTTESignaturePayload(
  value: unknown,
): TTESignaturePayload | undefined {
  if (value === undefined || value === null) {
    return undefined
  }
  const result = tteSignaturePayloadSchema.safeParse(value)
  return result.success ? result.data : undefined
}
