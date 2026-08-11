import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { JwtAccessPayload } from '../../../common';
import { displayStatusTindakLanjut } from '../../../common/status/status-display';
import {
  HasilEvaluasi,
  JenisPengajuanEvaluasi,
  NilaiEvaluasi,
  PengajuanEvaluasi,
  PeranPengguna,
  Prisma,
  StatusTindakLanjut,
  StatusPengajuanEvaluasi,
  StatusSOP,
} from '../../../generated/prisma';
import { IsiNilaiEvaluasiDto } from './dto/isi-nilai-evaluasi.dto';
import type { NilaiEvaluasiPatchResponseDto } from './dto/nilai-evaluasi-patch-response.dto';
import { buildNilaiEvaluasiClientId } from './nilai-evaluasi-client-id';
import type { PengajuanEvaluasiSelesaiResponseDto } from './dto/pengajuan-evaluasi-selesai-response.dto';
import { SelesaiEvaluasiDto } from './dto/selesai-evaluasi.dto';
import { TolakPengajuanEvaluasiDto } from './dto/tolak-pengajuan-evaluasi.dto';
import { assertBolehKirimUlangSetelahRevisi } from './evaluasi-revisi.policy';
import { EvaluasiNilaiRepository } from './evaluasi-nilai.repository';
import { PengajuanEvaluasiRepository } from '../pengajuan/pengajuan-evaluasi.repository';

@Injectable()
export class EvaluasiNilaiService {
  constructor(
    private readonly evaluasiNilaiRepository: EvaluasiNilaiRepository,
    private readonly pengajuanEvaluasiRepository: PengajuanEvaluasiRepository,
  ) {}

  private assertHanyaEvaluator(user: JwtAccessPayload): void {
    if (user.peran !== PeranPengguna.EVALUATOR) {
      throw new ForbiddenException(
        'Hanya evaluator yang dapat menilai dan menyelesaikan pengajuan evaluasi',
      );
    }
  }

