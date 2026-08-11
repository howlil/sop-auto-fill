import {
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { JenisDiagram, PeranPengguna } from '../../../generated/prisma';
import { SopDiagramService } from './sop-diagram.service';

describe('Pengujian SopDiagramService', () => {
  const user = {
    sub: 'user-1',
    peran: PeranPengguna.PENYUSUN,
    email: 'a@b.c',
  } as never;

  function createService(overrides?: {
    resolved?: { detailSopId: string; sopOpdId: string } | null;
    status?: string | null;
  }) {
    const defaultResolved = { detailSopId: 'det-1', sopOpdId: 'opd-1' };
    const resolved =
      overrides !== undefined && 'resolved' in overrides ? overrides.resolved : defaultResolved;
    const sopDiagramRepository = {
      findDetailIdByDetailOrSopId: jest.fn().mockResolvedValue(resolved),
      findDetailStatus: jest
        .fn()
        .mockResolvedValue(
          overrides !== undefined && 'status' in overrides ? overrides.status : 'DRAFT',
        ),
      upsertConfig: jest.fn().mockResolvedValue({}),
    };
    const sopCatalogService = {
      getPenyusunWorkbench: jest
        .fn()
        .mockResolvedValue({ detail: { id: 'det-1' }, langkah: [], logEdit: [] }),
    };
    const userOpdAccessService = {
      assertSameOpd: jest.fn().mockResolvedValue(undefined),
    };
    const service = new SopDiagramService(
      sopDiagramRepository as never,
      sopCatalogService as never,
      userOpdAccessService as never,
    );
    return { service, sopDiagramRepository, sopCatalogService };
  }

  it('seharusnya melempar NotFoundException ketika detail tidak ditemukan', async () => {
    const { service } = createService({ resolved: null });
    await expect(
      service.updateDiagram(user, 'missing', { jenis: JenisDiagram.FLOWCHART, layoutSeed: 1 }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('seharusnya upsert konfigurasi dan mengembalikan workbench', async () => {
    const { service, sopDiagramRepository, sopCatalogService } = createService();
    const actual = await service.updateDiagram(user, 'det-1', {
      jenis: JenisDiagram.FLOWCHART,
      layoutSeed: 2,
      pathOverrides: { edges: {} },
    });
    expect(sopDiagramRepository.upsertConfig).toHaveBeenCalled();
    expect(sopCatalogService.getPenyusunWorkbench).toHaveBeenCalled();
    expect(actual.detail.id).toBe('det-1');
  });

  it('seharusnya menolak tidak valid path overrides', async () => {
    const { service } = createService();
    await expect(
      service.updateDiagram(user, 'det-1', {
        jenis: JenisDiagram.BPMN,
        pathOverrides: { edges: { bad: { sSide: 'invalid' } as never } },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  // --- COMPREHENSIVE TESTS (FALSE, WORST, EDGE CASES) ---

  describe('updateDiagram (Tambahan Kasus Otorisasi dan Validasi Status)', () => {
    it('seharusnya melempar ForbiddenException jika peran bukan PENYUSUN/PJ_PENYUSUN (False Case)', async () => {
      const { service } = createService();
      const badUser = { sub: 'user-1', peran: PeranPengguna.EVALUATOR, email: 'a@b.c' } as never;
      await expect(
        service.updateDiagram(badUser, 'det-1', { jenis: JenisDiagram.FLOWCHART }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('seharusnya melempar NotFoundException jika status detail tidak ditemukan (Edge Case)', async () => {
      const { service } = createService({ status: null });
      await expect(
        service.updateDiagram(user, 'det-1', { jenis: JenisDiagram.FLOWCHART }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('seharusnya melempar ConflictException jika status detail tidak dapat diedit (False Case)', async () => {
      const { service } = createService({ status: 'DITANDATANGANI_KEPALA_OPD' });
      await expect(
        service.updateDiagram(user, 'det-1', { jenis: JenisDiagram.FLOWCHART }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('updateDiagram (Tambahan Kasus Validasi Payload)', () => {
    it('seharusnya melempar BadRequestException jika struktur pathOverrides rusak - array (Worst Case)', async () => {
      const { service } = createService();
      await expect(
        service.updateDiagram(user, 'det-1', {
          jenis: JenisDiagram.FLOWCHART,
          pathOverrides: [] as never,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('seharusnya melempar BadRequestException jika kunci edge pathOverrides tidak valid (Worst Case)', async () => {
      const { service } = createService();
      // Kunci yang salah misal "nodeA|nodeB" tanpa cabang (UTAMA, dll)
      const badOverrides = {
        edges: {
          'nodeA|nodeB': {
            sSide: 'top',
            eSide: 'bottom',
            startPoint: { x: 0, y: 0 },
            endPoint: { x: 0, y: 0 },
            bendPoints: [],
          },
        },
      };
      await expect(
        service.updateDiagram(user, 'det-1', {
          jenis: JenisDiagram.FLOWCHART,
          pathOverrides: badOverrides as never,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('seharusnya tidak memanggil upsertConfig dan langsung return workbench jika tidak ada perubahan relevan (Edge Case)', async () => {
      const { service, sopDiagramRepository, sopCatalogService } = createService();
      const actual = await service.updateDiagram(user, 'det-1', { jenis: JenisDiagram.FLOWCHART }); // tanpa layoutSeed atau pathOverrides
      expect(sopDiagramRepository.upsertConfig).not.toHaveBeenCalled();
      expect(sopCatalogService.getPenyusunWorkbench).toHaveBeenCalled();
      expect(actual.detail.id).toBe('det-1');
    });
  });
});
