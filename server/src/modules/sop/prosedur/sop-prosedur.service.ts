import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { assertDetailSopEditable } from '../../../common/status/sop-editable.util';
import type { JwtAccessPayload } from '../../../common';
import { JenisLangkahProsedur, PeranPengguna, Prisma } from '../../../generated/prisma';
import { UserOpdAccessService } from '../../core/opd/user-opd-access.service';
import { SopCatalogService } from '../catalog/sop-catalog.service';
import type { PenyusunWorkbenchDataDto } from '../catalog/dto/penyusun-workbench-data.dto';
import type { LangkahPatchItem } from './dto/langkah-patch-item.dto';
import type { UpdateSopProsedurDto } from './dto/update-sop-prosedur.dto';
import {
  SopProsedurRepository,
  type RepoLangkahPatchItem,
  type UpdateSopProsedurRepoInput,
} from './sop-prosedur.repository';

const MAX_UPDATE_PROSEDUR_TRANSACTION_ATTEMPTS = 5;
const UPDATE_PROSEDUR_RETRY_BASE_DELAY_MS = 40;

@Injectable()
export class SopProsedurService {
  constructor(
    private readonly sopProsedurRepository: SopProsedurRepository,
    private readonly sopCatalogService: SopCatalogService,
    private readonly userOpdAccessService: UserOpdAccessService,
  ) {}

  /**
   * PATCH prosedur SOP. `detailOrSopId` boleh `detailSopId` atau `sopId` (versi terbaru dipakai).
   * Mengembalikan area kerja terbaru (respons = muatan data lengkap, ramah simpan otomatis setQueryData).
   */
  async updateProsedur(
    user: JwtAccessPayload,
    detailOrSopId: string,
    dto: UpdateSopProsedurDto,
    logsLimit?: number,
  ): Promise<PenyusunWorkbenchDataDto> {
    const resolved = await this.sopProsedurRepository.findDetailIdByDetailOrSopId(detailOrSopId);
    if (resolved === null) {
      throw new NotFoundException('DetailSOP tidak ditemukan');
    }

    await this.assertPenyusunOpdAccess(user, resolved.sopOpdId);
    const detailStatus = await this.sopProsedurRepository.findDetailStatus(resolved.detailSopId);
    if (detailStatus === null) {
      throw new NotFoundException('DetailSOP tidak ditemukan');
    }
    assertDetailSopEditable(detailStatus);

    const changedFields = this.collectChangedFields(dto);
    if (changedFields.length === 0) {
      /* Tidak ada perubahan domain — langsung kembalikan area kerja saat ini agar
         klien tetap menerima respons konsisten (simpan otomatis tertunda kadang
         memicu PATCH kosong saat pengguna batal mengetik). */
      return this.sopCatalogService.getPenyusunWorkbench(user, resolved.detailSopId, logsLimit);
    }

    const repoInput = await this.buildRepoInput(dto, resolved.detailSopId, resolved.sopOpdId);

    try {
      await this.runUpdateProsedurTransactionWithRetry({
        detailSopId: resolved.detailSopId,
        userId: user.sub,
        input: repoInput,
        changedFields,
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === 'P2002') {
          throw new ConflictException('Konflik unik pada langkah/jalur pelaksana');
        }
        if (err.code === 'P2003' || err.code === 'P2025') {
          throw new BadRequestException('Referensi tidak valid pada muatan data');
        }
      }
      const message = err instanceof Error ? err.message : '';
      if (message.includes('Langkah tujuan cabang')) {
        throw new BadRequestException('Langkah tujuan harus berada dalam DetailSOP yang sama');
      }
      throw err;
    }

    return this.sopCatalogService.getPenyusunWorkbench(user, resolved.detailSopId, logsLimit);
  }

