import { expect, test, type APIRequestContext } from '@playwright/test'

import { users } from './fixtures/users'
import {
  apiGet,
  apiPatch,
  apiPost,
  createAuthenticatedApiContext,
  expectBackendAvailable,
} from './support/api'
import { createDraftSopFixture } from './support/e2e-flow'

interface Workbench {
  detail: {
    id: string
    judul?: string
    namaLembaga?: string
    lampiran?: {
      peringatan: Array<{ teks: string }>
      kualifikasiPelaksanaan: Array<{ teks: string }>
      peralatanPerlengkapan: Array<{ teks: string }>
      pencatatanPendataan: Array<{ teks: string }>
    }
  }
  langkah: Array<{
    kegiatan: string
    kelengkapan: string
    keluaran: string
    keterangan: string
  }>
  logEdit: Array<{
    bagian: string
    user?: { email: string }
    meta?: { fields?: string[] }
  }>
}

interface Pelaksana {
  id: string
}

test.describe('Concurrency editing SOP realtime/autosave', () => {
  test.beforeEach(async ({ request }) => {
    await expectBackendAvailable(request)
  })

  test('CONC-01: autosave header paralel pada field berbeda tidak menghilangkan perubahan', async () => {
    const penyusun = await createAuthenticatedApiContext(users.penyusun)
    const pjPenyusun = await createAuthenticatedApiContext(users.pjPenyusun)
    try {
      const draft = await createDraftSopFixture(penyusun, 'CONC-HDR')
      const namaLembaga = `Biro Organisasi Sumbar - ${Date.now()}`
      const peringatan = `Peringatan concurrency ${Date.now()}`

      const [responseA, responseB] = await Promise.all([
        apiPatch<Workbench>(penyusun, `/sop/header/${draft.detailSopId}`, {
          namaLembaga,
        }),
        apiPatch<Workbench>(pjPenyusun, `/sop/header/${draft.detailSopId}`, {
          lampiran: {
            peringatan: [peringatan],
          },
        }),
      ])

      expect(responseA.detail.id).toBe(draft.detailSopId)
      expect(responseB.detail.id).toBe(draft.detailSopId)

      const finalWorkbench = await apiGet<Workbench>(
        penyusun,
        `/sop/penyusun-workbench/${draft.detailSopId}`,
      )
      expect(finalWorkbench.detail.namaLembaga).toBe(namaLembaga)
      expect(finalWorkbench.detail.lampiran?.peringatan.map((item) => item.teks)).toContain(
        peringatan,
      )
      expect(finalWorkbench.logEdit.some((log) => log.bagian === 'HEADER')).toBe(true)
    } finally {
      await disposeAll(penyusun, pjPenyusun)
    }
  })

  test('CONC-02: autosave prosedur paralel bersifat atomik dan tidak menghasilkan data parsial', async () => {
    const penyusun = await createAuthenticatedApiContext(users.penyusun)
    const pjPenyusun = await createAuthenticatedApiContext(users.pjPenyusun)
    try {
      const draft = await createDraftSopFixture(penyusun, 'CONC-STEP')
      const pelaksana = await apiPost<Pelaksana>(penyusun, '/pelaksana', {
        namaPelaksana: `Pelaksana concurrency ${Date.now()}`,
      })
      const payloadA = buildLangkahPayload(pelaksana.id, 'A')
      const payloadB = buildLangkahPayload(pelaksana.id, 'B')

      const [responseA, responseB] = await Promise.all([
        apiPatch<Workbench>(penyusun, `/sop/langkah/${draft.detailSopId}`, payloadA),
        apiPatch<Workbench>(pjPenyusun, `/sop/langkah/${draft.detailSopId}`, payloadB),
      ])

      expect(responseA.detail.id).toBe(draft.detailSopId)
      expect(responseB.detail.id).toBe(draft.detailSopId)

      const finalWorkbench = await apiGet<Workbench>(
        penyusun,
        `/sop/penyusun-workbench/${draft.detailSopId}`,
      )
      const finalActivities = finalWorkbench.langkah.map((step) => step.kegiatan)
      const expectedA = payloadA.langkah.map((step) => step.kegiatan)
      const expectedB = payloadB.langkah.map((step) => step.kegiatan)

      expect(finalWorkbench.langkah).toHaveLength(2)
      expect([expectedA, expectedB]).toContainEqual(finalActivities)
      expect(finalActivities).not.toEqual(expect.arrayContaining([...expectedA, ...expectedB]))
      expect(finalWorkbench.logEdit.some((log) => log.bagian === 'LANGKAH')).toBe(true)
    } finally {
      await disposeAll(penyusun, pjPenyusun)
    }
  })
})

function buildLangkahPayload(pelaksanaId: string, marker: string) {
  return {
    pelaksana: [{ pelaksanaId }],
    langkah: [
      {
        tempId: `${marker}-mulai`,
        jenis: 'AWAL_AKHIR',
        kegiatan: `Mulai ${marker}`,
        kelengkapan: `Berkas awal ${marker}`,
        keluaran: `Dokumen diterima ${marker}`,
        keterangan: `Awal concurrency ${marker}`,
        waktu: 5,
        satuanWaktu: 'm',
        pelaksanaId,
      },
      {
        tempId: `${marker}-selesai`,
        jenis: 'AWAL_AKHIR',
        kegiatan: `Selesai ${marker}`,
        kelengkapan: `Berkas akhir ${marker}`,
        keluaran: `Dokumen selesai ${marker}`,
        keterangan: `Akhir concurrency ${marker}`,
        waktu: 5,
        satuanWaktu: 'm',
        pelaksanaId,
      },
    ],
  } as const
}

async function disposeAll(...contexts: APIRequestContext[]): Promise<void> {
  await Promise.all(contexts.map((context) => context.dispose()))
}