  /** Menyimpan satu nilai SOP dalam pengajuan aktif dan mencatat `LogNilaiEvaluasi`. */
  async isiNilai(
    user: JwtAccessPayload,
    pengajuanEvaluasiId: string,
    detailSopId: string,
    dto: IsiNilaiEvaluasiDto,
  ): Promise<NilaiEvaluasiPatchResponseDto> {
    this.assertHanyaEvaluator(user);
    const evaluatorId = user.sub;
    const expectedVersion = dto.version ?? 0;
    const hasil = dto.hasil;
    if (hasil === HasilEvaluasi.DITOLAK) {
      throw new BadRequestException(
        'Hasil DITOLAK hanya dapat ditetapkan melalui aksi penolakan pengajuan',
      );
    }
    const catatanNorm = dto.catatan === undefined ? null : dto.catatan.trim();
    if (hasil === HasilEvaluasi.PERLU_PERBAIKAN && (catatanNorm === null || catatanNorm === '')) {
      throw new BadRequestException('Catatan wajib diisi jika hasil Perlu Perbaikan');
    }
    const barisAkhir = await this.evaluasiNilaiRepository.runTransaction(
      async (tx: Prisma.TransactionClient): Promise<NilaiEvaluasi> => {
        const pengajuan = await tx.pengajuanEvaluasi.findUnique({
          where: { pengajuanEvaluasiId },
          select: { status: true },
        });
        if (pengajuan === null) {
          throw new NotFoundException(
            'Pengajuan evaluasi tidak ditemukan atau tidak aktif untuk diisi nilai',
          );
        }
        if (pengajuan.status !== StatusPengajuanEvaluasi.SEDANG_DIEVALUASI) {
          throw new NotFoundException(
            'Pengajuan evaluasi tidak ditemukan atau tidak aktif untuk diisi nilai',
          );
        }
        const sebelumnya = await tx.nilaiEvaluasi.findUnique({
          where: {
            pengajuanEvaluasiId_detailSopId: {
              pengajuanEvaluasiId,
              detailSopId,
            },
          },
        });
        if (sebelumnya === null) {
          throw new NotFoundException(
            'Baris nilai untuk dokumen SOP ini tidak ada dalam pengajuan',
          );
        }
        if (sebelumnya.version !== expectedVersion) {
          throw new ConflictException(
            'Konflik versi: data nilai sudah berubah, muat ulang lalu coba lagi',
          );
        }
        const statusTindakLanjutSebelum = sebelumnya.statusTindakLanjut ?? null;
        let statusTindakLanjutSesudah = statusTindakLanjutSebelum;
        let tindakLanjutData = {};
        if (hasil === HasilEvaluasi.PERLU_PERBAIKAN) {
          statusTindakLanjutSesudah = StatusTindakLanjut.TERBUKA;
          tindakLanjutData = {
            statusTindakLanjut: StatusTindakLanjut.TERBUKA,
            ditindaklanjutiPada: null,
            ditindaklanjutiOlehId: null,
          };
        } else {
          if (sebelumnya.statusTindakLanjut === StatusTindakLanjut.TERBUKA) {
            statusTindakLanjutSesudah = null;
            tindakLanjutData = {
              statusTindakLanjut: null,
              ditindaklanjutiPada: null,
              ditindaklanjutiOlehId: null,
            };
          }
        }
        const logCreatedAt = new Date();
        const idleWindowMs = 10 * 60 * 1000;
        const cutoff = new Date(logCreatedAt.getTime() - idleWindowMs);

        const lastLog = await tx.logNilaiEvaluasi.findFirst({
          where: {
            pengajuanEvaluasiId,
            detailSopId,
            penggunaId: evaluatorId,
            createdAt: { gt: cutoff },
          },
          orderBy: { createdAt: 'desc' },
        });

        if (lastLog) {
          if (lastLog.hasilSebelum === hasil && (lastLog.catatanSebelum ?? null) === catatanNorm) {
            // Reverted back to the original state within the idle window. Delete the log to avoid spam.
            await tx.logNilaiEvaluasi.delete({
              where: {
                pengajuanEvaluasiId_detailSopId_penggunaId_createdAt: {
                  pengajuanEvaluasiId,
                  detailSopId,
                  penggunaId: evaluatorId,
                  createdAt: lastLog.createdAt,
                },
              },
            });
          } else {
            // Update the existing session log.
            await tx.logNilaiEvaluasi.update({
              where: {
                pengajuanEvaluasiId_detailSopId_penggunaId_createdAt: {
                  pengajuanEvaluasiId,
                  detailSopId,
                  penggunaId: evaluatorId,
                  createdAt: lastLog.createdAt,
                },
              },
              data: {
                hasilSesudah: hasil,
                catatanSesudah: catatanNorm,
                statusTindakLanjutSesudah,
              },
            });
          }
        } else {
          await tx.logNilaiEvaluasi.create({
            data: {
              pengajuanEvaluasiId,
              detailSopId,
              penggunaId: evaluatorId,
              createdAt: logCreatedAt,
              hasilSebelum: sebelumnya.hasil,
              hasilSesudah: hasil,
              catatanSebelum: sebelumnya.catatan ?? null,
              catatanSesudah: catatanNorm,
              statusTindakLanjutSebelum,
              statusTindakLanjutSesudah,
            },
          });
        }
        const sesudah = await tx.nilaiEvaluasi.update({
          where: {
            pengajuanEvaluasiId_detailSopId: {
              pengajuanEvaluasiId,
              detailSopId,
            },
          },
          data: {
            hasil,
            catatan: catatanNorm,
            version: { increment: 1 },
            dinilaiOlehId: evaluatorId,
            ...tindakLanjutData,
          },
        });
        if (hasil === HasilEvaluasi.PERLU_PERBAIKAN) {
          await tx.detailSOP.updateMany({
            where: {
              detailSopId,
              status: {
                in: [StatusSOP.DIAJUKAN_EVALUASI, StatusSOP.SEDANG_DIEVALUASI],
              },
            },
            data: {
              status: StatusSOP.REVISI_DARI_EVALUATOR,
            },
          });
        }
        return sesudah;
      },
    );
    return EvaluasiNilaiService.keResponseNilaiDto(barisAkhir);
  }

