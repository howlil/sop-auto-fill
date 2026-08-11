import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import type { JwtAccessPayload } from '../../../common';
import { toWibDateOnly } from '../../../common/date/wib-date.util';
import {
  JenisDokumenTte,
  PeranPengguna,
  StatusPengajuanEvaluasi,
  StatusSOP,
} from '../../../generated/prisma';
import { TandaTanganiDto } from '../shared/dto/tanda-tangani.dto';
import { TandaTanganiSemuaSopDto } from '../shared/dto/tanda-tangani-semua-sop.dto';
import { buildTteQrPayload } from '../shared/utils/tte-verifikasi-qr.util';
import { TtePublicUrlResolver } from '../shared/utils/tte-public-url.resolver';
import type { Request } from 'express';
import {
  hashDokumenKanonik,
  mapTtePeranResponse,
  runTteRepositoryMutation,
} from '../shared/utils/tte-support';
import { TteRepository } from '../shared/repository/tte.repository';
import type { PdfSignatureMetadataInput } from '../shared/repository/tte.repository';
import type {
  TteBatchSignSopPengajuanResponse,
  TteRiwayatResponse,
} from '../shared/types/tte.types';
import { SopOfficialPdfService } from '../../sop/pdf/sop-official-pdf.service';
import { SopPdfStorageService } from '../../sop/pdf/sop-pdf-storage.service';
import { TtePdfSigningService } from './tte-pdf-signing.service';

@Injectable()
export class TtePenandatangananService {
  constructor(
    private readonly tteRepository: TteRepository,
    private readonly publicUrlResolver: TtePublicUrlResolver,
    @Optional() private readonly sopOfficialPdfService?: SopOfficialPdfService,
    @Optional() private readonly sopPdfStorageService?: SopPdfStorageService,
    @Optional() private readonly ttePdfSigningService?: TtePdfSigningService,
  ) {}

  async tandaTanganiBa(
    user: JwtAccessPayload,
    pengajuanEvaluasiId: string,
    dto: TandaTanganiDto,
    req?: Pick<Request, 'headers'>,
  ): Promise<TteRiwayatResponse> {
    const pengguna = await this.tteRepository.findPenggunaAktif(user.sub);
    if (pengguna === null) {
      throw new NotFoundException('Pengguna tidak ditemukan');
    }
    await this.assertPinValid(user.sub, dto.pin);
    const hashDokumen = hashDokumenKanonik({
      jenis: JenisDokumenTte.BERITA_ACARA_EVALUASI,
      nomorDokumen: dto.nomorDokumen,
      judulDokumen: dto.judulDokumen,
      refId: pengajuanEvaluasiId,
    });
    if (pengguna.peran === PeranPengguna.PJ_EVALUATOR) {
      const result = await runTteRepositoryMutation(() =>
        this.tteRepository.transaksiTandaTanganiBaEvaluator({
          pengajuanEvaluasiId,
          userId: user.sub,
          peran: PeranPengguna.PJ_EVALUATOR,
          hashDokumen,
          nomorDokumen: dto.nomorDokumen,
          judulDokumen: dto.judulDokumen,
        }),
      );
      if (result.error === 'NOT_FOUND') {
        throw new NotFoundException('Pengajuan evaluasi tidak ditemukan');
      }
      if (result.error === 'BAD_STATUS') {
        throw new ConflictException(
          `Pengajuan tidak dapat ditandatangani pada status ${String((result as { status?: StatusPengajuanEvaluasi }).status)}`,
        );
      }
      if (result.error === 'ALREADY_SIGNED') {
        throw new ConflictException('Berita Acara sudah ditandatangani untuk peran ini');
      }
      if (result.error === 'INVALID_DOC_PARENT') {
        throw new ConflictException(
          'Data dokumen TTE tidak konsisten: wajib tepat satu referensi parent (DetailSOP atau PengajuanEvaluasi)',
        );
      }
      if (!result.ok || result.riwayat === null || result.riwayat === undefined) {
        throw new ConflictException('Gagal menyelesaikan penandatanganan');
      }
      return this.mapRiwayat(result.riwayat, req);
    }
    if (pengguna.peran === PeranPengguna.PJ_PENYUSUN) {
      const result = await runTteRepositoryMutation(() =>
        this.tteRepository.transaksiTandaTanganiBaPjPenyusun({
          pengajuanEvaluasiId,
          userId: user.sub,
          userOpdId: pengguna.opdId,
          peran: PeranPengguna.PJ_PENYUSUN,
          hashDokumen,
          nomorDokumen: dto.nomorDokumen,
          judulDokumen: dto.judulDokumen,
        }),
      );
      if (result.error === 'NOT_FOUND') {
        throw new NotFoundException('Pengajuan evaluasi tidak ditemukan');
      }
      if (result.error === 'FORBIDDEN_OPD') {
        throw new ForbiddenException('Pengajuan tidak termasuk OPD Anda');
      }
      if (result.error === 'BAD_STATUS') {
        throw new ConflictException(
          `Pengajuan tidak dapat ditandatangani pada status ${String((result as { status?: StatusPengajuanEvaluasi }).status)}`,
        );
      }
      if (result.error === 'ALREADY_SIGNED') {
        throw new ConflictException('Berita Acara sudah ditandatangani untuk peran ini');
      }
      if (result.error === 'INVALID_DOC_PARENT') {
        throw new ConflictException(
          'Data dokumen TTE tidak konsisten: wajib tepat satu referensi parent (DetailSOP atau PengajuanEvaluasi)',
        );
      }
      if (result.error === 'DOC_MISMATCH') {
        throw new ConflictException('Dokumen TTE tidak cocok dengan pengajuan evaluasi');
      }
      if (result.error === 'SOP_STATUS_DRIFT') {
        throw new ConflictException(
          `Status sebagian SOP sudah berubah (${String((result as { updatedCount?: number }).updatedCount ?? 0)}/${String((result as { expectedCount?: number }).expectedCount ?? 0)}). Muat ulang pengajuan lalu coba tanda tangani lagi.`,
        );
      }
      if (!result.ok || result.riwayat === null || result.riwayat === undefined) {
        throw new ConflictException('Gagal menyelesaikan penandatanganan');
      }
      return this.mapRiwayat(result.riwayat, req);
    }
    throw new ForbiddenException(
      'Hanya PJ Evaluator atau PJ Penyusun yang dapat menandatangani Berita Acara',
    );
  }