  private async runUpdateProsedurTransactionWithRetry(params: {
    detailSopId: string;
    userId: string;
    input: UpdateSopProsedurRepoInput;
    changedFields: string[];
  }): Promise<void> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= MAX_UPDATE_PROSEDUR_TRANSACTION_ATTEMPTS; attempt += 1) {
      try {
        await this.sopProsedurRepository.updateProsedurTransaction(params);
        return;
      } catch (err) {
        lastError = err;
        if (
          attempt === MAX_UPDATE_PROSEDUR_TRANSACTION_ATTEMPTS ||
          !isTransientTransactionError(err)
        ) {
          throw err;
        }
        await delay(UPDATE_PROSEDUR_RETRY_BASE_DELAY_MS * attempt);
      }
    }
    throw lastError;
  }

  private async assertPenyusunOpdAccess(user: JwtAccessPayload, sopOpdId: string): Promise<void> {
    if (user.peran !== PeranPengguna.PENYUSUN && user.peran !== PeranPengguna.PJ_PENYUSUN) {
      /* Guard di controller seharusnya sudah memblokir, tapi pengaman runtime tetap perlu
         agar logic OPD scoping di bawah aman dipakai. */
      throw new ForbiddenException('Akses ditolak: hanya penyusun yang dapat mengubah prosedur');
    }
    await this.userOpdAccessService.assertSameOpd(
      user.sub,
      sopOpdId,
      'Akses ditolak untuk DetailSOP ini',
    );
  }

  private collectChangedFields(dto: UpdateSopProsedurDto): string[] {
    const out: string[] = [];
    if (dto.pelaksana !== undefined) out.push('pelaksana');
    if (dto.langkah !== undefined) out.push('langkah');
    return out;
  }

  /**
   * Validasi referensial DTO + bentuk input untuk repository:
   * - Duplikat `pelaksanaId` di muatan data jalur pelaksana dilarang.
   * - Setiap `pelaksanaId` master harus berasal dari OPD pemilik SOP.
   * - Setiap `tempId` unik di muatan data langkah; `langkahSelanjutnya*TempId` harus
   *   merujuk `tempId` yang ada.
   * - Untuk jenis `KEPUTUSAN`, minimal satu cabang (Ya/Tidak) harus diset.
   * - Untuk jenis non-KEPUTUSAN, cabang otomatis diabaikan (di-set null).
   * - `pelaksanaId` per langkah (bila diset) harus muncul di muatan data jalur pelaksana
   *   (jika diset) atau jalur pelaksana yang ada.
   */
  private async buildRepoInput(
    dto: UpdateSopProsedurDto,
    detailSopId: string,
    sopOpdId: string,
  ): Promise<UpdateSopProsedurRepoInput> {
    const out: UpdateSopProsedurRepoInput = {};

    let allowedPelaksanaIds: Set<string> | null = null;

    if (dto.pelaksana !== undefined) {
      const seen = new Set<string>();
      const dedup: { pelaksanaId: string }[] = [];
      for (const p of dto.pelaksana) {
        if (seen.has(p.pelaksanaId)) {
          throw new BadRequestException(`Pelaksana duplikat di jalur pelaksana: ${p.pelaksanaId}`);
        }
        seen.add(p.pelaksanaId);
        dedup.push({ pelaksanaId: p.pelaksanaId });
      }
      if (dedup.length > 0) {
        const valid = await this.sopProsedurRepository.findPelaksanaIdsByOpd(
          sopOpdId,
          dedup.map((p) => p.pelaksanaId),
        );
        for (const p of dedup) {
          if (!valid.has(p.pelaksanaId)) {
            throw new BadRequestException(
              `Pelaksana ${p.pelaksanaId} harus dari OPD yang sama dengan SOP (jalur pelaksana)`,
            );
          }
        }
      }
      out.pelaksana = dedup;
      allowedPelaksanaIds = new Set(dedup.map((p) => p.pelaksanaId));
    }

    if (dto.langkah !== undefined) {
      const langkah = dto.langkah;
      const tempIds = new Set<string>();
      for (const item of langkah) {
        if (tempIds.has(item.tempId)) {
          throw new BadRequestException(`tempId duplikat: ${item.tempId}`);
        }
        tempIds.add(item.tempId);
      }

      /* Resolusi pelaksana yang valid:
         - jika dto.pelaksana di-set: pakai itu sebagai allowed
         - jika tidak: cek terhadap jalur pelaksana yang ada di DB */
      let allowedForLangkah = allowedPelaksanaIds;
      if (allowedForLangkah === null) {
        const existing =
          await this.sopProsedurRepository.findExistingSwimlanePelaksanaIds(detailSopId);
        allowedForLangkah = new Set(existing);
      }

      /* `defaultPelaksanaId` dipakai bila langkah tidak set `pelaksanaId` — diambil
         dari jalur pelaksana index 0 sebagai nilai cadangan yang masuk akal
         (LangkahSOP.pelaksanaId wajib di DB). */
      const defaultPelaksanaId =
        out.pelaksana !== undefined && out.pelaksana.length > 0
          ? out.pelaksana[0].pelaksanaId
          : (Array.from(allowedForLangkah)[0] ?? null);

      const repoLangkah: RepoLangkahPatchItem[] = langkah.map((item) =>
        this.toRepoLangkahItem(item, allowedForLangkah, tempIds, defaultPelaksanaId),
      );

      out.langkah = repoLangkah;
      out.defaultPelaksanaId = defaultPelaksanaId;
    }

    return out;
  }

  private toRepoLangkahItem(
    item: LangkahPatchItem,
    allowedPelaksanaIds: Set<string>,
    knownTempIds: Set<string>,
    defaultPelaksanaId: string | null,
  ): RepoLangkahPatchItem {
    if (item.pelaksanaId !== undefined && !allowedPelaksanaIds.has(item.pelaksanaId)) {
      throw new BadRequestException(
        `pelaksanaId ${item.pelaksanaId} pada langkah '${item.tempId}' harus dari OPD yang sama dengan SOP (tidak ada di jalur pelaksana)`,
      );
    }

    const isKeputusan = item.jenis === JenisLangkahProsedur.KEPUTUSAN;
    let yaTempId: string | null = null;
    let tidakTempId: string | null = null;
    if (isKeputusan) {
      if (
        item.langkahSelanjutnyaYaTempId !== undefined &&
        item.langkahSelanjutnyaYaTempId !== null &&
        !knownTempIds.has(item.langkahSelanjutnyaYaTempId)
      ) {
        throw new BadRequestException(
          `Cabang Ya pada langkah '${item.tempId}' merujuk tempId tidak dikenal: ${item.langkahSelanjutnyaYaTempId}`,
        );
      }
      if (
        item.langkahSelanjutnyaTidakTempId !== undefined &&
        item.langkahSelanjutnyaTidakTempId !== null &&
        !knownTempIds.has(item.langkahSelanjutnyaTidakTempId)
      ) {
        throw new BadRequestException(
          `Cabang Tidak pada langkah '${item.tempId}' merujuk tempId tidak dikenal: ${item.langkahSelanjutnyaTidakTempId}`,
        );
      }
      yaTempId = item.langkahSelanjutnyaYaTempId ?? null;
      tidakTempId = item.langkahSelanjutnyaTidakTempId ?? null;
    }

    /* Pelaksana cadangan: kalau langkah tidak set, ambil default; kalau default null
       dan langkah juga tidak set, lempar error karena LangkahSOP.pelaksanaId wajib di DB. */
    const resolvedPelaksana = item.pelaksanaId ?? defaultPelaksanaId;
    if (resolvedPelaksana === null || resolvedPelaksana === undefined) {
      throw new BadRequestException(
        `Langkah '${item.tempId}' tidak punya pelaksana (jalur pelaksana kosong dan pelaksanaId tidak diset)`,
      );
    }

    return {
      tempId: item.tempId,
      jenis: item.jenis,
      kegiatan: item.kegiatan,
      kelengkapan: item.kelengkapan,
      keluaran: item.keluaran,
      waktu: item.waktu,
      satuanWaktu: item.satuanWaktu,
      keterangan: item.keterangan,
      pelaksanaId: resolvedPelaksana,
      langkahSelanjutnyaYaTempId: yaTempId,
      langkahSelanjutnyaTidakTempId: tidakTempId,
    };
  }
}

function isTransientTransactionError(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    return err.code === 'P2034';
  }
  const message = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  return (
    message.includes('deadlock') ||
    message.includes('lock wait timeout') ||
    message.includes('write conflict') ||
    message.includes('transaction conflict')
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