  /** Penyusun / PJ: tandai catatan evaluasi sudah ditindaklanjuti sebelum kirim ulang. */
  async tandaiTindakLanjutSelesai(
    user: JwtAccessPayload,
    pengajuanEvaluasiId: string,
    detailSopId: string,
  ): Promise<NilaiEvaluasiPatchResponseDto> {
    if (user.peran !== PeranPengguna.PENYUSUN && user.peran !== PeranPengguna.PJ_PENYUSUN) {
      throw new ForbiddenException(
        'Hanya penyusun atau PJ Penyusun yang dapat menandai tindak lanjut evaluasi',
      );
    }
    const opdId = await this.pengajuanEvaluasiRepository.findOpdIdPengguna(user.sub);
    if (opdId === null) {
      throw new ForbiddenException('OPD pengguna tidak ditemukan');
    }
    const barisAkhir = await this.evaluasiNilaiRepository.runTransaction(
      async (tx: Prisma.TransactionClient): Promise<NilaiEvaluasi> => {
        const pengajuan = await tx.pengajuanEvaluasi.findUnique({
          where: { pengajuanEvaluasiId },
          select: { status: true, opdId: true },
        });
        if (pengajuan === null || pengajuan.opdId !== opdId) {
          throw new NotFoundException('Pengajuan evaluasi tidak ditemukan');
        }
        if (pengajuan.status !== StatusPengajuanEvaluasi.SEDANG_DIEVALUASI) {
          throw new BadRequestException('Pengajuan tidak dalam status evaluasi aktif');
        }
        const detail = await tx.detailSOP.findFirst({
          where: { detailSopId, sop: { opdId } },
          select: { status: true },
        });
        if (detail === null) {
          throw new NotFoundException('Detail SOP tidak ditemukan');
        }
        if (detail.status !== StatusSOP.REVISI_DARI_EVALUATOR) {
          throw new ConflictException(
            'Hanya dokumen berstatus revisi dari evaluator yang dapat ditandai tindak lanjut',
          );
        }
        const nilai = await tx.nilaiEvaluasi.findUnique({
          where: {
            pengajuanEvaluasiId_detailSopId: {
              pengajuanEvaluasiId,
              detailSopId,
            },
          },
        });
        if (nilai === null) {
          throw new NotFoundException('Baris nilai evaluasi tidak ditemukan');
        }
        if (nilai.hasil !== HasilEvaluasi.PERLU_PERBAIKAN) {
          throw new BadRequestException(
            'Hanya umpan balik Perlu perbaikan yang memerlukan tindak lanjut',
          );
        }
        if (nilai.statusTindakLanjut === StatusTindakLanjut.SELESAI) {
          throw new ConflictException('Umpan balik evaluasi sudah ditandai selesai');
        }
        if (nilai.statusTindakLanjut !== StatusTindakLanjut.TERBUKA) {
          throw new BadRequestException(
            'Tidak ada umpan balik evaluasi yang menunggu tindak lanjut',
          );
        }
        const sekarang = new Date();
        await tx.logNilaiEvaluasi.create({
          data: {
            pengajuanEvaluasiId,
            detailSopId,
            penggunaId: user.sub,
            createdAt: sekarang,
            hasilSebelum: nilai.hasil,
            hasilSesudah: nilai.hasil,
            catatanSebelum: nilai.catatan ?? null,
            catatanSesudah: nilai.catatan ?? null,
            statusTindakLanjutSebelum: nilai.statusTindakLanjut,
            statusTindakLanjutSesudah: StatusTindakLanjut.SELESAI,
            ditindaklanjutiOlehId: user.sub,
            ditindaklanjutiPada: sekarang,
          },
        });
        return tx.nilaiEvaluasi.update({
          where: {
            pengajuanEvaluasiId_detailSopId: {
              pengajuanEvaluasiId,
              detailSopId,
            },
          },
          data: {
            statusTindakLanjut: StatusTindakLanjut.SELESAI,
            ditindaklanjutiPada: sekarang,
            ditindaklanjutiOlehId: user.sub,
            version: { increment: 1 },
          },
        });
      },
    );
    return EvaluasiNilaiService.keResponseNilaiDto(barisAkhir);
  }