  async tandaTanganiSemuaSopPengajuan(
    user: JwtAccessPayload,
    pengajuanEvaluasiId: string,
    dto: TandaTanganiSemuaSopDto,
    req?: Pick<Request, 'headers'>,
  ): Promise<TteBatchSignSopPengajuanResponse> {
    const pengguna = await this.tteRepository.findPenggunaAktif(user.sub);
    if (pengguna === null) {
      throw new NotFoundException('Pengguna tidak ditemukan');
    }
    if (pengguna.peran !== PeranPengguna.KEPALA_OPD) {
      throw new ForbiddenException('Hanya Kepala OPD yang dapat menandatangani seluruh SOP');
    }
    await this.assertPinValid(user.sub, dto.pin);
    const hashDokumen = hashDokumenKanonik({
      jenis: JenisDokumenTte.SOP_BERLAKU,
      nomorDokumen: dto.nomorDokumen,
      judulDokumen: dto.judulDokumen,
      refId: pengajuanEvaluasiId,
    });
    const signedAt = new Date();
    // Satu objek tanggal dipakai bersama oleh artefak PDF dan update DetailSOP agar
    // keduanya tidak mungkin berbeda ketika pengesahan terjadi dekat pergantian hari WIB.
    const tanggalEfektif = toWibDateOnly(signedAt);
    if (
      this.sopOfficialPdfService === undefined ||
      this.sopPdfStorageService === undefined ||
      this.ttePdfSigningService === undefined
    ) {
      throw new ConflictException('Layanan PDF SOP resmi belum tersedia');
    }
    const unsignedPdfByDetailSopId = new Map<string, Buffer>();
    for (const sopPdf of dto.sopPdfs) {
      if (unsignedPdfByDetailSopId.has(sopPdf.detailSopId)) {
        throw new BadRequestException(
          `PDF SOP ${sopPdf.detailSopId} dikirim lebih dari satu kali.`,
        );
      }
      unsignedPdfByDetailSopId.set(
        sopPdf.detailSopId,
        this.sopOfficialPdfService.buildUnsignedOfficialPdf(sopPdf.detailSopId, sopPdf.pdfBase64),
      );
    }
    const prepared = await runTteRepositoryMutation(() =>
      this.tteRepository.prepareSopPengesahanDocuments({
        pengajuanEvaluasiId,
        userId: user.sub,
        userOpdId: pengguna.opdId,
        peran: PeranPengguna.KEPALA_OPD,
        hashDokumen,
        nomorDokumen: dto.nomorDokumen,
        judulDokumen: dto.judulDokumen,
        expectedDetailSopIds: [...unsignedPdfByDetailSopId.keys()],
      }),
    );
    if (!prepared.ok) {
      this.throwBatchSopResult(prepared);
    }
    if (unsignedPdfByDetailSopId.size !== prepared.items.length) {
      throw new BadRequestException(
        'PDF hasil renderer kanvas wajib dikirim tepat satu untuk setiap SOP dalam pengajuan.',
      );
    }
    const artifacts: Array<{
      detailSopId: string;
      dokumenTteId: string;
      pdfPath: string;
      pdfSha256: string;
      pdfSizeBytes: number;
      signatureMetadata: PdfSignatureMetadataInput;
    }> = [];
    try {
      if (!prepared.ok) throw new Error();
      for (const item of prepared.items) {
        const unsignedPdf = unsignedPdfByDetailSopId.get(item.detailSopId);
        if (unsignedPdf === undefined) {
          throw new BadRequestException(
            `PDF hasil renderer kanvas untuk SOP ${item.detailSopId} tidak ditemukan.`,
          );
        }
        const relativePath = this.sopPdfStorageService.buildRelativePath({
          opdId: item.opdId,
          sopId: item.sopId,
          detailSopId: item.detailSopId,
          versi: item.versi,
        });
        const qrStampedPdf = await this.sopOfficialPdfService.stampPengesahanMetadata({
          detailSopId: item.detailSopId,
          pdfBuffer: unsignedPdf,
          qrPayload: this.buildSopPengesahanQrPayload(item.dokumenTteId, user.sub, req),
          tanggalEfektif,
        });
        const signedPdf = await this.ttePdfSigningService.signOfficialSopPdfWithUserCertificate({
          userId: user.sub,
          pin: dto.pin,
          dokumenTteId: item.dokumenTteId,
          pdfBuffer: qrStampedPdf,
          signerName: pengguna.nama,
        });
        const stored = await this.sopPdfStorageService.writeOfficialPdf(
          relativePath,
          signedPdf.signedPdf,
        );
        artifacts.push({
          detailSopId: item.detailSopId,
          dokumenTteId: item.dokumenTteId,
          pdfPath: stored.relativePath,
          pdfSha256: stored.sha256,
          pdfSizeBytes: stored.sizeBytes,
          signatureMetadata: signedPdf.riwayatMetadata,
        });
      }
      const result = await runTteRepositoryMutation(() =>
        this.tteRepository.finalizeSopPengesahanWithArtifacts({
          pengajuanEvaluasiId,
          userId: user.sub,
          userOpdId: pengguna.opdId,
          peran: PeranPengguna.KEPALA_OPD,
          signedAt,
          tanggalEfektif,
          artifacts,
        }),
      );
      if (!result.ok) {
        this.throwBatchSopResult(result);
      }
    } catch (error) {
      const storageService = this.sopPdfStorageService;
      if (storageService !== undefined) {
        await Promise.all(
          artifacts.map((artifact) => storageService.deleteStoredPdf(artifact.pdfPath)),
        );
      }
      throw error;
    }
    return {
      pengajuanEvaluasiId,
      totalSopDitandatangani: artifacts.length,
      ditandatanganiPada: signedAt.toISOString(),
    };
  }

