import { z } from 'zod'

export const ARSIP_OPD_PAGE_SIZE = 50
export const ARSIP_SOP_PAGE_SIZE = 15
export const ARSIP_AUTO_SELECT_SOP_MAX = 10

export const arsipBrowseSearchSchema = z.object({
  opdId: z.string().optional(),
  q: z.string().max(200).optional(),
  detailSopId: z.string().optional(),
  opdPage: z.coerce.number().int().min(1).optional(),
  sopPage: z.coerce.number().int().min(1).optional(),
  sopSearch: z.string().max(200).optional(),
})

export type ArsipBrowseSearch = z.infer<typeof arsipBrowseSearchSchema>