  /** Validasi guard kirim ulang: wajib status tindak lanjut SELESAI bila hasil perlu perbaikan. */
  async assertBolehKirimUlangSetelahRevisi(detailSopId: string): Promise<void> {
    const nilai = await this.evaluasiNilaiRepository.findNilaiRevisiAktifForDetail(detailSopId);
    assertBolehKirimUlangSetelahRevisi(nilai);
  }

  async findOpdIdByDetailSopId(detailSopId: string): Promise<string | null> {
    return this.evaluasiNilaiRepository.findOpdIdByDetailSopId(detailSopId);
  }

  async findUmpanBalikForDetail(
    detailSopId: string,
    opdId: string,
  ): Promise<Awaited<ReturnType<EvaluasiNilaiRepository['findUmpanBalikForDetail']>>> {
    return this.evaluasiNilaiRepository.findUmpanBalikForDetail(detailSopId, opdId);
  }

  /** Mengakhiri siklus evaluasi pengajuan (menuju PJ) hanya jika tiap dokumen SESUAI dan skor OPD terisi. */
  async selesai(
    user: JwtAccessPayload,
    pengajuanEvaluasiId: string,
    dto: SelesaiEvaluasiDto,
  ): Promise<PengajuanEvaluasiSelesaiResponseDto> {
    this.assertHanyaEvaluator(user);
    const evaluatorId = user.sub;
    const yangDiupdate = await this.evaluasiNilaiRepository.runTransaction(
      async (tx: Prisma.TransactionClient): Promise<PengajuanEvaluasi | null> => {
        const pengajuan = await tx.pengajuanEvaluasi.findUnique({
          where: { pengajuanEvaluasiId },
          include: { nilaiEvaluasi: true },
        });
        if (pengajuan === null) {
          throw new NotFoundException('Pengajuan evaluasi tidak ditemukan');
        }
        if (pengajuan.status !== StatusPengajuanEvaluasi.SEDANG_DIEVALUASI) {
          throw new BadRequestException('Pengajuan tidak dalam status pengisian evaluator');
        }
        const pengajuanRequestOpd = pengajuan.jenis === JenisPengajuanEvaluasi.EVALUASI_REQUEST_OPD;
        if (pengajuanRequestOpd && dto.nilaiOPD !== undefined) {
          throw new BadRequestException(
            'Evaluasi request OPD tidak menggunakan penilaian tingkat OPD; jangan kirim nilaiOPD.',
          );
        }
        if (!pengajuanRequestOpd) {
          const skor = dto.nilaiOPD;
          if (
            skor === undefined ||
            skor === null ||
            !Number.isInteger(skor) ||
            skor < 1 ||
            skor > 5
          ) {
            throw new BadRequestException(
              'Skor evaluasi tingkat OPD (1–5) wajib untuk pengajuan evaluator.',
            );
          }
        }
        const nilaiOpdFinal = pengajuanRequestOpd ? null : dto.nilaiOPD!;
        if (pengajuan.nilaiEvaluasi.length === 0) {
          throw new BadRequestException('Pengajuan tidak memiliki dokumen untuk dinilai');
        }
        for (const row of pengajuan.nilaiEvaluasi) {
          if (row.hasil !== HasilEvaluasi.SESUAI) {
            throw new BadRequestException(
              'Semua SOP harus bernilai Sesuai sebelum mengajukan tanda tangan Berita Acara. Perbaiki atau lengkapi evaluasi per dokumen.',
            );
          }
        }
        const detailIds = pengajuan.nilaiEvaluasi.map((n) => n.detailSopId);
        const promoted = await tx.detailSOP.updateMany({
          where: {
            detailSopId: { in: detailIds },
            status: {
              in: [
                StatusSOP.DIAJUKAN_EVALUASI,
                StatusSOP.SEDANG_DIEVALUASI,
                StatusSOP.REVISI_DARI_EVALUATOR,
              ],
            },
          },
          data: { status: StatusSOP.MENUNGGU_TTD_PJ_EVALUATOR },
        });
        if (promoted.count !== detailIds.length) {
          throw new ConflictException(
            'Status sebagian SOP sudah berubah. Muat ulang pengajuan lalu coba selesaikan evaluasi lagi.',
          );
        }

        // Cek duplikasi nomor BA
        const existingBA = await tx.pengajuanEvaluasi.findUnique({
          where: { nomorBA: dto.nomorBA },
          select: { pengajuanEvaluasiId: true },
        });
        if (existingBA !== null && existingBA.pengajuanEvaluasiId !== pengajuanEvaluasiId) {
          throw new ConflictException(
            `Nomor Berita Acara "${dto.nomorBA}" sudah digunakan oleh pengajuan lain.`,
          );
        }

        const selesai = new Date();
        await tx.pengajuanEvaluasi.update({
          where: { pengajuanEvaluasiId },
          data: {
            status: StatusPengajuanEvaluasi.SELESAI_DIEVALUASI,
            nomorBA: dto.nomorBA,
            nilaiOPD: nilaiOpdFinal,
            tanggalDiselesaikan: selesai,
            tanggalEvaluasi: pengajuan.tanggalEvaluasi ?? selesai,
            diselesaikanOlehId: evaluatorId,
            version: { increment: 1 },
          },
        });
        return tx.pengajuanEvaluasi.findUnique({
          where: { pengajuanEvaluasiId },
        });
      },
    );
    return EvaluasiNilaiService.keResponseSelesaiDto(yangDiupdate);
  }