  private throwBatchSopResult(result: {
    ok?: false;
    error?: string;
    status?: StatusPengajuanEvaluasi | StatusSOP;
    expectedStatus?: StatusPengajuanEvaluasi | StatusSOP;
    detailSopId?: string;
    nomorSOP?: string;
    judulSOP?: string;
    expectedCount?: number;
    updatedCount?: number;
  }): never {
    if (result.error === 'NOT_FOUND') {
      throw new NotFoundException('Pengajuan evaluasi tidak ditemukan');
    }
    if (result.error === 'FORBIDDEN_OPD') {
      throw new ForbiddenException('Pengajuan tidak termasuk OPD Anda');
    }
    if (result.error === 'BAD_PENGAJUAN_STATUS') {
      throw new ConflictException(
        `Pengajuan tidak dapat ditandatangani pada status ${String((result as { status?: StatusPengajuanEvaluasi }).status)}. Pengesahan massal SOP dalam pengajuan evaluasi hanya diizinkan pada status ${String((result as { expectedStatus?: StatusPengajuanEvaluasi }).expectedStatus ?? StatusPengajuanEvaluasi.DITANDATANGANI_PJ_PENYUSUN)}.`,
      );
    }
    if (result.error === 'EMPTY_SOP') {
      throw new BadRequestException('Pengajuan tidak memiliki SOP untuk ditandatangani');
    }
    if (result.error === 'BAD_SOP_STATUS') {
      throw new ConflictException(
        `SOP ${String((result as { nomorSOP?: string }).nomorSOP ?? (result as { detailSopId?: string }).detailSopId)} (${String((result as { judulSOP?: string }).judulSOP ?? '-')}) tidak dapat ditandatangani dari status ${String((result as { status?: StatusSOP }).status)}. Status yang diwajibkan: ${String((result as { expectedStatus?: StatusSOP }).expectedStatus ?? StatusSOP.DIVERIFIKASI_PJ_EVALUATOR_ORGANISASI)}.`,
      );
    }
    if (result.error === 'ALREADY_SIGNED') {
      throw new ConflictException(
        `SOP ${String((result as { detailSopId?: string }).detailSopId)} sudah ditandatangani oleh Kepala OPD`,
      );
    }
    if (result.error === 'INVALID_DOC_PARENT') {
      throw new ConflictException(
        `Data dokumen TTE tidak konsisten untuk SOP ${String((result as { detailSopId?: string }).detailSopId)}: wajib tepat satu referensi parent (DetailSOP atau PengajuanEvaluasi)`,
      );
    }
    if (result.error === 'SOP_STATUS_DRIFT') {
      throw new ConflictException(
        `Status sebagian SOP sudah berubah (${String((result as { updatedCount?: number }).updatedCount ?? 0)}/${String((result as { expectedCount?: number }).expectedCount ?? 0)}). Muat ulang pengajuan lalu coba tanda tangani lagi.`,
      );
    }
    throw new ConflictException('Gagal menandatangani seluruh SOP dalam pengajuan');
  }

