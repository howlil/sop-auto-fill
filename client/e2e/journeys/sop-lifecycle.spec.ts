import { users } from '../fixtures/users'
import { expect, test } from '../fixtures/business-test'
import {
  approveAllSopAsHeadViaUi,
  createVersionViaUi,
  expectPublicArchiveExcludes,
  revokeSopViaUi,
} from '../support/business-actions'
import { expectPengajuanStatus, expectSopStatus, getWorkbench } from '../support/business-audit'
import {
  advanceVersionToHeadSignaturePrecondition,
  seedApprovedSop,
} from '../support/business-preconditions'
import { e2ePin } from '../support/test-data'

test.describe('End-to-End Business Journey — SOP lifecycle', () => {
  test('J05 Version Replacement — versi baru berlaku menggantikan versi lama', async ({
    roleApi,
    roleSession,
  }) => {
    const original = await seedApprovedSop(roleApi, 'J05-V1')
    const penyusun = await roleSession(users.penyusun)
    const kepalaOpd = await roleSession(users.kepalaOpd)

    let newDetailId = ''
    let replacementPengajuanId = ''

    await test.step('Penyusun membuat versi baru dari SOP yang sedang berlaku melalui UI', async () => {
      newDetailId = await createVersionViaUi(penyusun.page, original.detailSopId)
      const newVersion = await getWorkbench(penyusun.api, newDetailId)
      expect(newVersion.detail.status).toBe('DRAFT')
      expect(newVersion.detail.versi ?? 0).toBeGreaterThan(1)
      await expectSopStatus(penyusun.api, original.detailSopId, 'BERLAKU')
    })

    await test.step('Precondition membawa versi baru ke tahap pengesahan tanpa menduplikasi J01/J02', async () => {
      const newVersion = await getWorkbench(penyusun.api, newDetailId)
      replacementPengajuanId = await advanceVersionToHeadSignaturePrecondition(roleApi, {
        detailSopId: newDetailId,
        title: newVersion.detail.judul ?? original.title,
        baNumber: `${original.baNumber}-V2`,
      })
      await expectPengajuanStatus(
        kepalaOpd.api,
        replacementPengajuanId,
        'DITANDATANGANI_PJ_PENYUSUN',
      )
    })

    await test.step('Kepala OPD mengesahkan versi baru melalui UI', async () => {
      await approveAllSopAsHeadViaUi(kepalaOpd.page, replacementPengajuanId, e2ePin)
      await expectPengajuanStatus(kepalaOpd.api, replacementPengajuanId, 'SELESAI')
    })

    await test.step('Invariant version replacement: v2 BERLAKU dan v1 DIGANTIKAN', async () => {
      await expectSopStatus(penyusun.api, newDetailId, 'BERLAKU')
      await expectSopStatus(penyusun.api, original.detailSopId, 'DIGANTIKAN')
    })
  })

  test('J06 Revocation — pencabutan mengakhiri keberlakuan dan menghapus SOP dari arsip aktif', async ({
    page,
    roleApi,
    roleSession,
  }) => {
    const approved = await seedApprovedSop(roleApi, 'J06-REVOKE')
    const kepalaOpd = await roleSession(users.kepalaOpd)

    await test.step('Kepala OPD mencabut SOP berlaku melalui UI', async () => {
      await revokeSopViaUi(kepalaOpd.page, approved.sopId)
      await expectSopStatus(kepalaOpd.api, approved.detailSopId, 'DICABUT')
    })

    await test.step('SOP dicabut tidak lagi tersedia pada arsip publik aktif', async () => {
      await expectPublicArchiveExcludes(page, approved.title)
    })
  })
})
