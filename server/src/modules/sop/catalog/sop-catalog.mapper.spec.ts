import { StatusSOP } from '../../../generated/prisma';
import { mapDaftarRow } from './sop-catalog.mapper';

const detail = {
  detailSopId: 'detail-1',
  nomorSOP: '001/SOP',
  versi: 1,
  updatedAt: new Date('2026-08-02T00:00:00.000Z'),
  pembuatNama: 'User Test',
  editorNama: 'User Test',
  peraturanId: 'peraturan-1',
};

describe('mapDaftarRow workspace model', () => {
  it('menandai draft awal sebagai dapat dihapus', () => {
    const result = mapDaftarRow({
      sopId: 'sop-1',
      workspaceId: 'workspace-1',
      judul: 'SOP Pengujian',
      status: StatusSOP.DRAFT,
      detail,
      versionCount: 1,
    });

    expect(result).toMatchObject({
      id: 'sop-1',
      workspaceId: 'workspace-1',
      detailSopId: 'detail-1',
      nomorSop: '001/SOP',
      versi: 1,
      canHapusSopDraft: true,
      canBuatVersiBaru: false,
      versionCount: 1,
    });
  });

  it('menandai SOP selesai sebagai sumber versi baru', () => {
    const result = mapDaftarRow({
      sopId: 'sop-1',
      workspaceId: 'workspace-1',
      judul: 'SOP Pengujian',
      status: StatusSOP.COMPLETED,
      detail: { ...detail, versi: 2 },
      versionCount: 2,
    });

    expect(result.canBuatVersiBaru).toBe(true);
    expect(result.canHapusSopDraft).toBe(false);
  });

  it('menangani SOP tanpa detail tanpa field domain legacy', () => {
    const result = mapDaftarRow({
      sopId: 'sop-2',
      workspaceId: 'workspace-1',
      judul: 'Kosong',
      status: StatusSOP.ARCHIVED,
      detail: undefined,
      versionCount: 0,
    });

    expect(result).toMatchObject({
      id: 'sop-2',
      detailSopId: null,
      nomorSop: null,
      versi: null,
      pembuat: null,
      canBuatVersiBaru: false,
      canHapusSopDraft: false,
    });
  });
});