  /** Menolak final seluruh pengajuan dan mengunci setiap versi SOP di dalamnya. */
  async tolak(
    user: JwtAccessPayload,
    pengajuanEvaluasiId: string,
    dto: TolakPengajuanEvaluasiDto,
  ): Promise<PengajuanEvaluasiSelesaiResponseDto> {
    this.assertHanyaEvaluator(user);
    const alasan = dto.alasan.trim();
    if (alasan === '') {
      throw new BadRequestException('Alasan penolakan wajib diisi');
    }

    const hasilAkhir = await this.evaluasiNilaiRepository.runTransaction(
      async (tx: Prisma.TransactionClient): Promise<PengajuanEvaluasi | null> => {
        const pengajuan = await tx.pengajuanEvaluasi.findUnique({
          where: { pengajuanEvaluasiId },
          include: {
            nilaiEvaluasi: {
              include: { detailSop: { select: { status: true } } },
            },
          },
        });
        if (pengajuan === null) {
          throw new NotFoundException('Pengajuan evaluasi tidak ditemukan');
        }
        if (pengajuan.status !== StatusPengajuanEvaluasi.SEDANG_DIEVALUASI) {
          throw new ConflictException('Hanya pengajuan yang sedang dievaluasi yang dapat ditolak');
        }
        if (pengajuan.version !== dto.version) {
          throw new ConflictException(
            'Konflik versi: pengajuan sudah berubah, muat ulang lalu coba lagi',
          );
        }
        if (pengajuan.nilaiEvaluasi.length === 0) {
          throw new BadRequestException('Pengajuan tidak memiliki dokumen untuk ditolak');
        }

        const statusYangDapatDitolak = new Set<StatusSOP>([
          StatusSOP.DIAJUKAN_EVALUASI,
          StatusSOP.SEDANG_DIEVALUASI,
          StatusSOP.REVISI_DARI_EVALUATOR,
        ]);
        const statusTidakValid = pengajuan.nilaiEvaluasi.find(
          (nilai) => !statusYangDapatDitolak.has(nilai.detailSop.status),
        );
        if (statusTidakValid !== undefined) {
          throw new ConflictException(
            'Status salah satu SOP sudah berubah. Muat ulang pengajuan lalu coba lagi',
          );
        }

        const ditolakPada = new Date();
        const updated = await tx.pengajuanEvaluasi.updateMany({
          where: {
            pengajuanEvaluasiId,
            status: StatusPengajuanEvaluasi.SEDANG_DIEVALUASI,
            version: dto.version,
          },
          data: {
            status: StatusPengajuanEvaluasi.DITOLAK,
            alasanPenolakan: alasan,
            ditolakOlehId: user.sub,
            tanggalDitolak: ditolakPada,
            version: { increment: 1 },
          },
        });
        if (updated.count !== 1) {
          throw new ConflictException('Pengajuan sudah berubah, muat ulang lalu coba lagi');
        }

        for (const [index, nilai] of pengajuan.nilaiEvaluasi.entries()) {
          const logPada = new Date(ditolakPada.getTime() + index);
          await tx.logNilaiEvaluasi.create({
            data: {
              pengajuanEvaluasiId,
              detailSopId: nilai.detailSopId,
              penggunaId: user.sub,
              createdAt: logPada,
              hasilSebelum: nilai.hasil,
              hasilSesudah: HasilEvaluasi.DITOLAK,
              catatanSebelum: nilai.catatan ?? null,
              catatanSesudah: alasan,
              statusTindakLanjutSebelum: nilai.statusTindakLanjut ?? null,
              statusTindakLanjutSesudah: null,
            },
          });
          const nilaiDitolak = await tx.nilaiEvaluasi.updateMany({
            where: {
              pengajuanEvaluasiId,
              detailSopId: nilai.detailSopId,
              version: nilai.version,
            },
            data: {
              hasil: HasilEvaluasi.DITOLAK,
              catatan: alasan,
              statusTindakLanjut: null,
              ditindaklanjutiPada: null,
              ditindaklanjutiOlehId: null,
              dinilaiOlehId: user.sub,
              version: { increment: 1 },
            },
          });
          if (nilaiDitolak.count !== 1) {
            throw new ConflictException(
              'Salah satu nilai SOP sudah berubah, muat ulang lalu coba lagi',
            );
          }
        }

        const detailDitolak = await tx.detailSOP.updateMany({
          where: {
            detailSopId: {
              in: pengajuan.nilaiEvaluasi.map((nilai) => nilai.detailSopId),
            },
            status: { in: [...statusYangDapatDitolak] },
          },
          data: { status: StatusSOP.DITOLAK_EVALUATOR },
        });
        if (detailDitolak.count !== pengajuan.nilaiEvaluasi.length) {
          throw new ConflictException(
            'Status salah satu SOP sudah berubah. Muat ulang pengajuan lalu coba lagi',
          );
        }
        return tx.pengajuanEvaluasi.findUnique({ where: { pengajuanEvaluasiId } });
      },
    );
    return EvaluasiNilaiService.keResponseSelesaiDto(hasilAkhir);
  }