  private mapRiwayat(
    row: {
      userId: string;
      dokumenTteId: string;
      peran: PeranPengguna;
      ditandatanganiPada: Date;
      dokumenTte: {
        dokumenTteId: string;
        nomorDokumen: string;
        judulDokumen: string;
        hashDokumen: string;
        jenisDokumen: JenisDokumenTte;
        detailSopId: string | null;
        pengajuanEvaluasiId: string | null;
      };
      user: { penggunaId: string; nama: string; nip: string };
    },
    req?: Pick<Request, 'headers'>,
  ): TteRiwayatResponse {
    const peranMap = mapTtePeranResponse(row.peran);
    const qr = buildTteQrPayload({
      publicVerifyBaseUrl: this.publicUrlResolver.resolveDocumentVerifyBaseUrl(req),
      dokumenTteId: row.dokumenTte.dokumenTteId,
      hashDokumen: row.dokumenTte.hashDokumen,
    });
    return {
      id: `${row.dokumenTte.dokumenTteId}:${row.userId}`,
      userId: row.userId,
      peran: peranMap,
      dokumenTteId: row.dokumenTte.dokumenTteId,
      nomorDokumen: row.dokumenTte.nomorDokumen,
      jenisDokumen: String(row.dokumenTte.jenisDokumen),
      judulDokumen: row.dokumenTte.judulDokumen,
      hashDokumen: row.dokumenTte.hashDokumen,
      sopDetailId: row.dokumenTte.detailSopId ?? undefined,
      pengajuanEvaluasiId: row.dokumenTte.pengajuanEvaluasiId ?? undefined,
      ditandatanganiPada: row.ditandatanganiPada.toISOString(),
      user: { id: row.user.penggunaId, nama: row.user.nama, nip: row.user.nip },
      qrVerificationUrl: qr.qrVerificationUrl,
      qrPayload: qr.qrPayload,
    };
  }

  private buildSopPengesahanQrPayload(
    dokumenTteId: string,
    userId: string,
    req?: Pick<Request, 'headers'>,
  ): string {
    const baseUrl = this.publicUrlResolver.resolvePengesahanVerifyBaseUrl(req);
    if (baseUrl !== undefined) {
      return `${baseUrl}/${encodeURIComponent(dokumenTteId)}/${encodeURIComponent(userId)}`;
    }
    return JSON.stringify({
      t: 'tte-pengesahan-v1',
      dokumenTteId,
      userId,
    });
  }

  private async assertPinValid(userId: string, pin: string): Promise<void> {
    const row = await this.tteRepository.findKredensial(userId);
    if (row === null) {
      throw new BadRequestException('Kredensial TTE belum dibuat');
    }
    const ok = await bcrypt.compare(pin, row.hashPin);
    if (!ok) {
      throw new ForbiddenException('PIN TTE tidak valid');
    }
  }
}