  private static keResponseNilaiDto(row: NilaiEvaluasi): NilaiEvaluasiPatchResponseDto {
    const tindakDisplay = displayStatusTindakLanjut(row.statusTindakLanjut);
    return {
      id: buildNilaiEvaluasiClientId(row.pengajuanEvaluasiId, row.detailSopId),
      pengajuanEvaluasiId: row.pengajuanEvaluasiId,
      sopDetailId: row.detailSopId,
      hasil: row.hasil === undefined || row.hasil === null ? undefined : row.hasil,
      catatan: row.catatan ?? null,
      statusTindakLanjut: row.statusTindakLanjut ?? null,
      statusTindakLanjutLabel: tindakDisplay?.label ?? null,
      ditindaklanjutiPada: row.ditindaklanjutiPada?.toISOString() ?? null,
      version: row.version,
      dinilaiOlehId: row.dinilaiOlehId ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private static keResponseSelesaiDto(
    row: PengajuanEvaluasi | null | undefined,
  ): PengajuanEvaluasiSelesaiResponseDto {
    if (row == null) {
      throw new ConflictException('Gagal memuat pengajuan setelah penyimpanan');
    }
    return {
      id: row.pengajuanEvaluasiId,
      opdId: row.opdId,
      status: String(row.status),
      nilaiOPD: row.nilaiOPD ?? undefined,
      tanggalEvaluasi: row.tanggalEvaluasi?.toISOString(),
      tanggalDiselesaikan: row.tanggalDiselesaikan?.toISOString(),
      diselesaikanOlehId: row.diselesaikanOlehId ?? undefined,
      alasanPenolakan: row.alasanPenolakan ?? undefined,
      ditolakOlehId: row.ditolakOlehId ?? undefined,
      tanggalDitolak: row.tanggalDitolak?.toISOString(),
      version: row.version,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
