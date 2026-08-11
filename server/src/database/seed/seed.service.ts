import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import type { Prisma } from '../../generated/prisma';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  BagianSOP,
  HasilEvaluasi,
  JenisDokumenTte,
  JenisLangkahProsedur,
  JenisPengajuanEvaluasi,
  PeranPengguna,
  SatuanWaktu,
  StatusTindakLanjut,
  StatusPengajuanEvaluasi,
  StatusSOP,
} from '../../generated/prisma';
import { mapStatusSopUntukPengajuan } from './seed-status.util';

const BCRYPT_SALT_ROUNDS = 10;
const DEFAULT_SEED_PASSWORD = '@Password123:)';
const STATUS_PENGAJUAN_AKTIF_SEED: readonly StatusPengajuanEvaluasi[] = [
  StatusPengajuanEvaluasi.SEDANG_DIEVALUASI,
  StatusPengajuanEvaluasi.SELESAI_DIEVALUASI,
  StatusPengajuanEvaluasi.DITANDATANGANI_PJ_EVALUATOR,
  StatusPengajuanEvaluasi.DITANDATANGANI_PJ_PENYUSUN,
] as const;
const STATUS_SOP_WAJIB_PUNYA_PENGAJUAN_AKTIF_SEED: readonly StatusSOP[] = [
  StatusSOP.DIAJUKAN_EVALUASI,
  StatusSOP.SEDANG_DIEVALUASI,
  StatusSOP.REVISI_DARI_EVALUATOR,
  StatusSOP.MENUNGGU_TTD_PJ_EVALUATOR,
  StatusSOP.DIVERIFIKASI_PJ_EVALUATOR_ORGANISASI,
] as const;
const SEED_WORKFLOW_SOP_NUMBERS = [
  'SOP-DINKES-001-V1',
  'SOP-DINKES-001-V2',
  'SOP-DINKES-002-V1',
  'SOP-DINKES-003-V1',
  'SOP-DINKES-004-V1',
  'SOP-DINKES-005-V1',
  'SOP-DINKES-006-V1',
  'SOP-DISKOMINFO-001-V1',
  'SOP-DISKOMINFO-002-V1',
  'SOP-DISKOMINFO-003-V1',
  'SOP-DISDIK-001-V1',
  'SOP-DISDIK-001-V2',
  'SOP-DISDIK-002-V1',
] as const;
const SEED_WORKFLOW_SOP_TITLES = [
  'Pelayanan Surat Keterangan Sehat',
  'Imunisasi Rutin',
  'Surveilans Epidemiologi',
  'Penanganan Gizi Buruk',
  'Pelayanan Rawat Inap',
  'Manajemen Farmasi Puskesmas',
  'Permohonan Informasi Publik',
  'Pengelolaan Media Sosial Pemerintah',
  'Penanganan Aduan Masyarakat Digital',
  'Penerimaan Peserta Didik Baru (PPDB)',
  'Akreditasi Sekolah',
] as const;
const SEED_WORKFLOW_BA_NUMBERS = [
  'BA-DINKES-2026-001',
  'BA-DINKES-2026-002',
  'BA-DISKOMINFO-2026-001',
  'BA-DISKOMINFO-2026-002',
  'BA-DISDIK-2026-001',
  'BA-DISDIK-2026-002',
  'BA-SYNTH-2026-001',
  'BA-SYNTH-2026-002',
  'BA-SYNTH-2026-003',
  'BA-SYNTH-2026-004',
  'BA-SYNTH-2026-005',
  'BA-SYNTH-2026-006',
  'BA-SYNTH-2026-007',
  'BA-SYNTH-2026-008',
] as const;
const SEED_WORKFLOW_DOCUMENT_NUMBERS = [
  'DOC-SOP-DINKES-2024-001',
  'DOC-BA-DINKES-2026-001',
  'DOC-SOP-DISDIK-2024-001',
  'DOC-BA-DISDIK-2023-001',
] as const;

/** Identitas OPD — dipakai sebagai kunci lookup di SEED_USERS */
const SEED_OPD_PJ_EVALUATOR = 'Biro Organisasi Sekretariat Daerah';
const SEED_OPD_DINKES = 'Dinas Kesehatan Provinsi';
const SEED_OPD_DISDIK = 'Dinas Pendidikan Provinsi';

// ─── Types ─────────────────────────────────────────────────────────────────

interface SeedUserInput {
  readonly email: string;
  readonly nama: string;
  readonly peran: PeranPengguna;
  readonly nip: string;
  readonly jabatan: string;
  readonly pangkat: string;
  readonly nohp: string;
  readonly opdKey: string;
}

interface SeedPeraturanInput {
  readonly nomor: string;
  readonly tahun: number;
  readonly nama: string;
  readonly tentang: string;
}

interface SeedUserRecord extends Omit<SeedUserInput, 'opdKey'> {
  readonly penggunaId: string;
  readonly opdId: string;
}

// ─── Static Seed Data ───────────────────────────────────────────────────────

const SEED_USERS: ReadonlyArray<SeedUserInput> = [
  // ── Biro Organisasi (PJ_EVALUATOR + EVALUATOR) ──
  {
    email: 'pjevaluator@gmail.com',
    nama: 'Dr. Bambang Suryono, M.Si.',
    peran: PeranPengguna.PJ_EVALUATOR,
    nip: '198501012009011000',
    jabatan: 'Koordinator Evaluasi SOP',
    pangkat: 'Pembina',
    nohp: '6281234567890',
    opdKey: SEED_OPD_PJ_EVALUATOR,
  },
  {
    email: 'evaluator1@gmail.com',
    nama: 'Siti Rahmawati, S.STP',
    peran: PeranPengguna.EVALUATOR,
    nip: '198501012009011001',
    jabatan: 'Evaluator Madya',
    pangkat: 'Pembina',
    nohp: '6281234567891',
    opdKey: SEED_OPD_PJ_EVALUATOR,
  },
  // ── Dinas Kesehatan ───────────────────────────────────────────────────
  {
    email: 'kepalaopd.dinkes@gmail.com',
    nama: 'dr. Hendra Wijaya, Sp.OG',
    peran: PeranPengguna.KEPALA_OPD,
    nip: '198501012009011005',
    jabatan: 'Kepala OPD Dinkes',
    pangkat: 'Pembina Utama Muda',
    nohp: '6281234567895',
    opdKey: SEED_OPD_DINKES,
  },
  {
    email: 'pjpenyusun.dinkes@gmail.com',
    nama: 'Dewi Kartika, S.Kep',
    peran: PeranPengguna.PJ_PENYUSUN,
    nip: '198501012009011003',
    jabatan: 'Koordinator Penyusunan SOP Dinkes',
    pangkat: 'Pembina',
    nohp: '6281234567893',
    opdKey: SEED_OPD_DINKES,
  },
  {
    email: 'penyusun.dinkes@gmail.com',
    nama: 'Budi Santoso, A.Md.Kep',
    peran: PeranPengguna.PENYUSUN,
    nip: '198501012009011004',
    jabatan: 'Analis SOP Dinkes',
    pangkat: 'Penata',
    nohp: '6281234567894',
    opdKey: SEED_OPD_DINKES,
  },
  // ── Dinas Pendidikan ──────────────────────────────────────────────────
  {
    email: 'kepalaopd.disdik@gmail.com',
    nama: 'Drs. Agus Harimurti, M.Pd.',
    peran: PeranPengguna.KEPALA_OPD,
    nip: '198501012009011011',
    jabatan: 'Kepala Dinas Pendidikan Provinsi',
    pangkat: 'Pembina Utama Muda',
    nohp: '6281234567801',
    opdKey: SEED_OPD_DISDIK,
  },
  {
    email: 'pjpenyusun.disdik@gmail.com',
    nama: 'Rina Permata, S.Pd.',
    peran: PeranPengguna.PJ_PENYUSUN,
    nip: '198501012009011009',
    jabatan: 'Koordinator Penyusunan SOP Disdik',
    pangkat: 'Pembina',
    nohp: '6281234567899',
    opdKey: SEED_OPD_DISDIK,
  },
  {
    email: 'penyusun.disdik@gmail.com',
    nama: 'Ahmad Hidayat, M.Pd.',
    peran: PeranPengguna.PENYUSUN,
    nip: '198501012009011010',
    jabatan: 'Analis SOP Disdik',
    pangkat: 'Penata',
    nohp: '6281234567800',
    opdKey: SEED_OPD_DISDIK,
  },
];

const SEED_PERATURAN: ReadonlyArray<SeedPeraturanInput> = [
  {
    nomor: '12 Tahun 2024',
    tahun: 2024,
    nama: 'Peraturan Daerah Tata Kelola SOP',
    tentang: 'Pedoman tata kelola penyusunan dan evaluasi SOP di lingkungan pemerintah daerah.',
  },
  {
    nomor: '7 Tahun 2023',
    tahun: 2023,
    nama: 'Peraturan Gubernur Transformasi Layanan',
    tentang: 'Percepatan transformasi layanan publik berbasis prosedur baku dan digitalisasi.',
  },
  {
    nomor: '35 Tahun 2012',
    tahun: 2012,
    nama: 'Peraturan MenPAN-RB Nomor 35 Tahun 2012',
    tentang: 'Pedoman penyusunan standar operasional prosedur administrasi pemerintahan.',
  },
  {
    nomor: '15 Tahun 2022',
    tahun: 2022,
    nama: 'Peraturan Gubernur Pelayanan Publik Berkualitas',
    tentang:
      'Penyelenggaraan pelayanan publik berkualitas dan berorientasi pada kepuasan masyarakat.',
  },
];

// ─── Service ────────────────────────────────────────────────────────────────

@Injectable()
export class SeedService {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  // ── Entrypoint ─────────────────────────────────────────────────────────

  async run(): Promise<void> {
    const plainPassword = this.config.get<string>('SEED_DEFAULT_PASSWORD', DEFAULT_SEED_PASSWORD);
    const hashedPassword = await bcrypt.hash(plainPassword, BCRYPT_SALT_ROUNDS);
    await this.prisma.$transaction(async (tx) => {
      // 1. OPD
      const opdPjEvaluator = await this.ensureOpd(tx, SEED_OPD_PJ_EVALUATOR);
      const opdDinkes = await this.ensureOpd(tx, SEED_OPD_DINKES);
      const opdDisdik = await this.ensureOpd(tx, SEED_OPD_DISDIK);

      const opdIdMap: Record<string, string> = {
        [SEED_OPD_PJ_EVALUATOR]: opdPjEvaluator.opdId,
        [SEED_OPD_DINKES]: opdDinkes.opdId,
        [SEED_OPD_DISDIK]: opdDisdik.opdId,
      };

      // 2. Pengguna
      const u = await this.seedUsers(tx, hashedPassword, opdIdMap);

      // 3. Riwayat OPD (jejak pindah OPD per pengguna)
      await this.seedRiwayatOpd(tx, Object.values(u));

      // 4. Peraturan
      const p = await this.seedPeraturan(tx, u['pjpenyusun.dinkes@gmail.com'].penggunaId);

      // 5. OPD ↔ Peraturan
      await this.seedOpdPeraturan(tx, {
        opdDinkesId: opdDinkes.opdId,
        opdDisdikId: opdDisdik.opdId,
        peraturanDaerahId: p['12 Tahun 2024'].peraturanId,
        pergubTransformasiId: p['7 Tahun 2023'].peraturanId,
        permenpanId: p['35 Tahun 2012'].peraturanId,
        pergubLayananId: p['15 Tahun 2022'].peraturanId,
      });

      // 6. Pelaksana
      const pel = await this.seedPelaksana(tx, {
        opdDinkesId: opdDinkes.opdId,
        opdDisdikId: opdDisdik.opdId,
      });

      if (this.config.get<string>('SEED_INCLUDE_WORKFLOW_DUMMY') === 'true') {
        // Legacy demo mode: hanya aktif bila env di-set eksplisit.
        const d = await this.seedSopDanDetail(tx, {
          opdDinkesId: opdDinkes.opdId,
          opdDiskominfoId: opdDisdik.opdId,
          opdDisdikId: opdDisdik.opdId,
          penyusunDinkesId: u['penyusun.dinkes@gmail.com'].penggunaId,
          penyusunDiskominfoId: u['penyusun.disdik@gmail.com'].penggunaId,
          penyusunDisdikId: u['penyusun.disdik@gmail.com'].penggunaId,
        });

        await this.seedDasarHukumDanRelasi(tx, {
          d,
          p,
        });

        await this.seedSwimlaneDanLangkah(tx, { d, pel });

        await this.seedLampiran(tx, { d });

        await this.seedKolaborasi(tx, {
          d,
          evaluator1Id: u['evaluator1@gmail.com'].penggunaId,
          evaluator2Id: u['evaluator1@gmail.com'].penggunaId,
          penyusunDinkesId: u['penyusun.dinkes@gmail.com'].penggunaId,
          pjPenyusunDinkesId: u['pjpenyusun.dinkes@gmail.com'].penggunaId,
          penyusunDiskominfoId: u['penyusun.disdik@gmail.com'].penggunaId,
        });

        const pe = await this.seedPengajuanDanNilaiEvaluasi(tx, {
          d,
          opdDinkesId: opdDinkes.opdId,
          opdDiskominfoId: opdDisdik.opdId,
          opdDisdikId: opdDisdik.opdId,
          evaluator1Id: u['evaluator1@gmail.com'].penggunaId,
          evaluator2Id: u['evaluator1@gmail.com'].penggunaId,
          pjEvaluatorId: u['pjevaluator@gmail.com'].penggunaId,
          pjPenyusunDinkesId: u['pjpenyusun.dinkes@gmail.com'].penggunaId,
          pjPenyusunDiskominfoId: u['pjpenyusun.disdik@gmail.com'].penggunaId,
          pjPenyusunDisdikId: u['pjpenyusun.disdik@gmail.com'].penggunaId,
        });

        await this.syncSemuaStatusDetailSopPengajuan(tx, pe);

        await this.ensureProsedurUntukSemuaNilaiEvaluasi(tx, pel, {
          opdDinkesId: opdDinkes.opdId,
          opdDiskominfoId: opdDisdik.opdId,
          opdDisdikId: opdDisdik.opdId,
        });

        await this.seedLogNilaiEvaluasi(tx, {
          d,
          pe,
          evaluator1Id: u['evaluator1@gmail.com'].penggunaId,
          evaluator2Id: u['evaluator1@gmail.com'].penggunaId,
        });

        await this.validateSeedEvaluationBusinessRules(tx);

        await this.seedDokumenTte(tx, { d, pe });
      } else {
        // Default: master-only; hapus artifact workflow dummy lama dari seed versi sebelumnya.
        await this.cleanupLegacyWorkflowSeedData(tx);
      }
    });

    this.logger.log(
      [
        'Seed selesai.',
        'Reset dev: pnpm db:fresh (prisma migrate reset + seed).',
        'Cakupan: master data saja: 3 OPD (Biro Organisasi, Dinkes, Disdik),',
        '8 pengguna (1 PJ Evaluator, 1 Evaluator, 2 PJ Penyusun, 2 Penyusun, 2 Kepala OPD),',
        'riwayat OPD aktif, 4 peraturan, relasi OPD-peraturan, dan master pelaksana SOP.',
      ].join(' '),
    );
    this.logger.warn(`Login: SEED_DEFAULT_PASSWORD (${DEFAULT_SEED_PASSWORD}).`);
  }

  // ── MODUL 1: Master & Akses ─────────────────────────────────────────────

  private async ensureOpd(tx: Prisma.TransactionClient, nama: string): Promise<{ opdId: string }> {
    const existing = await tx.oPD.findFirst({
      where: { nama },
      select: { opdId: true },
    });
    if (existing !== null) {
      return existing;
    }
    return tx.oPD.create({
      data: { nama },
      select: { opdId: true },
    });
  }

  private async cleanupLegacyWorkflowSeedData(tx: Prisma.TransactionClient): Promise<void> {
    const seedDetails = await tx.detailSOP.findMany({
      where: { nomorSOP: { in: [...SEED_WORKFLOW_SOP_NUMBERS] } },
      select: { detailSopId: true, sopId: true },
    });
    const seedPengajuan = await tx.pengajuanEvaluasi.findMany({
      where: { nomorBA: { in: [...SEED_WORKFLOW_BA_NUMBERS] } },
      select: { pengajuanEvaluasiId: true },
    });
    const candidateSopIds = [...new Set(seedDetails.map((detail) => detail.sopId))];
    const legacySeedSops =
      candidateSopIds.length > 0
        ? await tx.sOP.findMany({
            where: {
              sopId: { in: candidateSopIds },
              judul: { in: [...SEED_WORKFLOW_SOP_TITLES] },
            },
            select: { sopId: true },
          })
        : [];
    const sopIds = legacySeedSops.map((sop) => sop.sopId);
    const detailsInLegacySeedSops =
      sopIds.length > 0
        ? await tx.detailSOP.findMany({
            where: { sopId: { in: sopIds } },
            select: { detailSopId: true },
          })
        : [];
    const detailSopIds = [
      ...new Set([
        ...seedDetails.map((detail) => detail.detailSopId),
        ...detailsInLegacySeedSops.map((detail) => detail.detailSopId),
      ]),
    ];
    const pengajuanEvaluasiIds = seedPengajuan.map((pengajuan) => pengajuan.pengajuanEvaluasiId);
    const documentWhere: Prisma.DokumenTteWhereInput[] = [
      { nomorDokumen: { in: [...SEED_WORKFLOW_DOCUMENT_NUMBERS] } },
    ];
    if (detailSopIds.length > 0) {
      documentWhere.push({ detailSopId: { in: detailSopIds } });
    }
    if (pengajuanEvaluasiIds.length > 0) {
      documentWhere.push({ pengajuanEvaluasiId: { in: pengajuanEvaluasiIds } });
    }

    const seedDocuments = await tx.dokumenTte.findMany({
      where: { OR: documentWhere },
      select: { dokumenTteId: true },
    });
    const dokumenTteIds = seedDocuments.map((document) => document.dokumenTteId);
    if (dokumenTteIds.length > 0) {
      await tx.riwayatTandaTangan.deleteMany({
        where: { dokumenTteId: { in: dokumenTteIds } },
      });
      await tx.dokumenTte.deleteMany({
        where: { dokumenTteId: { in: dokumenTteIds } },
      });
    }

    if (pengajuanEvaluasiIds.length > 0) {
      await tx.logNilaiEvaluasi.deleteMany({
        where: { pengajuanEvaluasiId: { in: pengajuanEvaluasiIds } },
      });
      await tx.nilaiEvaluasi.deleteMany({
        where: { pengajuanEvaluasiId: { in: pengajuanEvaluasiIds } },
      });
      await tx.pengajuanEvaluasi.deleteMany({
        where: { pengajuanEvaluasiId: { in: pengajuanEvaluasiIds } },
      });
    }

    if (detailSopIds.length > 0) {
      await tx.detailSOP.updateMany({
        where: { revisiDariDetailSopId: { in: detailSopIds } },
        data: { revisiDariDetailSopId: null },
      });

      const langkahSopIds = (
        await tx.langkahSOP.findMany({
          where: { detailSopId: { in: detailSopIds } },
          select: { langkahSopId: true },
        })
      ).map((langkah) => langkah.langkahSopId);

      if (langkahSopIds.length > 0) {
        await tx.langkahSOP.updateMany({
          where: {
            OR: [
              { detailSopId: { in: detailSopIds } },
              { langkahSelanjutnyaYaId: { in: langkahSopIds } },
              { langkahSelanjutnyaTidakId: { in: langkahSopIds } },
            ],
          },
          data: { langkahSelanjutnyaYaId: null, langkahSelanjutnyaTidakId: null },
        });
      }

      await tx.logNilaiEvaluasi.deleteMany({
        where: { detailSopId: { in: detailSopIds } },
      });
      await tx.nilaiEvaluasi.deleteMany({
        where: { detailSopId: { in: detailSopIds } },
      });
      await tx.logEditSOP.deleteMany({
        where: { detailSopId: { in: detailSopIds } },
      });
    }

    if (sopIds.length > 0) {
      await tx.sOP.deleteMany({
        where: {
          sopId: { in: sopIds },
        },
      });
    }
  }

  private async seedUsers(
    tx: Prisma.TransactionClient,
    hashedPassword: string,
    opdIdMap: Record<string, string>,
  ): Promise<Record<string, SeedUserRecord>> {
    const result: Record<string, SeedUserRecord> = {};
    for (const user of SEED_USERS) {
      const opdId = opdIdMap[user.opdKey];
      const persisted = await tx.pengguna.upsert({
        where: { email: user.email },
        create: {
          email: user.email,
          opdId,
          nama: user.nama,
          kataSandi: hashedPassword,
          peran: user.peran,
          nip: user.nip,
          jabatan: user.jabatan,
          pangkat: user.pangkat,
          nohp: user.nohp,
        },
        update: {
          opdId,
          nama: user.nama,
          kataSandi: hashedPassword,
          peran: user.peran,
          nip: user.nip,
          jabatan: user.jabatan,
          pangkat: user.pangkat,
          nohp: user.nohp,
          deletedAt: null,
        },
        select: {
          penggunaId: true,
          opdId: true,
          email: true,
          nama: true,
          peran: true,
          nip: true,
          jabatan: true,
          pangkat: true,
          nohp: true,
        },
      });
      result[user.email] = persisted;
    }
    return result;
  }

  private async seedRiwayatOpd(
    tx: Prisma.TransactionClient,
    users: ReadonlyArray<SeedUserRecord>,
  ): Promise<void> {
    for (const user of users) {
      await tx.riwayatOpdPengguna.upsert({
        where: { penggunaId_opdId: { penggunaId: user.penggunaId, opdId: user.opdId } },
        create: { penggunaId: user.penggunaId, opdId: user.opdId, isAktif: true },
        update: { isAktif: true },
      });
    }
  }

  // ── MODUL 1: Regulasi ──────────────────────────────────────────────────

  private async seedPeraturan(
    tx: Prisma.TransactionClient,
    lastEditedById: string,
  ): Promise<Record<string, { peraturanId: string }>> {
    const result: Record<string, { peraturanId: string }> = {};
    for (const p of SEED_PERATURAN) {
      const persisted = await tx.peraturan.upsert({
        where: { nomor_tahun: { nomor: p.nomor, tahun: p.tahun } },
        create: {
          nama: p.nama,
          nomor: p.nomor,
          tahun: p.tahun,
          tentang: p.tentang,
          lastEditedById,
        },
        update: { nama: p.nama, tentang: p.tentang, lastEditedById },
        select: { peraturanId: true },
      });
      result[p.nomor] = persisted;
    }
    return result;
  }

  private async seedOpdPeraturan(
    tx: Prisma.TransactionClient,
    params: {
      opdDinkesId: string;
      opdDiskominfoId?: string;
      opdDisdikId: string;
      peraturanDaerahId: string;
      pergubTransformasiId: string;
      permenpanId: string;
      pergubLayananId: string;
    },
  ): Promise<void> {
    const pairs: Array<{ opdId: string; peraturanId: string }> = [
      // Dinkes: Perda tata kelola + MenPAN-RB
      { opdId: params.opdDinkesId, peraturanId: params.peraturanDaerahId },
      { opdId: params.opdDinkesId, peraturanId: params.permenpanId },
      // Disdik: Perda tata kelola + Pergub layanan
      { opdId: params.opdDisdikId, peraturanId: params.peraturanDaerahId },
      { opdId: params.opdDisdikId, peraturanId: params.pergubLayananId },
    ];
    if (params.opdDiskominfoId) {
      pairs.push(
        { opdId: params.opdDiskominfoId, peraturanId: params.pergubTransformasiId },
        { opdId: params.opdDiskominfoId, peraturanId: params.pergubLayananId },
      );
    }
    for (const pair of pairs) {
      await tx.oPDPeraturan.upsert({
        where: { opdId_peraturanId: pair },
        create: pair,
        update: {},
      });
    }
  }

  // ── MODUL 2: Authoring SOP ─────────────────────────────────────────────

  private async seedPelaksana(
    tx: Prisma.TransactionClient,
    params: { opdDinkesId: string; opdDiskominfoId?: string; opdDisdikId: string },
  ): Promise<Record<string, { pelaksanaId: string }>> {
    const result: Record<string, { pelaksanaId: string }> = {};
    const entries: Array<{ key: string; opdId: string; nama: string }> = [
      { key: 'FRONT_OFFICE_DINKES', opdId: params.opdDinkesId, nama: 'Front Office Dinkes' },
      { key: 'KASUBAG_DINKES', opdId: params.opdDinkesId, nama: 'Kasubag Pelayanan Dinkes' },
      { key: 'DOKTER_DINKES', opdId: params.opdDinkesId, nama: 'Dokter Pemeriksa' },
      {
        key: 'PETUGAS_IMUNISASI_DINKES',
        opdId: params.opdDinkesId,
        nama: 'Petugas Imunisasi Dinkes',
      },
      { key: 'SURVEILANS_DINKES', opdId: params.opdDinkesId, nama: 'Petugas Surveilans Dinkes' },
      { key: 'TIM_GIZI_DINKES', opdId: params.opdDinkesId, nama: 'Tim Gizi Dinkes' },
      {
        key: 'PETUGAS_RAWAT_INAP_DINKES',
        opdId: params.opdDinkesId,
        nama: 'Petugas Rawat Inap Dinkes',
      },
      { key: 'PETUGAS_FARMASI_DINKES', opdId: params.opdDinkesId, nama: 'Petugas Farmasi Dinkes' },
      { key: 'TIM_PPDB_DISDIK', opdId: params.opdDisdikId, nama: 'Tim Penerimaan PPDB Disdik' },
      {
        key: 'SEKSI_AKREDITASI_DISDIK',
        opdId: params.opdDisdikId,
        nama: 'Seksi Akreditasi Disdik',
      },
      { key: 'TIM_AKREDITASI_DISDIK', opdId: params.opdDisdikId, nama: 'Tim Akreditasi Disdik' },
    ];
    if (params.opdDiskominfoId) {
      entries.push(
        {
          key: 'TIM_LAYANAN_DISKOMINFO',
          opdId: params.opdDiskominfoId,
          nama: 'Tim Layanan Informasi Diskominfo',
        },
        {
          key: 'TIM_MEDIA_DISKOMINFO',
          opdId: params.opdDiskominfoId,
          nama: 'Tim Media Sosial Diskominfo',
        },
        {
          key: 'TIM_ADUAN_DISKOMINFO',
          opdId: params.opdDiskominfoId,
          nama: 'Tim Aduan Masyarakat Diskominfo',
        },
      );
    }
    for (const entry of entries) {
      result[entry.key] = await this.upsertPelaksanaByNama(tx, entry.opdId, entry.nama);
    }
    return result;
  }

  private async upsertPelaksanaByNama(
    tx: Prisma.TransactionClient,
    opdId: string,
    nama: string,
  ): Promise<{ pelaksanaId: string }> {
    const existing = await tx.pelaksana.findFirst({
      where: { opdId, nama },
      select: { pelaksanaId: true },
    });
    if (existing !== null) return existing;
    return tx.pelaksana.create({ data: { opdId, nama }, select: { pelaksanaId: true } });
  }

  /**
   * Membuat SOP & DetailSOP mencakup SEMUA 11 nilai StatusSOP:
   * DRAFT, SEDANG_DISUSUN, MENUNGGU_PENGAJUAN_EVALUASI, DIAJUKAN_EVALUASI,
   * SEDANG_DIEVALUASI, REVISI_DARI_EVALUATOR, MENUNGGU_TTD_PJ_EVALUATOR,
   * DIVERIFIKASI_PJ_EVALUATOR_ORGANISASI, BERLAKU, DIGANTIKAN, DICABUT.
   */
  private async seedSopDanDetail(
    tx: Prisma.TransactionClient,
    params: {
      opdDinkesId: string;
      opdDiskominfoId: string;
      opdDisdikId: string;
      penyusunDinkesId: string;
      penyusunDiskominfoId: string;
      penyusunDisdikId: string;
    },
  ): Promise<Record<string, { detailSopId: string }>> {
    // SOP parents
    const sopSuratSehat = await this.findOrCreateSop(
      tx,
      params.opdDinkesId,
      'Pelayanan Surat Keterangan Sehat',
    );
    const sopImunisasi = await this.findOrCreateSop(tx, params.opdDinkesId, 'Imunisasi Rutin');
    const sopSurveilans = await this.findOrCreateSop(
      tx,
      params.opdDinkesId,
      'Surveilans Epidemiologi',
    );
    const sopGiziBuruk = await this.findOrCreateSop(
      tx,
      params.opdDinkesId,
      'Penanganan Gizi Buruk',
    );
    const sopRawatInap = await this.findOrCreateSop(tx, params.opdDinkesId, 'Pelayanan Rawat Inap');
    const sopFarmasi = await this.findOrCreateSop(
      tx,
      params.opdDinkesId,
      'Manajemen Farmasi Puskesmas',
    );
    const sopInfoPublik = await this.findOrCreateSop(
      tx,
      params.opdDiskominfoId,
      'Permohonan Informasi Publik',
    );
    const sopMediaSosial = await this.findOrCreateSop(
      tx,
      params.opdDiskominfoId,
      'Pengelolaan Media Sosial Pemerintah',
    );
    const sopAduanMasy = await this.findOrCreateSop(
      tx,
      params.opdDiskominfoId,
      'Penanganan Aduan Masyarakat Digital',
    );
    const sopPPDB = await this.findOrCreateSop(
      tx,
      params.opdDisdikId,
      'Penerimaan Peserta Didik Baru (PPDB)',
    );
    const sopAkreditasi = await this.findOrCreateSop(tx, params.opdDisdikId, 'Akreditasi Sekolah');

    const d: Record<string, { detailSopId: string }> = {};

    // ── Dinkes ─────────────────────────────────────────────────────────

    // StatusSOP.BERLAKU — versi aktif yang sah
    d['DINKES_001_V1'] = await this.upsertDetailSop(tx, {
      nomorSOP: 'SOP-DINKES-001-V1',
      sopId: sopSuratSehat.sopId,
      versi: 1,
      status: StatusSOP.BERLAKU,
      namaLembaga: 'Dinas Kesehatan Provinsi',
      dibuatOlehId: params.penyusunDinkesId,
      terakhirDieditOlehId: params.penyusunDinkesId,
      tanggalEfektif: new Date('2024-07-01T00:00:00.000Z'),
    });

    // Versi revisi resmi masih disusun dan belum menjadi anggota pengajuan evaluasi.
    d['DINKES_001_V2'] = await this.upsertDetailSop(tx, {
      nomorSOP: 'SOP-DINKES-001-V2',
      sopId: sopSuratSehat.sopId,
      versi: 2,
      status: StatusSOP.SEDANG_DISUSUN,
      namaLembaga: 'Dinas Kesehatan Provinsi',
      dibuatOlehId: params.penyusunDinkesId,
      terakhirDieditOlehId: params.penyusunDinkesId,
      tanggalRevisi: new Date('2026-02-01T00:00:00.000Z'),
      revisiDariDetailSopId: d['DINKES_001_V1'].detailSopId,
    });

    // StatusSOP.DRAFT — baru dibuat, belum disusun
    d['DINKES_002_V1'] = await this.upsertDetailSop(tx, {
      nomorSOP: 'SOP-DINKES-002-V1',
      sopId: sopImunisasi.sopId,
      versi: 1,
      status: StatusSOP.DRAFT,
      namaLembaga: 'Dinas Kesehatan Provinsi',
      dibuatOlehId: params.penyusunDinkesId,
      terakhirDieditOlehId: params.penyusunDinkesId,
    });

    // StatusSOP.SEDANG_DISUSUN — proses penyusunan aktif
    d['DINKES_003_V1'] = await this.upsertDetailSop(tx, {
      nomorSOP: 'SOP-DINKES-003-V1',
      sopId: sopSurveilans.sopId,
      versi: 1,
      status: StatusSOP.SEDANG_DISUSUN,
      namaLembaga: 'Dinas Kesehatan Provinsi',
      dibuatOlehId: params.penyusunDinkesId,
      terakhirDieditOlehId: params.penyusunDinkesId,
    });

    // StatusSOP.MENUNGGU_PENGAJUAN_EVALUASI — penyusunan selesai, menunggu pengajuan evaluasi
    d['DINKES_004_V1'] = await this.upsertDetailSop(tx, {
      nomorSOP: 'SOP-DINKES-004-V1',
      sopId: sopGiziBuruk.sopId,
      versi: 1,
      status: StatusSOP.MENUNGGU_PENGAJUAN_EVALUASI,
      namaLembaga: 'Dinas Kesehatan Provinsi',
      dibuatOlehId: params.penyusunDinkesId,
      terakhirDieditOlehId: params.penyusunDinkesId,
    });

    // StatusSOP.DIAJUKAN_EVALUASI — sudah diajukan, evaluasi belum dimulai
    d['DINKES_005_V1'] = await this.upsertDetailSop(tx, {
      nomorSOP: 'SOP-DINKES-005-V1',
      sopId: sopRawatInap.sopId,
      versi: 1,
      status: StatusSOP.DIAJUKAN_EVALUASI,
      namaLembaga: 'Dinas Kesehatan Provinsi',
      dibuatOlehId: params.penyusunDinkesId,
      terakhirDieditOlehId: params.penyusunDinkesId,
    });

    // StatusSOP.REVISI_DARI_EVALUATOR — perlu perbaikan dari evaluator
    d['DINKES_006_V1'] = await this.upsertDetailSop(tx, {
      nomorSOP: 'SOP-DINKES-006-V1',
      sopId: sopFarmasi.sopId,
      versi: 1,
      status: StatusSOP.REVISI_DARI_EVALUATOR,
      namaLembaga: 'Dinas Kesehatan Provinsi',
      dibuatOlehId: params.penyusunDinkesId,
      terakhirDieditOlehId: params.penyusunDinkesId,
    });

    // ── Diskominfo ───────────────────────────────────────────────────────

    // StatusSOP.MENUNGGU_PENGAJUAN_EVALUASI (Diskominfo)
    d['DISKOMINFO_001_V1'] = await this.upsertDetailSop(tx, {
      nomorSOP: 'SOP-DISKOMINFO-001-V1',
      sopId: sopInfoPublik.sopId,
      versi: 1,
      status: StatusSOP.MENUNGGU_PENGAJUAN_EVALUASI,
      namaLembaga: 'Dinas Komunikasi dan Informatika',
      dibuatOlehId: params.penyusunDiskominfoId,
      terakhirDieditOlehId: params.penyusunDiskominfoId,
    });

    // StatusSOP.MENUNGGU_TTD_PJ_EVALUATOR — evaluasi selesai, menunggu verifikasi PJ Evaluator
    d['DISKOMINFO_002_V1'] = await this.upsertDetailSop(tx, {
      nomorSOP: 'SOP-DISKOMINFO-002-V1',
      sopId: sopMediaSosial.sopId,
      versi: 1,
      status: StatusSOP.MENUNGGU_TTD_PJ_EVALUATOR,
      namaLembaga: 'Dinas Komunikasi dan Informatika',
      dibuatOlehId: params.penyusunDiskominfoId,
      terakhirDieditOlehId: params.penyusunDiskominfoId,
    });

    // Draft aktif yang belum menjadi anggota pengajuan evaluasi.
    d['DISKOMINFO_003_V1'] = await this.upsertDetailSop(tx, {
      nomorSOP: 'SOP-DISKOMINFO-003-V1',
      sopId: sopAduanMasy.sopId,
      versi: 1,
      status: StatusSOP.SEDANG_DISUSUN,
      namaLembaga: 'Dinas Komunikasi dan Informatika',
      dibuatOlehId: params.penyusunDiskominfoId,
      terakhirDieditOlehId: params.penyusunDiskominfoId,
    });

    // ── Dinas Pendidikan ─────────────────────────────────────────────────

    // StatusSOP.DIGANTIKAN — versi lama yang telah digantikan versi baru
    d['DISDIK_001_V1'] = await this.upsertDetailSop(tx, {
      nomorSOP: 'SOP-DISDIK-001-V1',
      sopId: sopPPDB.sopId,
      versi: 1,
      status: StatusSOP.DIGANTIKAN,
      namaLembaga: 'Dinas Pendidikan Provinsi',
      dibuatOlehId: params.penyusunDisdikId,
      terakhirDieditOlehId: params.penyusunDisdikId,
      tanggalEfektif: new Date('2023-06-01T00:00:00.000Z'),
    });

    // StatusSOP.MENUNGGU_TTD_PJ_EVALUATOR — versi baru menunggu pengesahan Kepala OPD (alur DISDIK_REQUEST_OPD)
    d['DISDIK_001_V2'] = await this.upsertDetailSop(tx, {
      nomorSOP: 'SOP-DISDIK-001-V2',
      sopId: sopPPDB.sopId,
      versi: 2,
      revisiDariDetailSopId: d['DISDIK_001_V1'].detailSopId,
      status: StatusSOP.MENUNGGU_TTD_PJ_EVALUATOR,
      namaLembaga: 'Dinas Pendidikan Provinsi',
      dibuatOlehId: params.penyusunDisdikId,
      terakhirDieditOlehId: params.penyusunDisdikId,
      tanggalEfektif: new Date('2024-06-01T00:00:00.000Z'),
      tanggalRevisi: new Date('2024-05-01T00:00:00.000Z'),
    });

    // StatusSOP.DICABUT — SOP yang sudah dicabut/tidak berlaku lagi
    d['DISDIK_002_V1'] = await this.upsertDetailSop(tx, {
      nomorSOP: 'SOP-DISDIK-002-V1',
      sopId: sopAkreditasi.sopId,
      versi: 1,
      status: StatusSOP.DICABUT,
      namaLembaga: 'Dinas Pendidikan Provinsi',
      dibuatOlehId: params.penyusunDisdikId,
      terakhirDieditOlehId: params.penyusunDisdikId,
      tanggalEfektif: new Date('2022-01-01T00:00:00.000Z'),
    });

    return d;
  }

  private async upsertDetailSop(
    tx: Prisma.TransactionClient,
    data: {
      nomorSOP: string;
      sopId: string;
      versi: number;
      status: StatusSOP;
      namaLembaga: string;
      dibuatOlehId: string;
      terakhirDieditOlehId: string;
      tanggalEfektif?: Date;
      tanggalRevisi?: Date;
      revisiDariDetailSopId?: string | null;
    },
  ): Promise<{ detailSopId: string }> {
    return tx.detailSOP.upsert({
      where: { nomorSOP: data.nomorSOP },
      create: data,
      update: {
        status: data.status,
        namaLembaga: data.namaLembaga,
        terakhirDieditOlehId: data.terakhirDieditOlehId,
        tanggalEfektif: data.tanggalEfektif,
        tanggalRevisi: data.tanggalRevisi,
        revisiDariDetailSopId: data.revisiDariDetailSopId ?? null,
      },
      select: { detailSopId: true },
    });
  }

  private async findOrCreateSop(
    tx: Prisma.TransactionClient,
    opdId: string,
    judul: string,
  ): Promise<{ sopId: string }> {
    const existing = await tx.sOP.findFirst({
      where: { opdId, judul },
      select: { sopId: true },
    });
    if (existing !== null) return existing;
    return tx.sOP.create({ data: { opdId, judul }, select: { sopId: true } });
  }

  private async seedDasarHukumDanRelasi(
    tx: Prisma.TransactionClient,
    params: {
      d: Record<string, { detailSopId: string }>;
      p: Record<string, { peraturanId: string }>;
    },
  ): Promise<void> {
    const { d, p } = params;
    const dasarHukumPairs: Array<{ detailSopId: string; peraturanId: string }> = [
      { detailSopId: d['DINKES_001_V1'].detailSopId, peraturanId: p['12 Tahun 2024'].peraturanId },
      { detailSopId: d['DINKES_001_V1'].detailSopId, peraturanId: p['35 Tahun 2012'].peraturanId },
      { detailSopId: d['DINKES_001_V2'].detailSopId, peraturanId: p['12 Tahun 2024'].peraturanId },
      { detailSopId: d['DINKES_001_V2'].detailSopId, peraturanId: p['35 Tahun 2012'].peraturanId },
      { detailSopId: d['DINKES_002_V1'].detailSopId, peraturanId: p['12 Tahun 2024'].peraturanId },
      { detailSopId: d['DINKES_002_V1'].detailSopId, peraturanId: p['35 Tahun 2012'].peraturanId },
      { detailSopId: d['DINKES_003_V1'].detailSopId, peraturanId: p['12 Tahun 2024'].peraturanId },
      { detailSopId: d['DINKES_003_V1'].detailSopId, peraturanId: p['35 Tahun 2012'].peraturanId },
      { detailSopId: d['DINKES_004_V1'].detailSopId, peraturanId: p['35 Tahun 2012'].peraturanId },
      { detailSopId: d['DINKES_004_V1'].detailSopId, peraturanId: p['15 Tahun 2022'].peraturanId },
      { detailSopId: d['DINKES_005_V1'].detailSopId, peraturanId: p['12 Tahun 2024'].peraturanId },
      { detailSopId: d['DINKES_005_V1'].detailSopId, peraturanId: p['15 Tahun 2022'].peraturanId },
      { detailSopId: d['DINKES_006_V1'].detailSopId, peraturanId: p['35 Tahun 2012'].peraturanId },
      { detailSopId: d['DINKES_006_V1'].detailSopId, peraturanId: p['15 Tahun 2022'].peraturanId },
      {
        detailSopId: d['DISKOMINFO_001_V1'].detailSopId,
        peraturanId: p['7 Tahun 2023'].peraturanId,
      },
      {
        detailSopId: d['DISKOMINFO_001_V1'].detailSopId,
        peraturanId: p['15 Tahun 2022'].peraturanId,
      },
      {
        detailSopId: d['DISKOMINFO_002_V1'].detailSopId,
        peraturanId: p['7 Tahun 2023'].peraturanId,
      },
      {
        detailSopId: d['DISKOMINFO_002_V1'].detailSopId,
        peraturanId: p['15 Tahun 2022'].peraturanId,
      },
      {
        detailSopId: d['DISKOMINFO_003_V1'].detailSopId,
        peraturanId: p['7 Tahun 2023'].peraturanId,
      },
      {
        detailSopId: d['DISKOMINFO_003_V1'].detailSopId,
        peraturanId: p['15 Tahun 2022'].peraturanId,
      },
      { detailSopId: d['DISDIK_001_V1'].detailSopId, peraturanId: p['12 Tahun 2024'].peraturanId },
      { detailSopId: d['DISDIK_001_V1'].detailSopId, peraturanId: p['15 Tahun 2022'].peraturanId },
      { detailSopId: d['DISDIK_001_V2'].detailSopId, peraturanId: p['12 Tahun 2024'].peraturanId },
      { detailSopId: d['DISDIK_001_V2'].detailSopId, peraturanId: p['15 Tahun 2022'].peraturanId },
      { detailSopId: d['DISDIK_002_V1'].detailSopId, peraturanId: p['12 Tahun 2024'].peraturanId },
      { detailSopId: d['DISDIK_002_V1'].detailSopId, peraturanId: p['35 Tahun 2012'].peraturanId },
    ];

    for (const pair of dasarHukumPairs) {
      await tx.dasarHukum.upsert({
        where: { detailSopId_peraturanId: pair },
        create: pair,
        update: {},
      });
    }

    // SopTerkait — relasi antar DetailSOP (satu arah; tidak boleh self-loop atau pasangan terbalik `(B,A)` bila `(A,B)` ada — trigger `trg_sop_terkait_*`)
    const relasiPairs: Array<{ detailSopId: string; detailSopTerkaitId: string }> = [
      {
        detailSopId: d['DINKES_001_V1'].detailSopId,
        detailSopTerkaitId: d['DISKOMINFO_001_V1'].detailSopId,
      },
      {
        detailSopId: d['DINKES_001_V1'].detailSopId,
        detailSopTerkaitId: d['DISDIK_001_V2'].detailSopId,
      },
      {
        detailSopId: d['DISDIK_001_V1'].detailSopId,
        detailSopTerkaitId: d['DISDIK_001_V2'].detailSopId,
      },
    ];

    for (const pair of relasiPairs) {
      await tx.sopTerkait.upsert({
        where: { detailSopId_detailSopTerkaitId: pair },
        create: pair,
        update: {},
      });
    }
  }

  /**
   * Swimlane & LangkahSOP — mencakup:
   * - Semua JenisLangkahProsedur: AWAL_AKHIR (start & end), KEGIATAN, KEPUTUSAN
   * - Semua SatuanWaktu: m, h, d, w, mo, y
   * - Percabangan langkah (Ya/Tidak) pada KEPUTUSAN
   * `Pelaksana` harus `opdId` sama dengan SOP pemilik DetailSOP (trigger `trg_detailsoppelaksana_*` / `trg_langkahsop_*`).
   */
  private async seedSwimlaneDanLangkah(
    tx: Prisma.TransactionClient,
    params: {
      d: Record<string, { detailSopId: string }>;
      pel: Record<string, { pelaksanaId: string }>;
    },
  ): Promise<void> {
    const { d, pel } = params;

    // ── Swimlane: SOP-DINKES-001-V1 ───────────────────────────────────
    await this.upsertSwimlane(
      tx,
      d['DINKES_001_V1'].detailSopId,
      pel['FRONT_OFFICE_DINKES'].pelaksanaId,
      1,
    );
    await this.upsertSwimlane(
      tx,
      d['DINKES_001_V1'].detailSopId,
      pel['KASUBAG_DINKES'].pelaksanaId,
      2,
    );
    await this.upsertSwimlane(
      tx,
      d['DINKES_001_V1'].detailSopId,
      pel['DOKTER_DINKES'].pelaksanaId,
      3,
    );

    // ── LangkahSOP: SOP-DINKES-001-V1 (alur AWAL→KEGIATAN→KEPUTUSAN→AWAL) ──
    const dinkesV1Id = d['DINKES_001_V1'].detailSopId;
    const lD1Start = await this.upsertLangkah(tx, {
      detailSopId: dinkesV1Id,
      kegiatan: 'Mulai: Pemohon datang ke loket pelayanan.',
      jenis: JenisLangkahProsedur.AWAL_AKHIR,
      urutan: 1,
      kelengkapan: '-',
      keluaran: 'Pemohon terdaftar',
      waktu: 15,
      satuanWaktu: SatuanWaktu.m, // m = menit
      keterangan: 'Titik awal alur pelayanan surat keterangan sehat.',
      pelaksanaId: pel['FRONT_OFFICE_DINKES'].pelaksanaId,
    });
    const lD1TerimaData = await this.upsertLangkah(tx, {
      detailSopId: dinkesV1Id,
      kegiatan: 'Menerima dan mencatat berkas permohonan.',
      jenis: JenisLangkahProsedur.KEGIATAN,
      urutan: 2,
      kelengkapan: 'Formulir permohonan, KTP, surat pengantar',
      keluaran: 'Berkas tercatat di sistem',
      waktu: 30,
      satuanWaktu: SatuanWaktu.m, // m = menit
      keterangan: 'Petugas front office melakukan input data ke sistem.',
      pelaksanaId: pel['FRONT_OFFICE_DINKES'].pelaksanaId,
    });
    const lD1Verifikasi = await this.upsertLangkah(tx, {
      detailSopId: dinkesV1Id,
      kegiatan: 'Apakah berkas pemohon lengkap dan valid?',
      jenis: JenisLangkahProsedur.KEPUTUSAN,
      urutan: 3,
      kelengkapan: 'Checklist kelengkapan dokumen',
      keluaran: 'Status berkas: lengkap / tidak lengkap',
      waktu: 2,
      satuanWaktu: SatuanWaktu.h, // h = jam
      keterangan: 'Kasubag memverifikasi dokumen secara administratif.',
      pelaksanaId: pel['KASUBAG_DINKES'].pelaksanaId,
    });
    const lD1Pemeriksaan = await this.upsertLangkah(tx, {
      detailSopId: dinkesV1Id,
      kegiatan: 'Melakukan pemeriksaan medis terhadap pemohon.',
      jenis: JenisLangkahProsedur.KEGIATAN,
      urutan: 4,
      kelengkapan: 'Berkas lengkap tervalidasi',
      keluaran: 'Hasil pemeriksaan medis',
      waktu: 1,
      satuanWaktu: SatuanWaktu.d, // d = hari
      keterangan: 'Dokter melakukan pemeriksaan fisik dan mencatat hasil.',
      pelaksanaId: pel['DOKTER_DINKES'].pelaksanaId,
    });
    const lD1Terbit = await this.upsertLangkah(tx, {
      detailSopId: dinkesV1Id,
      kegiatan: 'Selesai: Menerbitkan surat keterangan sehat kepada pemohon.',
      jenis: JenisLangkahProsedur.AWAL_AKHIR,
      urutan: 5,
      kelengkapan: 'Hasil pemeriksaan dan cap dinas',
      keluaran: 'Surat keterangan sehat resmi',
      waktu: 1,
      satuanWaktu: SatuanWaktu.d, // d = hari
      keterangan: 'Titik akhir: surat diserahkan kepada pemohon.',
      pelaksanaId: pel['KASUBAG_DINKES'].pelaksanaId,
    });

    // Hubungkan alur: Start → TerimaData → Verifikasi (Ya→Pemeriksaan, Tidak→TerimaData) → Pemeriksaan → Terbit
    await tx.langkahSOP.update({
      where: { langkahSopId: lD1Start.langkahSopId },
      data: { langkahSelanjutnyaYaId: lD1TerimaData.langkahSopId },
    });
    await tx.langkahSOP.update({
      where: { langkahSopId: lD1TerimaData.langkahSopId },
      data: { langkahSelanjutnyaYaId: lD1Verifikasi.langkahSopId },
    });
    await tx.langkahSOP.update({
      where: { langkahSopId: lD1Verifikasi.langkahSopId },
      data: {
        langkahSelanjutnyaYaId: lD1Pemeriksaan.langkahSopId, // berkas lengkap
        langkahSelanjutnyaTidakId: lD1TerimaData.langkahSopId, // berkas tidak lengkap → kembali
      },
    });
    await tx.langkahSOP.update({
      where: { langkahSopId: lD1Pemeriksaan.langkahSopId },
      data: { langkahSelanjutnyaYaId: lD1Terbit.langkahSopId },
    });

    // ── Swimlane & LangkahSOP: SOP-DINKES-002-V1 (Imunisasi Rutin) ─────
    const imunisasiDetailId = d['DINKES_002_V1'].detailSopId;
    await this.upsertSwimlane(
      tx,
      imunisasiDetailId,
      pel['PETUGAS_IMUNISASI_DINKES'].pelaksanaId,
      1,
    );
    await this.upsertSwimlane(tx, imunisasiDetailId, pel['KASUBAG_DINKES'].pelaksanaId, 2);
    await this.upsertSwimlane(tx, imunisasiDetailId, pel['FRONT_OFFICE_DINKES'].pelaksanaId, 3);
    await this.upsertSwimlane(tx, imunisasiDetailId, pel['DOKTER_DINKES'].pelaksanaId, 4);

    const lImStart = await this.upsertLangkah(tx, {
      detailSopId: imunisasiDetailId,
      kegiatan: 'Mulai: Menerima kebutuhan imunisasi rutin.',
      jenis: JenisLangkahProsedur.AWAL_AKHIR,
      urutan: 1,
      kelengkapan: 'Jadwal imunisasi, data sasaran, dan vaksin',
      keluaran: 'Agenda imunisasi tercatat',
      waktu: 30,
      satuanWaktu: SatuanWaktu.m,
      keterangan: 'Petugas imunisasi menerima permintaan dan menyiapkan jadwal pelayanan.',
      pelaksanaId: pel['PETUGAS_IMUNISASI_DINKES'].pelaksanaId,
    });
    const lImDaftar = await this.upsertLangkah(tx, {
      detailSopId: imunisasiDetailId,
      kegiatan: 'Mendaftarkan sasaran imunisasi di loket pelayanan.',
      jenis: JenisLangkahProsedur.KEGIATAN,
      urutan: 2,
      kelengkapan: 'Kartu imunisasi, identitas sasaran, dan formulir pendaftaran',
      keluaran: 'Sasaran terdaftar di sistem',
      waktu: 20,
      satuanWaktu: SatuanWaktu.m,
      keterangan: 'Front office mencatat data sasaran dan jadwal kedatangan.',
      pelaksanaId: pel['FRONT_OFFICE_DINKES'].pelaksanaId,
    });
    const lImVerifikasi = await this.upsertLangkah(tx, {
      detailSopId: imunisasiDetailId,
      kegiatan: 'Apakah kelengkapan berkas imunisasi rutin sudah valid?',
      jenis: JenisLangkahProsedur.KEPUTUSAN,
      urutan: 3,
      kelengkapan: 'Checklist kelengkapan dokumen imunisasi',
      keluaran: 'Status berkas: lengkap / tidak lengkap',
      waktu: 1,
      satuanWaktu: SatuanWaktu.h,
      keterangan: 'Kasubag memverifikasi kelengkapan administrasi dan kesiapan vaksin.',
      pelaksanaId: pel['KASUBAG_DINKES'].pelaksanaId,
    });
    const lImPemeriksaan = await this.upsertLangkah(tx, {
      detailSopId: imunisasiDetailId,
      kegiatan: 'Melakukan skrining medis pra-imunisasi.',
      jenis: JenisLangkahProsedur.KEGIATAN,
      urutan: 4,
      kelengkapan: 'Berkas lengkap tervalidasi',
      keluaran: 'Hasil skrining medis',
      waktu: 30,
      satuanWaktu: SatuanWaktu.m,
      keterangan: 'Dokter menilai kelayakan sasaran sebelum vaksinasi.',
      pelaksanaId: pel['DOKTER_DINKES'].pelaksanaId,
    });
    const lImPelaksanaan = await this.upsertLangkah(tx, {
      detailSopId: imunisasiDetailId,
      kegiatan: 'Melaksanakan imunisasi rutin sesuai protokol.',
      jenis: JenisLangkahProsedur.KEGIATAN,
      urutan: 5,
      kelengkapan: 'Vaksin, APD, dan kartu imunisasi',
      keluaran: 'Vaksinasi selesai dilakukan',
      waktu: 15,
      satuanWaktu: SatuanWaktu.m,
      keterangan: 'Petugas imunisasi memberikan vaksin dan mencatat reaksi awal.',
      pelaksanaId: pel['PETUGAS_IMUNISASI_DINKES'].pelaksanaId,
    });
    const lImSelesai = await this.upsertLangkah(tx, {
      detailSopId: imunisasiDetailId,
      kegiatan: 'Selesai: Mendokumentasikan hasil imunisasi rutin.',
      jenis: JenisLangkahProsedur.AWAL_AKHIR,
      urutan: 6,
      kelengkapan: 'Register imunisasi dan laporan cakupan',
      keluaran: 'Layanan imunisasi tercatat',
      waktu: 1,
      satuanWaktu: SatuanWaktu.d,
      keterangan: 'Kasubag mengarsipkan hasil dan melaporkan cakupan imunisasi.',
      pelaksanaId: pel['KASUBAG_DINKES'].pelaksanaId,
    });

    await tx.langkahSOP.update({
      where: { langkahSopId: lImStart.langkahSopId },
      data: { langkahSelanjutnyaYaId: lImDaftar.langkahSopId },
    });
    await tx.langkahSOP.update({
      where: { langkahSopId: lImDaftar.langkahSopId },
      data: { langkahSelanjutnyaYaId: lImVerifikasi.langkahSopId },
    });
    await tx.langkahSOP.update({
      where: { langkahSopId: lImVerifikasi.langkahSopId },
      data: {
        langkahSelanjutnyaYaId: lImPemeriksaan.langkahSopId,
        langkahSelanjutnyaTidakId: lImDaftar.langkahSopId,
      },
    });
    await tx.langkahSOP.update({
      where: { langkahSopId: lImPemeriksaan.langkahSopId },
      data: { langkahSelanjutnyaYaId: lImPelaksanaan.langkahSopId },
    });
    await tx.langkahSOP.update({
      where: { langkahSopId: lImPelaksanaan.langkahSopId },
      data: { langkahSelanjutnyaYaId: lImSelesai.langkahSopId },
    });

    // ── Swimlane & LangkahSOP: SOP-DISKOMINFO-001-V1 ──────────────────
    await this.upsertSwimlane(
      tx,
      d['DISKOMINFO_001_V1'].detailSopId,
      pel['TIM_LAYANAN_DISKOMINFO'].pelaksanaId,
      1,
    );

    const diskoV1Id = d['DISKOMINFO_001_V1'].detailSopId;
    const lDsk1Start = await this.upsertLangkah(tx, {
      detailSopId: diskoV1Id,
      kegiatan: 'Mulai: Menerima permohonan informasi dari pemohon.',
      jenis: JenisLangkahProsedur.AWAL_AKHIR,
      urutan: 1,
      kelengkapan: 'Formulir permohonan informasi',
      keluaran: 'Permohonan terdaftar',
      waktu: 30,
      satuanWaktu: SatuanWaktu.m, // m = menit
      keterangan: 'Mulai alur permohonan informasi publik.',
      pelaksanaId: pel['TIM_LAYANAN_DISKOMINFO'].pelaksanaId,
    });
    const lDsk1Telusuri = await this.upsertLangkah(tx, {
      detailSopId: diskoV1Id,
      kegiatan: 'Menelusuri dan mengumpulkan data informasi yang diminta.',
      jenis: JenisLangkahProsedur.KEGIATAN,
      urutan: 2,
      kelengkapan: 'Identitas permohonan',
      keluaran: 'Draft informasi yang akan diberikan',
      waktu: 2,
      satuanWaktu: SatuanWaktu.h, // h = jam
      keterangan: 'Tim mencari data di sistem arsip digital.',
      pelaksanaId: pel['TIM_LAYANAN_DISKOMINFO'].pelaksanaId,
    });
    const lDsk1Kategori = await this.upsertLangkah(tx, {
      detailSopId: diskoV1Id,
      kegiatan: 'Apakah informasi termasuk dalam kategori dikecualikan?',
      jenis: JenisLangkahProsedur.KEPUTUSAN,
      urutan: 3,
      kelengkapan: 'Daftar informasi dikecualikan',
      keluaran: 'Keputusan: informasi publik / dikecualikan',
      waktu: 3,
      satuanWaktu: SatuanWaktu.d, // d = hari
      keterangan: 'Mengacu pada UU Keterbukaan Informasi Publik.',
      pelaksanaId: pel['TIM_LAYANAN_DISKOMINFO'].pelaksanaId,
    });
    const lDsk1Serahkan = await this.upsertLangkah(tx, {
      detailSopId: diskoV1Id,
      kegiatan: 'Selesai: Menyerahkan informasi kepada pemohon.',
      jenis: JenisLangkahProsedur.AWAL_AKHIR,
      urutan: 4,
      kelengkapan: 'Informasi terverifikasi',
      keluaran: 'Informasi publik diterima pemohon',
      waktu: 1,
      satuanWaktu: SatuanWaktu.w, // w = minggu (SLA penyerahan maksimal 1 minggu)
      keterangan: 'Informasi diserahkan sesuai SLA keterbukaan informasi.',
      pelaksanaId: pel['TIM_LAYANAN_DISKOMINFO'].pelaksanaId,
    });
    const lDsk1Tolak = await this.upsertLangkah(tx, {
      detailSopId: diskoV1Id,
      kegiatan: 'Menyampaikan surat penolakan pemberian informasi.',
      jenis: JenisLangkahProsedur.KEGIATAN,
      urutan: 5,
      kelengkapan: 'Surat penolakan bermaterai',
      keluaran: 'Surat penolakan diterima pemohon',
      waktu: 1,
      satuanWaktu: SatuanWaktu.mo, // mo = bulan (proses keberatan)
      keterangan: 'Pemohon berhak mengajukan keberatan dalam 30 hari.',
      pelaksanaId: pel['TIM_LAYANAN_DISKOMINFO'].pelaksanaId,
    });

    await tx.langkahSOP.update({
      where: { langkahSopId: lDsk1Start.langkahSopId },
      data: { langkahSelanjutnyaYaId: lDsk1Telusuri.langkahSopId },
    });
    await tx.langkahSOP.update({
      where: { langkahSopId: lDsk1Telusuri.langkahSopId },
      data: { langkahSelanjutnyaYaId: lDsk1Kategori.langkahSopId },
    });
    await tx.langkahSOP.update({
      where: { langkahSopId: lDsk1Kategori.langkahSopId },
      data: {
        langkahSelanjutnyaYaId: lDsk1Tolak.langkahSopId, // dikecualikan → tolak
        langkahSelanjutnyaTidakId: lDsk1Serahkan.langkahSopId, // tidak dikecualikan → serahkan
      },
    });

    // ── Swimlane & LangkahSOP: SOP-DISDIK-001-V2 (dengan SatuanWaktu w, mo, y) ──
    await this.upsertSwimlane(
      tx,
      d['DISDIK_001_V2'].detailSopId,
      pel['TIM_PPDB_DISDIK'].pelaksanaId,
      1,
    );

    const disdikV2Id = d['DISDIK_001_V2'].detailSopId;
    const lDdk2Start = await this.upsertLangkah(tx, {
      detailSopId: disdikV2Id,
      kegiatan: 'Mulai: Membuka masa pendaftaran PPDB secara online.',
      jenis: JenisLangkahProsedur.AWAL_AKHIR,
      urutan: 1,
      kelengkapan: 'Pengumuman resmi PPDB',
      keluaran: 'Sistem pendaftaran aktif',
      waktu: 2,
      satuanWaktu: SatuanWaktu.w, // w = minggu
      keterangan: 'Masa pendaftaran dibuka selama 2 minggu.',
      pelaksanaId: pel['TIM_PPDB_DISDIK'].pelaksanaId,
    });
    const lDdk2Verifikasi = await this.upsertLangkah(tx, {
      detailSopId: disdikV2Id,
      kegiatan: 'Memverifikasi berkas dan dokumen pendaftar.',
      jenis: JenisLangkahProsedur.KEGIATAN,
      urutan: 2,
      kelengkapan: 'Akta kelahiran, rapor, KK',
      keluaran: 'Daftar pendaftar terverifikasi',
      waktu: 1,
      satuanWaktu: SatuanWaktu.mo, // mo = bulan
      keterangan: 'Verifikasi dilakukan selama 1 bulan setelah penutupan pendaftaran.',
      pelaksanaId: pel['TIM_PPDB_DISDIK'].pelaksanaId,
    });
    const lDdk2Keputusan = await this.upsertLangkah(tx, {
      detailSopId: disdikV2Id,
      kegiatan: 'Apakah pendaftar memenuhi syarat penerimaan?',
      jenis: JenisLangkahProsedur.KEPUTUSAN,
      urutan: 3,
      kelengkapan: 'Hasil verifikasi berkas',
      keluaran: 'Keputusan diterima / tidak diterima',
      waktu: 3,
      satuanWaktu: SatuanWaktu.d, // d = hari
      keterangan: 'Berdasarkan nilai dan zonasi sesuai peraturan.',
      pelaksanaId: pel['TIM_PPDB_DISDIK'].pelaksanaId,
    });
    const lDdk2Pengumuman = await this.upsertLangkah(tx, {
      detailSopId: disdikV2Id,
      kegiatan: 'Selesai: Mengumumkan hasil PPDB dan melakukan daftar ulang.',
      jenis: JenisLangkahProsedur.AWAL_AKHIR,
      urutan: 4,
      kelengkapan: 'Daftar siswa diterima',
      keluaran: 'Siswa baru terdaftar resmi',
      waktu: 1,
      satuanWaktu: SatuanWaktu.y, // y = tahun (siklus tahunan PPDB)
      keterangan: 'Proses PPDB berlangsung satu kali per tahun ajaran.',
      pelaksanaId: pel['TIM_PPDB_DISDIK'].pelaksanaId,
    });

    await tx.langkahSOP.update({
      where: { langkahSopId: lDdk2Start.langkahSopId },
      data: { langkahSelanjutnyaYaId: lDdk2Verifikasi.langkahSopId },
    });
    await tx.langkahSOP.update({
      where: { langkahSopId: lDdk2Verifikasi.langkahSopId },
      data: { langkahSelanjutnyaYaId: lDdk2Keputusan.langkahSopId },
    });
    await tx.langkahSOP.update({
      where: { langkahSopId: lDdk2Keputusan.langkahSopId },
      data: {
        langkahSelanjutnyaYaId: lDdk2Pengumuman.langkahSopId, // diterima
        langkahSelanjutnyaTidakId: lDdk2Verifikasi.langkahSopId, // tidak diterima → kembali verifikasi
      },
    });

    // ── Swimlane: SOP Dinkes versi lain ───────────────────────────────
    await this.upsertSwimlane(
      tx,
      d['DINKES_001_V2'].detailSopId,
      pel['FRONT_OFFICE_DINKES'].pelaksanaId,
      1,
    );
    await this.upsertSwimlane(
      tx,
      d['DINKES_001_V2'].detailSopId,
      pel['KASUBAG_DINKES'].pelaksanaId,
      2,
    );
    await this.upsertSwimlane(
      tx,
      d['DISKOMINFO_002_V1'].detailSopId,
      pel['TIM_MEDIA_DISKOMINFO'].pelaksanaId,
      1,
    );
    await this.upsertSwimlane(
      tx,
      d['DISDIK_001_V1'].detailSopId,
      pel['TIM_PPDB_DISDIK'].pelaksanaId,
      1,
    );

    const prosedurRingkas: ReadonlyArray<{
      detailKey: string;
      pelaksanaId: string;
      topik: string;
      dokumen: string;
      keluaran: string;
    }> = [
      {
        detailKey: 'DINKES_001_V2',
        pelaksanaId: pel['FRONT_OFFICE_DINKES'].pelaksanaId,
        topik: 'revisi pelayanan surat keterangan sehat',
        dokumen: 'Draft revisi SOP dan formulir layanan',
        keluaran: 'Draft revisi tervalidasi',
      },
      {
        detailKey: 'DINKES_003_V1',
        pelaksanaId: pel['SURVEILANS_DINKES'].pelaksanaId,
        topik: 'surveilans epidemiologi',
        dokumen: 'Laporan kasus dan formulir penyelidikan epidemiologi',
        keluaran: 'Laporan surveilans tervalidasi',
      },
      {
        detailKey: 'DINKES_004_V1',
        pelaksanaId: pel['TIM_GIZI_DINKES'].pelaksanaId,
        topik: 'penanganan gizi buruk',
        dokumen: 'Data balita, hasil antropometri, dan rencana intervensi',
        keluaran: 'Rencana tindak lanjut gizi',
      },
      {
        detailKey: 'DINKES_005_V1',
        pelaksanaId: pel['PETUGAS_RAWAT_INAP_DINKES'].pelaksanaId,
        topik: 'pelayanan rawat inap',
        dokumen: 'Rekam medis, surat rawat inap, dan lembar persetujuan',
        keluaran: 'Pasien mendapat layanan rawat inap',
      },
      {
        detailKey: 'DINKES_006_V1',
        pelaksanaId: pel['PETUGAS_FARMASI_DINKES'].pelaksanaId,
        topik: 'manajemen farmasi puskesmas',
        dokumen: 'Kartu stok, permintaan obat, dan bukti distribusi',
        keluaran: 'Distribusi obat terdokumentasi',
      },
      {
        detailKey: 'DISKOMINFO_002_V1',
        pelaksanaId: pel['TIM_MEDIA_DISKOMINFO'].pelaksanaId,
        topik: 'pengelolaan media sosial pemerintah',
        dokumen: 'Kalender konten, naskah publikasi, dan aset visual',
        keluaran: 'Konten terpublikasi dan terarsip',
      },
      {
        detailKey: 'DISKOMINFO_003_V1',
        pelaksanaId: pel['TIM_ADUAN_DISKOMINFO'].pelaksanaId,
        topik: 'penanganan aduan masyarakat digital',
        dokumen: 'Tiket aduan, identitas pelapor, dan bukti pendukung',
        keluaran: 'Aduan ditindaklanjuti',
      },
      {
        detailKey: 'DISDIK_001_V1',
        pelaksanaId: pel['TIM_PPDB_DISDIK'].pelaksanaId,
        topik: 'PPDB versi lama',
        dokumen: 'Pengumuman PPDB, data pendaftar, dan dokumen zonasi',
        keluaran: 'Arsip PPDB versi lama lengkap',
      },
      {
        detailKey: 'DISDIK_002_V1',
        pelaksanaId: pel['TIM_AKREDITASI_DISDIK'].pelaksanaId,
        topik: 'akreditasi sekolah',
        dokumen: 'Instrumen akreditasi dan dokumen pendukung sekolah',
        keluaran: 'Rekapitulasi akreditasi sekolah',
      },
    ];

    for (const item of prosedurRingkas) {
      await this.seedProsedurRingkas(tx, {
        detailSopId: d[item.detailKey].detailSopId,
        pelaksanaId: item.pelaksanaId,
        topik: item.topik,
        dokumen: item.dokumen,
        keluaran: item.keluaran,
      });
    }
  }

  private async seedProsedurRingkas(
    tx: Prisma.TransactionClient,
    data: {
      detailSopId: string;
      pelaksanaId: string;
      topik: string;
      dokumen: string;
      keluaran: string;
    },
  ): Promise<void> {
    await this.upsertSwimlane(tx, data.detailSopId, data.pelaksanaId, 1);
    const mulai = await this.upsertLangkah(tx, {
      detailSopId: data.detailSopId,
      kegiatan: `Mulai: Menerima kebutuhan ${data.topik}.`,
      jenis: JenisLangkahProsedur.AWAL_AKHIR,
      urutan: 1,
      kelengkapan: data.dokumen,
      keluaran: 'Permohonan atau agenda kerja tercatat',
      waktu: 30,
      satuanWaktu: SatuanWaktu.m,
      keterangan: `Titik awal prosedur ${data.topik}.`,
      pelaksanaId: data.pelaksanaId,
    });
    const proses = await this.upsertLangkah(tx, {
      detailSopId: data.detailSopId,
      kegiatan: `Memproses dan memverifikasi kelengkapan ${data.topik}.`,
      jenis: JenisLangkahProsedur.KEGIATAN,
      urutan: 2,
      kelengkapan: data.dokumen,
      keluaran: data.keluaran,
      waktu: 2,
      satuanWaktu: SatuanWaktu.h,
      keterangan: 'Petugas memeriksa kelengkapan, kesesuaian data, dan bukti pendukung.',
      pelaksanaId: data.pelaksanaId,
    });
    const selesai = await this.upsertLangkah(tx, {
      detailSopId: data.detailSopId,
      kegiatan: `Selesai: Mendokumentasikan hasil ${data.topik}.`,
      jenis: JenisLangkahProsedur.AWAL_AKHIR,
      urutan: 3,
      kelengkapan: data.keluaran,
      keluaran: 'Dokumen hasil tersimpan dan siap ditindaklanjuti',
      waktu: 1,
      satuanWaktu: SatuanWaktu.d,
      keterangan: `Titik akhir prosedur ${data.topik}.`,
      pelaksanaId: data.pelaksanaId,
    });

    await tx.langkahSOP.update({
      where: { langkahSopId: mulai.langkahSopId },
      data: { langkahSelanjutnyaYaId: proses.langkahSopId, langkahSelanjutnyaTidakId: null },
    });
    await tx.langkahSOP.update({
      where: { langkahSopId: proses.langkahSopId },
      data: { langkahSelanjutnyaYaId: selesai.langkahSopId, langkahSelanjutnyaTidakId: null },
    });
    await tx.langkahSOP.update({
      where: { langkahSopId: selesai.langkahSopId },
      data: { langkahSelanjutnyaYaId: null, langkahSelanjutnyaTidakId: null },
    });
  }

  private async upsertSwimlane(
    tx: Prisma.TransactionClient,
    detailSopId: string,
    pelaksanaId: string,
    urutan: number,
  ): Promise<void> {
    await tx.detailSOPPelaksana.upsert({
      where: { detailSopId_pelaksanaId: { detailSopId, pelaksanaId } },
      create: { detailSopId, pelaksanaId, urutan },
      update: { urutan },
    });
  }

  private async upsertLangkah(
    tx: Prisma.TransactionClient,
    data: {
      detailSopId: string;
      kegiatan: string;
      jenis: JenisLangkahProsedur;
      urutan: number;
      kelengkapan: string;
      keluaran: string;
      waktu: number;
      satuanWaktu: SatuanWaktu;
      keterangan: string;
      pelaksanaId: string;
    },
  ): Promise<{ langkahSopId: string }> {
    return tx.langkahSOP.upsert({
      where: { detailSopId_urutan: { detailSopId: data.detailSopId, urutan: data.urutan } },
      create: data,
      update: {
        kegiatan: data.kegiatan,
        jenis: data.jenis,
        kelengkapan: data.kelengkapan,
        keluaran: data.keluaran,
        waktu: data.waktu,
        satuanWaktu: data.satuanWaktu,
        keterangan: data.keterangan,
        pelaksanaId: data.pelaksanaId,
      },
      select: { langkahSopId: true },
    });
  }

  /** Lampiran 4 tipe untuk semua DetailSOP agar halaman detail tidak kosong. */
  private async seedLampiran(
    tx: Prisma.TransactionClient,
    params: { d: Record<string, { detailSopId: string }> },
  ): Promise<void> {
    const { d } = params;
    const targetIds = Object.values(d).map((row) => row.detailSopId);
    const lampiranRows: ReadonlyArray<{
      detailKey: string;
      peringatan: string;
      kualifikasi: readonly string[];
      peralatan: readonly string[];
      pencatatan: readonly string[];
    }> = [
      {
        detailKey: 'DINKES_001_V1',
        peringatan: 'Pemohon wajib membawa dokumen asli saat verifikasi lapangan.',
        kualifikasi: [
          'Petugas memiliki sertifikasi pelayanan kesehatan dasar.',
          'Dokter memiliki SIP aktif dari Dinas Kesehatan.',
        ],
        peralatan: [
          'Komputer, printer, scanner, formulir pemeriksaan standar.',
          'Alat pemeriksaan medis (tensi, termometer, stetoskop).',
        ],
        pencatatan: ['Data dicatat di register layanan harian dan arsip bulanan Dinkes.'],
      },
      {
        detailKey: 'DINKES_001_V2',
        peringatan: 'Surat keterangan hanya berlaku 30 hari sejak diterbitkan.',
        kualifikasi: ['Petugas memahami revisi alur layanan surat keterangan sehat.'],
        peralatan: ['Aplikasi registrasi layanan, printer, scanner, dan alat pemeriksaan dasar.'],
        pencatatan: ['Perubahan versi dicatat dalam log revisi SOP dan register layanan.'],
      },
      {
        detailKey: 'DINKES_002_V1',
        peringatan: 'Vaksin harus disimpan sesuai rantai dingin sebelum digunakan.',
        kualifikasi: ['Petugas telah mengikuti pelatihan imunisasi dan pengelolaan vaksin.'],
        peralatan: ['Cold box, vaccine carrier, termometer suhu, kartu imunisasi, dan APD.'],
        pencatatan: ['Cakupan imunisasi dicatat pada register kohort dan aplikasi pelaporan.'],
      },
      {
        detailKey: 'DINKES_003_V1',
        peringatan: 'Laporan kasus prioritas wajib ditindaklanjuti maksimal 24 jam.',
        kualifikasi: ['Petugas mampu melakukan penyelidikan epidemiologi dan analisis tren kasus.'],
        peralatan: [
          'Formulir PE, perangkat komunikasi, dashboard surveilans, dan kendaraan operasional.',
        ],
        pencatatan: ['Data kasus dicatat pada sistem surveilans dan dilaporkan berjenjang.'],
      },
      {
        detailKey: 'DINKES_004_V1',
        peringatan:
          'Kasus gizi buruk dengan komplikasi harus segera dirujuk ke fasilitas kesehatan.',
        kualifikasi: ['Tim gizi memahami tata laksana gizi buruk dan konseling keluarga.'],
        peralatan: ['Timbangan, length board, pita LILA, formulir pemantauan, dan PMT.'],
        pencatatan: [
          'Intervensi dan perkembangan anak dicatat pada register gizi dan laporan bulanan.',
        ],
      },
      {
        detailKey: 'DINKES_005_V1',
        peringatan:
          'Pasien hanya dapat dirawat setelah asesmen awal dan persetujuan tindakan selesai.',
        kualifikasi: [
          'Petugas rawat inap memahami triase, keselamatan pasien, dan pencatatan rekam medis.',
        ],
        peralatan: [
          'Tempat tidur pasien, rekam medis, gelang identitas, dan alat monitoring vital.',
        ],
        pencatatan: ['Status pasien dicatat dalam rekam medis dan buku register rawat inap.'],
      },
      {
        detailKey: 'DINKES_006_V1',
        peringatan: 'Obat kedaluwarsa atau rusak tidak boleh didistribusikan.',
        kualifikasi: [
          'Petugas farmasi memahami manajemen stok, FIFO/FEFO, dan pencatatan distribusi obat.',
        ],
        peralatan: ['Kartu stok, rak obat, sistem inventori, dan formulir serah terima.'],
        pencatatan: ['Mutasi obat dicatat pada kartu stok dan laporan farmasi puskesmas.'],
      },
      {
        detailKey: 'DISKOMINFO_001_V1',
        peringatan: 'Informasi dikecualikan mengikuti ketentuan keterbukaan informasi publik.',
        kualifikasi: ['Tim layanan memiliki sertifikasi pengelolaan informasi publik.'],
        peralatan: ['Dashboard ticketing, email layanan publik, arsip digital.'],
        pencatatan: ['Seluruh permohonan dicatat di SIPD dan sistem informasi publik.'],
      },
      {
        detailKey: 'DISKOMINFO_002_V1',
        peringatan: 'Konten yang dipublikasikan wajib melalui pemeriksaan substansi dan bahasa.',
        kualifikasi: [
          'Tim media memahami komunikasi publik, editorial konten, dan moderasi kanal digital.',
        ],
        peralatan: [
          'Kalender konten, akun media sosial resmi, aplikasi desain, dan arsip aset digital.',
        ],
        pencatatan: ['Publikasi dan metrik kanal dicatat dalam rekapitulasi media sosial bulanan.'],
      },
      {
        detailKey: 'DISKOMINFO_003_V1',
        peringatan: 'Aduan yang memuat data pribadi harus diproses dengan pembatasan akses.',
        kualifikasi: ['Tim aduan memahami klasifikasi aduan, eskalasi, dan etika layanan digital.'],
        peralatan: ['Dashboard aduan, kanal pengaduan resmi, template jawaban, dan arsip tiket.'],
        pencatatan: ['Status aduan dan tindak lanjut dicatat pada sistem ticketing.'],
      },
      {
        detailKey: 'DISDIK_001_V1',
        peringatan:
          'Versi lama hanya digunakan sebagai arsip pembanding dan tidak menjadi acuan layanan baru.',
        kualifikasi: ['Panitia memahami riwayat kebijakan PPDB dan dokumen zonasi tahun terkait.'],
        peralatan: ['Arsip PPDB, rekap pendaftar, dokumen zonasi, dan berita acara seleksi.'],
        pencatatan: ['Arsip PPDB versi lama disimpan dalam repositori dokumen Disdik.'],
      },
      {
        detailKey: 'DISDIK_001_V2',
        peringatan: 'Berkas yang tidak lengkap dalam 3 hari dinyatakan gugur seleksi.',
        kualifikasi: [
          'Panitia PPDB telah mendapat pelatihan sistem PPDB Online.',
          'Petugas verifikasi memahami regulasi zonasi terkini.',
        ],
        peralatan: ['Aplikasi PPDB Online, scanner berkas, komputer panitia.'],
        pencatatan: [
          'Data pendaftar tersimpan di sistem PPDB Online provinsi.',
          'Laporan rekapitulasi dikirim ke Kemendikbud setiap semester.',
        ],
      },
      {
        detailKey: 'DISDIK_002_V1',
        peringatan: 'SOP dicabut sehingga hanya dipakai untuk kebutuhan riwayat dan audit.',
        kualifikasi: [
          'Tim akreditasi memahami instrumen akreditasi dan tata kelola arsip sekolah.',
        ],
        peralatan: ['Instrumen akreditasi, dokumen sekolah, lembar verifikasi, dan arsip digital.'],
        pencatatan: ['Hasil akreditasi dicatat dalam rekap sekolah dan arsip evaluasi Disdik.'],
      },
    ];

    // Hapus dulu agar seed idempoten
    await tx.lampiranPeringatan.deleteMany({ where: { detailSopId: { in: targetIds } } });
    await tx.lampiranKualifikasiPelaksanaan.deleteMany({
      where: { detailSopId: { in: targetIds } },
    });
    await tx.lampiranPeralatanPerlengkapan.deleteMany({
      where: { detailSopId: { in: targetIds } },
    });
    await tx.lampiranPencatatanPendataan.deleteMany({ where: { detailSopId: { in: targetIds } } });

    await tx.lampiranPeringatan.createMany({
      data: lampiranRows.map((row) => ({
        detailSopId: d[row.detailKey].detailSopId,
        teks: row.peringatan,
      })),
    });

    await tx.lampiranKualifikasiPelaksanaan.createMany({
      data: lampiranRows.flatMap((row) =>
        row.kualifikasi.map((teks) => ({
          detailSopId: d[row.detailKey].detailSopId,
          teks,
        })),
      ),
    });

    await tx.lampiranPeralatanPerlengkapan.createMany({
      data: lampiranRows.flatMap((row) =>
        row.peralatan.map((teks) => ({
          detailSopId: d[row.detailKey].detailSopId,
          teks,
        })),
      ),
    });

    await tx.lampiranPencatatanPendataan.createMany({
      data: lampiranRows.flatMap((row) =>
        row.pencatatan.map((teks) => ({
          detailSopId: d[row.detailKey].detailSopId,
          teks,
        })),
      ),
    });
  }

  // ── MODUL 3: Kolaborasi ─────────────────────────────────────────────────

  /**
   * LogEditSOP — mencakup semua BagianSOP: HEADER, LANGKAH, STATUS, UMPAN_BALIK, EVALUASI
   */
  private async seedKolaborasi(
    tx: Prisma.TransactionClient,
    params: {
      d: Record<string, { detailSopId: string }>;
      evaluator1Id: string;
      evaluator2Id: string;
      penyusunDinkesId: string;
      pjPenyusunDinkesId: string;
      penyusunDiskominfoId: string;
    },
  ): Promise<void> {
    const { d, evaluator1Id, penyusunDinkesId, pjPenyusunDinkesId, penyusunDiskominfoId } = params;
    const targetIds = [
      d['DINKES_001_V1'].detailSopId,
      d['DINKES_001_V2'].detailSopId,
      d['DISKOMINFO_001_V1'].detailSopId,
    ];

    // Idempoten: hapus dulu
    await tx.logEditSOP.deleteMany({ where: { detailSopId: { in: targetIds } } });

    const seedLogs: ReadonlyArray<{
      readonly createdAt: Date;
      readonly detailSopId: string;
      readonly penggunaId: string;
      readonly bagian: BagianSOP;
      readonly keterangan?: string | null;
      readonly sesiChangeCount: number;
      readonly closedAt: Date | null;
      readonly fields: readonly string[];
    }> = [
      {
        createdAt: new Date('2024-06-15T08:00:00.000Z'),
        detailSopId: d['DINKES_001_V1'].detailSopId,
        penggunaId: penyusunDinkesId,
        bagian: BagianSOP.HEADER,
        keterangan: 'Memperbarui nama lembaga dan tanggal efektif pada header SOP.',
        sesiChangeCount: 2,
        closedAt: new Date('2024-06-15T08:00:00.000Z'),
        fields: ['namaLembaga', 'tanggalEfektif'],
      },
      {
        createdAt: new Date('2024-06-20T09:00:00.000Z'),
        detailSopId: d['DINKES_001_V1'].detailSopId,
        penggunaId: penyusunDinkesId,
        bagian: BagianSOP.LANGKAH,
        keterangan: 'Menambahkan langkah pemeriksaan medis oleh dokter (langkah 4).',
        sesiChangeCount: 3,
        closedAt: new Date('2024-06-20T09:00:00.000Z'),
        fields: ['kegiatan', 'waktu', 'satuanWaktu'],
      },
      {
        createdAt: new Date('2024-07-01T10:00:00.000Z'),
        detailSopId: d['DINKES_001_V1'].detailSopId,
        penggunaId: pjPenyusunDinkesId,
        bagian: BagianSOP.STATUS,
        keterangan:
          'Status SOP diubah dari MENUNGGU_PENGAJUAN_EVALUASI menjadi BERLAKU setelah pengesahan.',
        sesiChangeCount: 1,
        closedAt: new Date('2024-07-01T10:00:00.000Z'),
        fields: ['status'],
      },
      {
        createdAt: new Date('2026-03-01T09:30:00.000Z'),
        detailSopId: d['DINKES_001_V1'].detailSopId,
        penggunaId: evaluator1Id,
        bagian: BagianSOP.UMPAN_BALIK,
        keterangan: 'Menambahkan komentar terkait SLA pada langkah keputusan.',
        sesiChangeCount: 1,
        closedAt: new Date('2026-03-01T09:30:00.000Z'),
        fields: ['isi'],
      },
      {
        createdAt: new Date('2026-03-01T10:00:00.000Z'),
        detailSopId: d['DINKES_001_V1'].detailSopId,
        penggunaId: evaluator1Id,
        bagian: BagianSOP.EVALUASI,
        keterangan: 'Menambahkan catatan hasil evaluasi awal: dokumen lengkap.',
        sesiChangeCount: 2,
        closedAt: new Date('2026-03-01T10:00:00.000Z'),
        fields: ['catatan', 'hasil'],
      },
      {
        createdAt: new Date('2026-04-10T14:00:00.000Z'),
        detailSopId: d['DISKOMINFO_001_V1'].detailSopId,
        penggunaId: penyusunDiskominfoId,
        bagian: BagianSOP.LANGKAH,
        keterangan: 'Menambahkan langkah penolakan informasi (langkah 5) sesuai masukan evaluator.',
        sesiChangeCount: 2,
        closedAt: new Date('2026-04-10T14:00:00.000Z'),
        fields: ['kegiatan', 'keterangan'],
      },
      {
        createdAt: new Date('2026-05-01T11:00:00.000Z'),
        detailSopId: d['DINKES_001_V2'].detailSopId,
        penggunaId: penyusunDinkesId,
        bagian: BagianSOP.HEADER,
        keterangan: null,
        sesiChangeCount: 1,
        closedAt: null,
        fields: ['tanggalRevisi'],
      },
    ];

    for (const L of seedLogs) {
      await tx.logEditSOP.create({
        data: {
          detailSopId: L.detailSopId,
          penggunaId: L.penggunaId,
          createdAt: L.createdAt,
          bagian: L.bagian,
          keterangan: L.keterangan ?? null,
          sesiChangeCount: L.sesiChangeCount,
          closedAt: L.closedAt,
          domainFields: {
            create: [...L.fields].map((domainField) => ({ domainField })),
          },
        },
      });
    }
  }

  // ── MODUL 5: Evaluasi ──────────────────────────────────────────────────

  /**
   * PengajuanEvaluasi & NilaiEvaluasi — mencakup status alur:
   * SEDANG_DIEVALUASI, SELESAI_DIEVALUASI, DITANDATANGANI_PJ_EVALUATOR,
   * DITANDATANGANI_PJ_PENYUSUN, SELESAI.
   */
  private async seedPengajuanDanNilaiEvaluasi(
    tx: Prisma.TransactionClient,
    params: {
      d: Record<string, { detailSopId: string }>;
      opdDinkesId: string;
      opdDiskominfoId: string;
      opdDisdikId: string;
      evaluator1Id: string;
      evaluator2Id: string;
      pjEvaluatorId: string;
      pjPenyusunDinkesId: string;
      pjPenyusunDiskominfoId: string;
      pjPenyusunDisdikId: string;
    },
  ): Promise<Record<string, { pengajuanEvaluasiId: string }>> {
    const { d } = params;
    const pe: Record<string, { pengajuanEvaluasiId: string }> = {};

    // 1. SEDANG_DIEVALUASI — EVALUASI_REQUEST_OPD, nilai belum diisi (null)
    pe['DINKES_REQUEST_OPD'] = await this.findOrCreatePengajuan(tx, 'BA-DINKES-2026-002', {
      opdId: params.opdDinkesId,
      jenis: JenisPengajuanEvaluasi.EVALUASI_REQUEST_OPD,
      status: StatusPengajuanEvaluasi.SEDANG_DIEVALUASI,
      tanggalPermintaan: new Date('2026-04-15T00:00:00.000Z'),
      tanggalEvaluasi: new Date('2026-04-15T00:00:00.000Z'),
      nilaiOPD: null,
      diverifikasiOlehUserId: null,
      ditandatanganiOlehPjPenyusunUserId: null,
      tanggalTTDBaPjPenyusun: null,
      diselesaikanOlehId: null,
      tanggalDiselesaikan: null,
    });

    // 2. SEDANG_DIEVALUASI — evaluasi sedang berlangsung
    pe['DISKOMINFO_REQUEST_OPD'] = await this.findOrCreatePengajuan(tx, 'BA-DISKOMINFO-2026-001', {
      opdId: params.opdDiskominfoId,
      jenis: JenisPengajuanEvaluasi.EVALUASI_REQUEST_OPD,
      status: StatusPengajuanEvaluasi.SEDANG_DIEVALUASI,
      tanggalPermintaan: new Date('2026-04-01T00:00:00.000Z'),
      tanggalEvaluasi: new Date('2026-04-04T00:00:00.000Z'),
      nilaiOPD: null,
      diverifikasiOlehUserId: null,
      ditandatanganiOlehPjPenyusunUserId: null,
      tanggalTTDBaPjPenyusun: null,
      diselesaikanOlehId: params.evaluator2Id,
      tanggalDiselesaikan: null,
    });

    // 3. SELESAI_DIEVALUASI — evaluasi selesai, menunggu verifikasi PJ Evaluator
    pe['DISDIK_REQUEST_EVALUATOR'] = await this.findOrCreatePengajuan(tx, 'BA-DISDIK-2026-001', {
      opdId: params.opdDisdikId,
      jenis: JenisPengajuanEvaluasi.EVALUASI_REQUEST_EVALUATOR,
      status: StatusPengajuanEvaluasi.SELESAI_DIEVALUASI,
      tanggalPermintaan: new Date('2026-01-10T00:00:00.000Z'),
      tanggalEvaluasi: new Date('2026-01-15T00:00:00.000Z'),
      nilaiOPD: 4,
      diverifikasiOlehUserId: null,
      ditandatanganiOlehPjPenyusunUserId: null,
      tanggalTTDBaPjPenyusun: null,
      diselesaikanOlehId: params.evaluator2Id,
      tanggalDiselesaikan: new Date('2026-01-20T00:00:00.000Z'),
    });

    // 4. SELESAI - riwayat pengajuan Diskominfo yang sudah selesai penuh
    pe['DISKOMINFO_REQUEST_EVALUATOR'] = await this.findOrCreatePengajuan(
      tx,
      'BA-DISKOMINFO-2026-002',
      {
        opdId: params.opdDiskominfoId,
        jenis: JenisPengajuanEvaluasi.EVALUASI_REQUEST_EVALUATOR,
        status: StatusPengajuanEvaluasi.SELESAI,
        tanggalPermintaan: new Date('2026-02-01T00:00:00.000Z'),
        tanggalEvaluasi: new Date('2026-02-05T00:00:00.000Z'),
        nilaiOPD: 4,
        diverifikasiOlehUserId: params.pjEvaluatorId,
        ditandatanganiOlehPjPenyusunUserId: params.pjPenyusunDiskominfoId,
        tanggalTTDBaPjPenyusun: new Date('2026-02-12T00:00:00.000Z'),
        diselesaikanOlehId: params.evaluator1Id,
        tanggalDiselesaikan: new Date('2026-02-10T00:00:00.000Z'),
      },
    );

    // 5. DITANDATANGANI_PJ_PENYUSUN - Dinkes menunggu pengesahan Kepala OPD
    pe['DINKES_REQUEST_EVALUATOR'] = await this.findOrCreatePengajuan(tx, 'BA-DINKES-2026-001', {
      opdId: params.opdDinkesId,
      jenis: JenisPengajuanEvaluasi.EVALUASI_REQUEST_EVALUATOR,
      status: StatusPengajuanEvaluasi.DITANDATANGANI_PJ_PENYUSUN,
      tanggalPermintaan: new Date('2026-03-01T00:00:00.000Z'),
      tanggalEvaluasi: new Date('2026-03-05T00:00:00.000Z'),
      nilaiOPD: 5,
      diverifikasiOlehUserId: params.pjEvaluatorId,
      ditandatanganiOlehPjPenyusunUserId: params.pjPenyusunDinkesId,
      tanggalTTDBaPjPenyusun: new Date('2026-03-10T00:00:00.000Z'),
      diselesaikanOlehId: params.evaluator1Id,
      tanggalDiselesaikan: new Date('2026-03-08T00:00:00.000Z'),
    });

    // 6. SELESAI - riwayat revisi PPDB versi baru yang sudah berlaku
    pe['DISDIK_REQUEST_OPD'] = await this.findOrCreatePengajuan(tx, 'BA-DISDIK-2026-002', {
      opdId: params.opdDisdikId,
      jenis: JenisPengajuanEvaluasi.EVALUASI_REQUEST_OPD,
      status: StatusPengajuanEvaluasi.SELESAI,
      tanggalPermintaan: new Date('2023-10-01T00:00:00.000Z'),
      tanggalEvaluasi: new Date('2023-10-15T00:00:00.000Z'),
      nilaiOPD: null,
      diverifikasiOlehUserId: params.pjEvaluatorId,
      ditandatanganiOlehPjPenyusunUserId: params.pjPenyusunDisdikId,
      tanggalTTDBaPjPenyusun: new Date('2023-10-25T00:00:00.000Z'),
      diselesaikanOlehId: params.evaluator1Id,
      tanggalDiselesaikan: new Date('2023-10-22T00:00:00.000Z'),
    });

    // ── NilaiEvaluasi (mencakup null, SESUAI, PERLU_PERBAIKAN) ─────────────

    // Pengajuan SEDANG_DIEVALUASI (Dinkes EVALUASI_REQUEST_OPD): SOP revisi dengan umpan balik TERBUKA
    await this.upsertNilai(tx, {
      pengajuanEvaluasiId: pe['DINKES_REQUEST_OPD'].pengajuanEvaluasiId,
      detailSopId: d['DINKES_006_V1'].detailSopId,
      hasil: HasilEvaluasi.PERLU_PERBAIKAN,
      catatan:
        'Lengkapi prosedur distribusi obat dengan SLA dan bukti serah terima yang dapat diaudit.',
      dinilaiOlehId: params.evaluator1Id,
      statusTindakLanjut: StatusTindakLanjut.TERBUKA,
    });

    // Pengajuan SEDANG_DIEVALUASI: sebagian terisi
    await this.upsertNilai(tx, {
      pengajuanEvaluasiId: pe['DISKOMINFO_REQUEST_OPD'].pengajuanEvaluasiId,
      detailSopId: d['DISKOMINFO_001_V1'].detailSopId,
      hasil: null,
      catatan: null,
      dinilaiOlehId: null,
    });

    // Pengajuan SELESAI_DIEVALUASI: akreditasi (SOP terpisah dari batch PPDB selesai)
    await this.upsertNilai(tx, {
      pengajuanEvaluasiId: pe['DISDIK_REQUEST_EVALUATOR'].pengajuanEvaluasiId,
      detailSopId: d['DISDIK_002_V1'].detailSopId,
      hasil: HasilEvaluasi.SESUAI,
      catatan: 'Dokumen PPDB lengkap dan sesuai regulasi zonasi terkini.',
      dinilaiOlehId: params.evaluator2Id,
    });

    // Pengajuan selesai penuh Diskominfo
    await this.upsertNilai(tx, {
      pengajuanEvaluasiId: pe['DISKOMINFO_REQUEST_EVALUATOR'].pengajuanEvaluasiId,
      detailSopId: d['DISKOMINFO_002_V1'].detailSopId,
      hasil: HasilEvaluasi.SESUAI,
      catatan: 'SOP Pengelolaan Media Sosial sesuai panduan KPI Humas Pemerintah.',
      dinilaiOlehId: params.evaluator1Id,
    });

    // Pengajuan Dinkes menunggu pengesahan Kepala OPD — dua SOP berbeda (bukan V1+V2 satu induk SOP)
    await this.upsertNilai(tx, {
      pengajuanEvaluasiId: pe['DINKES_REQUEST_EVALUATOR'].pengajuanEvaluasiId,
      detailSopId: d['DINKES_004_V1'].detailSopId,
      hasil: HasilEvaluasi.SESUAI,
      catatan: 'SOP penanganan gizi buruk sesuai standar pelayanan.',
      dinilaiOlehId: params.evaluator1Id,
    });
    await this.upsertNilai(tx, {
      pengajuanEvaluasiId: pe['DINKES_REQUEST_EVALUATOR'].pengajuanEvaluasiId,
      detailSopId: d['DINKES_005_V1'].detailSopId,
      hasil: HasilEvaluasi.SESUAI,
      catatan: 'SOP rawat inap lengkap dan dapat diimplementasikan.',
      dinilaiOlehId: params.evaluator1Id,
    });

    // Pengajuan SELESAI (Disdik V2 SESUAI - versi baru sudah berlaku)
    await this.upsertNilai(tx, {
      pengajuanEvaluasiId: pe['DISDIK_REQUEST_OPD'].pengajuanEvaluasiId,
      detailSopId: d['DISDIK_001_V2'].detailSopId,
      hasil: HasilEvaluasi.SESUAI,
      catatan: 'SOP PPDB versi baru sesuai regulasi zonasi terkini. Layak berlaku.',
      dinilaiOlehId: params.evaluator1Id,
    });

    const peTambahan = await this.seedPengajuanEvaluasiTambahan(tx, {
      d,
      params,
    });
    return { ...pe, ...peTambahan };
  }

  /** 8 pengajuan sintetis agar daftar evaluator/PJ evaluator > 10 baris (pagination). */
  private async seedPengajuanEvaluasiTambahan(
    tx: Prisma.TransactionClient,
    input: {
      d: Record<string, { detailSopId: string }>;
      params: {
        opdDinkesId: string;
        opdDiskominfoId: string;
        opdDisdikId: string;
        evaluator1Id: string;
        evaluator2Id: string;
        pjEvaluatorId: string;
        pjPenyusunDinkesId: string;
        pjPenyusunDiskominfoId: string;
        pjPenyusunDisdikId: string;
      };
    },
  ): Promise<Record<string, { pengajuanEvaluasiId: string }>> {
    const { d, params } = input;
    const pe: Record<string, { pengajuanEvaluasiId: string }> = {};
    type OpdKey = 'dinkes' | 'diskominfo' | 'disdik';
    const opdByKey: Record<OpdKey, string> = {
      dinkes: params.opdDinkesId,
      diskominfo: params.opdDiskominfoId,
      disdik: params.opdDisdikId,
    };
    const pjPenyusunByKey: Record<OpdKey, string> = {
      dinkes: params.pjPenyusunDinkesId,
      diskominfo: params.pjPenyusunDiskominfoId,
      disdik: params.pjPenyusunDisdikId,
    };
    const baris: ReadonlyArray<{
      key: string;
      nomorBA: string;
      opdKey: OpdKey;
      jenis: JenisPengajuanEvaluasi;
      status: StatusPengajuanEvaluasi;
      detailKey: string;
      hasil: HasilEvaluasi | null;
      nilaiOPD: number | null;
      evaluatorId: string | null;
    }> = [
      {
        key: 'SYNTH_01',
        nomorBA: 'BA-SYNTH-2026-001',
        opdKey: 'dinkes',
        jenis: JenisPengajuanEvaluasi.EVALUASI_REQUEST_OPD,
        status: StatusPengajuanEvaluasi.SELESAI,
        detailKey: 'DINKES_001_V1',
        hasil: HasilEvaluasi.SESUAI,
        nilaiOPD: null,
        evaluatorId: params.evaluator1Id,
      },
      {
        key: 'SYNTH_02',
        nomorBA: 'BA-SYNTH-2026-002',
        opdKey: 'dinkes',
        jenis: JenisPengajuanEvaluasi.EVALUASI_REQUEST_OPD,
        status: StatusPengajuanEvaluasi.SELESAI,
        detailKey: 'DINKES_004_V1',
        hasil: HasilEvaluasi.SESUAI,
        nilaiOPD: null,
        evaluatorId: params.evaluator1Id,
      },
      {
        key: 'SYNTH_03',
        nomorBA: 'BA-SYNTH-2026-003',
        opdKey: 'dinkes',
        jenis: JenisPengajuanEvaluasi.EVALUASI_REQUEST_EVALUATOR,
        status: StatusPengajuanEvaluasi.SELESAI,
        detailKey: 'DINKES_005_V1',
        hasil: HasilEvaluasi.SESUAI,
        nilaiOPD: 4,
        evaluatorId: params.evaluator1Id,
      },
      {
        key: 'SYNTH_04',
        nomorBA: 'BA-SYNTH-2026-004',
        opdKey: 'dinkes',
        jenis: JenisPengajuanEvaluasi.EVALUASI_REQUEST_OPD,
        status: StatusPengajuanEvaluasi.SELESAI,
        detailKey: 'DINKES_001_V1',
        hasil: HasilEvaluasi.SESUAI,
        nilaiOPD: null,
        evaluatorId: params.evaluator2Id,
      },
      {
        key: 'SYNTH_05',
        nomorBA: 'BA-SYNTH-2026-005',
        opdKey: 'diskominfo',
        jenis: JenisPengajuanEvaluasi.EVALUASI_REQUEST_EVALUATOR,
        status: StatusPengajuanEvaluasi.SELESAI,
        detailKey: 'DISKOMINFO_002_V1',
        hasil: HasilEvaluasi.SESUAI,
        nilaiOPD: 5,
        evaluatorId: params.evaluator2Id,
      },
      {
        key: 'SYNTH_06',
        nomorBA: 'BA-SYNTH-2026-006',
        opdKey: 'disdik',
        jenis: JenisPengajuanEvaluasi.EVALUASI_REQUEST_OPD,
        status: StatusPengajuanEvaluasi.SELESAI,
        detailKey: 'DISDIK_001_V2',
        hasil: HasilEvaluasi.SESUAI,
        nilaiOPD: null,
        evaluatorId: params.evaluator1Id,
      },
      {
        key: 'SYNTH_07',
        nomorBA: 'BA-SYNTH-2026-007',
        opdKey: 'dinkes',
        jenis: JenisPengajuanEvaluasi.EVALUASI_REQUEST_EVALUATOR,
        status: StatusPengajuanEvaluasi.SELESAI,
        detailKey: 'DINKES_004_V1',
        hasil: HasilEvaluasi.SESUAI,
        nilaiOPD: 4,
        evaluatorId: params.evaluator1Id,
      },
      {
        key: 'SYNTH_08',
        nomorBA: 'BA-SYNTH-2026-008',
        opdKey: 'diskominfo',
        jenis: JenisPengajuanEvaluasi.EVALUASI_REQUEST_EVALUATOR,
        status: StatusPengajuanEvaluasi.SELESAI,
        detailKey: 'DISKOMINFO_002_V1',
        hasil: HasilEvaluasi.SESUAI,
        nilaiOPD: 5,
        evaluatorId: params.evaluator2Id,
      },
    ];
    let offsetHari = 0;
    for (const row of baris) {
      offsetHari += 3;
      const tanggal = new Date(`2026-05-${String(1 + offsetHari).padStart(2, '0')}T00:00:00.000Z`);
      const selesai =
        row.status !== StatusPengajuanEvaluasi.SEDANG_DIEVALUASI
          ? new Date(tanggal.getTime() + 5 * 24 * 60 * 60 * 1000)
          : null;
      pe[row.key] = await this.findOrCreatePengajuan(tx, row.nomorBA, {
        opdId: opdByKey[row.opdKey],
        jenis: row.jenis,
        status: row.status,
        tanggalPermintaan: tanggal,
        tanggalEvaluasi: tanggal,
        nilaiOPD: row.nilaiOPD,
        diverifikasiOlehUserId:
          row.status === StatusPengajuanEvaluasi.SEDANG_DIEVALUASI ? null : params.pjEvaluatorId,
        ditandatanganiOlehPjPenyusunUserId:
          row.status === StatusPengajuanEvaluasi.SELESAI ? pjPenyusunByKey[row.opdKey] : null,
        tanggalTTDBaPjPenyusun:
          row.status === StatusPengajuanEvaluasi.SELESAI
            ? new Date(tanggal.getTime() + 7 * 24 * 60 * 60 * 1000)
            : null,
        diselesaikanOlehId: row.evaluatorId,
        tanggalDiselesaikan: selesai,
      });
      await tx.nilaiEvaluasi.deleteMany({
        where: {
          pengajuanEvaluasiId: pe[row.key].pengajuanEvaluasiId,
          detailSopId: { not: d[row.detailKey].detailSopId },
        },
      });
      await this.upsertNilai(tx, {
        pengajuanEvaluasiId: pe[row.key].pengajuanEvaluasiId,
        detailSopId: d[row.detailKey].detailSopId,
        hasil: row.hasil,
        catatan: row.hasil === HasilEvaluasi.SESUAI ? 'Sesuai (seed sintetis).' : null,
        dinilaiOlehId: row.evaluatorId,
      });
    }
    return pe;
  }

  /** Selaraskan status semua DetailSOP anggota batch dengan status pengajuan. */
  private async syncSemuaStatusDetailSopPengajuan(
    tx: Prisma.TransactionClient,
    pe: Record<string, { pengajuanEvaluasiId: string }>,
  ): Promise<void> {
    for (const { pengajuanEvaluasiId } of Object.values(pe)) {
      const pengajuan = await tx.pengajuanEvaluasi.findUnique({
        where: { pengajuanEvaluasiId },
        select: { status: true },
      });
      if (pengajuan === null) {
        continue;
      }
      await this.syncStatusDetailSopDalamPengajuan(tx, pengajuanEvaluasiId, pengajuan.status);
    }
  }

  private async syncStatusDetailSopDalamPengajuan(
    tx: Prisma.TransactionClient,
    pengajuanEvaluasiId: string,
    statusPengajuan: StatusPengajuanEvaluasi,
  ): Promise<void> {
    const statusSop = mapStatusSopUntukPengajuan(statusPengajuan);
    const nilai = await tx.nilaiEvaluasi.findMany({
      where: { pengajuanEvaluasiId },
      select: { detailSopId: true, hasil: true, statusTindakLanjut: true },
    });
    if (nilai.length === 0) {
      return;
    }
    for (const n of nilai) {
      const statusDetail =
        statusPengajuan === StatusPengajuanEvaluasi.SEDANG_DIEVALUASI &&
        n.hasil === HasilEvaluasi.PERLU_PERBAIKAN &&
        n.statusTindakLanjut === StatusTindakLanjut.TERBUKA
          ? StatusSOP.REVISI_DARI_EVALUATOR
          : statusSop;
      await tx.detailSOP.update({
        where: { detailSopId: n.detailSopId },
        data: { status: statusDetail },
      });
    }
  }

  /** Pastikan setiap DetailSOP yang masuk evaluasi punya ≥2 pelaksana dan ≥3 langkah. */
  private async ensureProsedurUntukSemuaNilaiEvaluasi(
    tx: Prisma.TransactionClient,
    pel: Record<string, { pelaksanaId: string }>,
    opdIds: { opdDinkesId: string; opdDiskominfoId: string; opdDisdikId: string },
  ): Promise<void> {
    const barisNilai = await tx.nilaiEvaluasi.groupBy({
      by: ['detailSopId'],
    });
    for (const baris of barisNilai) {
      const detail = await tx.detailSOP.findUniqueOrThrow({
        where: { detailSopId: baris.detailSopId },
        select: { sop: { select: { opdId: true } } },
      });
      const opdId = detail.sop.opdId;
      const [pelaksanaUtamaId, pelaksanaSekunderId] = this.resolveDuaPelaksanaSeed(
        opdId,
        pel,
        opdIds,
      );
      await this.ensureProsedurMinimal(
        tx,
        baris.detailSopId,
        pelaksanaUtamaId,
        pelaksanaSekunderId,
      );
    }
  }

  private resolveDuaPelaksanaSeed(
    opdId: string,
    pel: Record<string, { pelaksanaId: string }>,
    opdIds: { opdDinkesId: string; opdDiskominfoId: string; opdDisdikId: string },
  ): [string, string] {
    if (opdId === opdIds.opdDinkesId) {
      return [pel['FRONT_OFFICE_DINKES'].pelaksanaId, pel['KASUBAG_DINKES'].pelaksanaId];
    }
    if (opdId === opdIds.opdDiskominfoId) {
      return [pel['TIM_LAYANAN_DISKOMINFO'].pelaksanaId, pel['TIM_MEDIA_DISKOMINFO'].pelaksanaId];
    }
    return [pel['TIM_PPDB_DISDIK'].pelaksanaId, pel['SEKSI_AKREDITASI_DISDIK'].pelaksanaId];
  }

  private async ensureProsedurMinimal(
    tx: Prisma.TransactionClient,
    detailSopId: string,
    pelaksanaUtamaId: string,
    pelaksanaSekunderId: string,
  ): Promise<void> {
    const swimlaneCount = await tx.detailSOPPelaksana.count({
      where: { detailSopId },
    });
    const langkahCount = await tx.langkahSOP.count({
      where: { detailSopId },
    });
    if (swimlaneCount >= 2 && langkahCount >= 3) {
      return;
    }
    if (swimlaneCount < 1) {
      await this.upsertSwimlane(tx, detailSopId, pelaksanaUtamaId, 1);
    }
    if (swimlaneCount < 2) {
      await this.upsertSwimlane(tx, detailSopId, pelaksanaSekunderId, 2);
    }
    if (langkahCount >= 3) {
      return;
    }
    const lStart = await this.upsertLangkah(tx, {
      detailSopId,
      kegiatan: 'Mulai: Memulai pelaksanaan prosedur.',
      jenis: JenisLangkahProsedur.AWAL_AKHIR,
      urutan: 1,
      kelengkapan: '-',
      keluaran: 'Alur dimulai',
      waktu: 15,
      satuanWaktu: SatuanWaktu.m,
      keterangan: 'Langkah awal (seed minimal).',
      pelaksanaId: pelaksanaUtamaId,
    });
    const lKegiatan = await this.upsertLangkah(tx, {
      detailSopId,
      kegiatan: 'Melaksanakan kegiatan inti sesuai SOP.',
      jenis: JenisLangkahProsedur.KEGIATAN,
      urutan: 2,
      kelengkapan: 'Dokumen dan peralatan standar',
      keluaran: 'Kegiatan selesai',
      waktu: 1,
      satuanWaktu: SatuanWaktu.h,
      keterangan: 'Kegiatan utama (seed minimal).',
      pelaksanaId: pelaksanaSekunderId,
    });
    const lEnd = await this.upsertLangkah(tx, {
      detailSopId,
      kegiatan: 'Selesai: Menutup pelaksanaan prosedur.',
      jenis: JenisLangkahProsedur.AWAL_AKHIR,
      urutan: 3,
      kelengkapan: 'Keluaran kegiatan inti',
      keluaran: 'Prosedur selesai',
      waktu: 30,
      satuanWaktu: SatuanWaktu.m,
      keterangan: 'Langkah akhir (seed minimal).',
      pelaksanaId: pelaksanaUtamaId,
    });
    await tx.langkahSOP.update({
      where: { langkahSopId: lStart.langkahSopId },
      data: { langkahSelanjutnyaYaId: lKegiatan.langkahSopId },
    });
    await tx.langkahSOP.update({
      where: { langkahSopId: lKegiatan.langkahSopId },
      data: { langkahSelanjutnyaYaId: lEnd.langkahSopId },
    });
  }

  private async upsertNilai(
    tx: Prisma.TransactionClient,
    data: {
      pengajuanEvaluasiId: string;
      detailSopId: string;
      hasil: HasilEvaluasi | null;
      catatan: string | null;
      dinilaiOlehId: string | null;
      statusTindakLanjut?: StatusTindakLanjut | null;
    },
  ): Promise<void> {
    const statusTindakLanjut =
      data.statusTindakLanjut ??
      (data.hasil === HasilEvaluasi.PERLU_PERBAIKAN ? StatusTindakLanjut.TERBUKA : null);
    const payload = {
      hasil: data.hasil,
      catatan: data.catatan,
      dinilaiOlehId: data.dinilaiOlehId,
      statusTindakLanjut,
    };
    await tx.nilaiEvaluasi.upsert({
      where: {
        pengajuanEvaluasiId_detailSopId: {
          pengajuanEvaluasiId: data.pengajuanEvaluasiId,
          detailSopId: data.detailSopId,
        },
      },
      create: { ...data, statusTindakLanjut },
      update: payload,
    });
  }

  private async findOrCreatePengajuan(
    tx: Prisma.TransactionClient,
    nomorBA: string,
    data: Omit<Prisma.PengajuanEvaluasiUncheckedCreateInput, 'nomorBA'>,
  ): Promise<{ pengajuanEvaluasiId: string }> {
    const existing = await tx.pengajuanEvaluasi.findFirst({
      where: { nomorBA },
      select: { pengajuanEvaluasiId: true },
    });
    if (existing !== null) {
      return tx.pengajuanEvaluasi.update({
        where: { pengajuanEvaluasiId: existing.pengajuanEvaluasiId },
        data,
        select: { pengajuanEvaluasiId: true },
      });
    }
    return tx.pengajuanEvaluasi.create({
      data: { nomorBA, ...data },
      select: { pengajuanEvaluasiId: true },
    });
  }

  private async validateSeedEvaluationBusinessRules(tx: Prisma.TransactionClient): Promise<void> {
    const pengajuan = await tx.pengajuanEvaluasi.findMany({
      select: {
        pengajuanEvaluasiId: true,
        nomorBA: true,
        opdId: true,
        status: true,
        nilaiEvaluasi: {
          select: {
            detailSopId: true,
            hasil: true,
            statusTindakLanjut: true,
            detailSop: { select: { status: true } },
          },
        },
      },
    });
    const activeByDetail = new Map<string, string[]>();
    for (const row of pengajuan) {
      const isAktif = STATUS_PENGAJUAN_AKTIF_SEED.includes(row.status);
      if (isAktif) {
        for (const nilai of row.nilaiEvaluasi) {
          const detailRows = activeByDetail.get(nilai.detailSopId) ?? [];
          detailRows.push(row.nomorBA ?? row.pengajuanEvaluasiId);
          activeByDetail.set(nilai.detailSopId, detailRows);
        }
      }
      if (row.status !== StatusPengajuanEvaluasi.SEDANG_DIEVALUASI) {
        const invalidNilai = row.nilaiEvaluasi.find((n) => n.hasil !== HasilEvaluasi.SESUAI);
        if (invalidNilai !== undefined) {
          throw new Error(
            `Seed invalid: pengajuan ${row.nomorBA ?? row.pengajuanEvaluasiId} sudah melewati evaluasi tetapi masih memiliki nilai selain SESUAI.`,
          );
        }
      }
      for (const nilai of row.nilaiEvaluasi) {
        if (
          row.status === StatusPengajuanEvaluasi.SEDANG_DIEVALUASI &&
          nilai.hasil === HasilEvaluasi.PERLU_PERBAIKAN &&
          nilai.statusTindakLanjut === StatusTindakLanjut.TERBUKA &&
          nilai.detailSop.status !== StatusSOP.REVISI_DARI_EVALUATOR
        ) {
          throw new Error(
            `Seed invalid: nilai PERLU_PERBAIKAN aktif pada ${row.nomorBA ?? row.pengajuanEvaluasiId} harus membuat DetailSOP REVISI_DARI_EVALUATOR.`,
          );
        }
      }
    }
    for (const [detailSopId, rows] of activeByDetail) {
      if (rows.length > 1) {
        throw new Error(
          `Seed invalid: DetailSOP ${detailSopId} masuk lebih dari satu pengajuan aktif (${rows.join(', ')}).`,
        );
      }
    }
    const orphanPipelineDetails = await tx.detailSOP.findMany({
      where: {
        status: { in: [...STATUS_SOP_WAJIB_PUNYA_PENGAJUAN_AKTIF_SEED] },
      },
      select: { detailSopId: true, nomorSOP: true, status: true },
    });
    for (const detail of orphanPipelineDetails) {
      if (!activeByDetail.has(detail.detailSopId)) {
        throw new Error(
          `Seed invalid: DetailSOP ${detail.nomorSOP} berstatus ${String(detail.status)} tetapi tidak masuk pengajuan aktif.`,
        );
      }
    }
  }

  private async seedLogNilaiEvaluasi(
    tx: Prisma.TransactionClient,
    params: {
      d: Record<string, { detailSopId: string }>;
      pe: Record<string, { pengajuanEvaluasiId: string }>;
      evaluator1Id: string;
      evaluator2Id: string;
    },
  ): Promise<void> {
    const { d, pe, evaluator1Id, evaluator2Id } = params;

    await tx.logNilaiEvaluasi.deleteMany({
      where: {
        pengajuanEvaluasiId: {
          in: Object.values(pe).map((p) => p.pengajuanEvaluasiId),
        },
      },
    });

    await tx.logNilaiEvaluasi.createMany({
      data: [
        // Dinkes EVALUASI_REQUEST_EVALUATOR: SOP penanganan gizi — null → SESUAI
        {
          pengajuanEvaluasiId: pe['DINKES_REQUEST_EVALUATOR'].pengajuanEvaluasiId,
          detailSopId: d['DINKES_004_V1'].detailSopId,
          penggunaId: evaluator1Id,
          createdAt: new Date('2025-06-01T10:00:00.000Z'),
          hasilSebelum: null,
          hasilSesudah: HasilEvaluasi.PERLU_PERBAIKAN,
          catatanSebelum: null,
          catatanSesudah:
            'Lengkapi alur validasi data balita dan bukti koordinasi lintas puskesmas.',
        },
        // Dinkes EVALUASI_REQUEST_EVALUATOR: SOP penanganan gizi — PERLU_PERBAIKAN → SESUAI
        {
          pengajuanEvaluasiId: pe['DINKES_REQUEST_EVALUATOR'].pengajuanEvaluasiId,
          detailSopId: d['DINKES_004_V1'].detailSopId,
          penggunaId: evaluator1Id,
          createdAt: new Date('2025-06-01T10:00:00.500Z'),
          hasilSebelum: HasilEvaluasi.PERLU_PERBAIKAN,
          hasilSesudah: HasilEvaluasi.SESUAI,
          catatanSebelum:
            'Lengkapi alur validasi data balita dan bukti koordinasi lintas puskesmas.',
          catatanSesudah: 'SOP penanganan gizi buruk sesuai standar pelayanan.',
        },
        // Dinkes EVALUASI_REQUEST_EVALUATOR: SOP rawat inap — null → SESUAI
        {
          pengajuanEvaluasiId: pe['DINKES_REQUEST_EVALUATOR'].pengajuanEvaluasiId,
          detailSopId: d['DINKES_005_V1'].detailSopId,
          penggunaId: evaluator1Id,
          createdAt: new Date('2025-06-01T10:00:01.000Z'),
          hasilSebelum: null,
          hasilSesudah: HasilEvaluasi.SESUAI,
          catatanSebelum: null,
          catatanSesudah: 'SOP rawat inap lengkap dan dapat diimplementasikan.',
        },
        // Diskominfo EVALUASI_REQUEST_OPD: belum dinilai (null → null, log awal penugasan)
        {
          pengajuanEvaluasiId: pe['DISKOMINFO_REQUEST_OPD'].pengajuanEvaluasiId,
          detailSopId: d['DISKOMINFO_001_V1'].detailSopId,
          penggunaId: evaluator2Id,
          createdAt: new Date('2025-06-01T10:00:03.000Z'),
          hasilSebelum: null,
          hasilSesudah: null,
          catatanSebelum: null,
          catatanSesudah: null,
        },
        // Disdik EVALUASI_REQUEST_EVALUATOR: akreditasi — null → SESUAI
        {
          pengajuanEvaluasiId: pe['DISDIK_REQUEST_EVALUATOR'].pengajuanEvaluasiId,
          detailSopId: d['DISDIK_002_V1'].detailSopId,
          penggunaId: evaluator2Id,
          createdAt: new Date('2025-06-01T10:00:04.000Z'),
          hasilSebelum: null,
          hasilSesudah: HasilEvaluasi.PERLU_PERBAIKAN,
          catatanSebelum: null,
          catatanSesudah:
            'Perlu penyesuaian kriteria dokumen dengan kebijakan zonasi tahun berjalan.',
        },
        // Disdik EVALUASI_REQUEST_EVALUATOR: akreditasi — PERLU_PERBAIKAN → SESUAI
        {
          pengajuanEvaluasiId: pe['DISDIK_REQUEST_EVALUATOR'].pengajuanEvaluasiId,
          detailSopId: d['DISDIK_002_V1'].detailSopId,
          penggunaId: evaluator2Id,
          createdAt: new Date('2025-06-01T10:00:04.500Z'),
          hasilSebelum: HasilEvaluasi.PERLU_PERBAIKAN,
          hasilSesudah: HasilEvaluasi.SESUAI,
          catatanSebelum:
            'Perlu penyesuaian kriteria dokumen dengan kebijakan zonasi tahun berjalan.',
          catatanSesudah: 'Dokumen PPDB lengkap dan sesuai regulasi zonasi terkini.',
        },
        // Diskominfo EVALUASI_REQUEST_EVALUATOR: V2 SESUAI
        {
          pengajuanEvaluasiId: pe['DISKOMINFO_REQUEST_EVALUATOR'].pengajuanEvaluasiId,
          detailSopId: d['DISKOMINFO_002_V1'].detailSopId,
          penggunaId: evaluator1Id,
          createdAt: new Date('2025-06-01T10:00:05.000Z'),
          hasilSebelum: null,
          hasilSesudah: HasilEvaluasi.SESUAI,
          catatanSebelum: null,
          catatanSesudah: 'SOP Pengelolaan Media Sosial sesuai panduan KPI Humas Pemerintah.',
        },
        // Disdik EVALUASI_REQUEST_OPD: V2 SESUAI
        {
          pengajuanEvaluasiId: pe['DISDIK_REQUEST_OPD'].pengajuanEvaluasiId,
          detailSopId: d['DISDIK_001_V2'].detailSopId,
          penggunaId: evaluator1Id,
          createdAt: new Date('2025-06-01T10:00:06.000Z'),
          hasilSebelum: null,
          hasilSesudah: HasilEvaluasi.PERLU_PERBAIKAN,
          catatanSebelum: null,
          catatanSesudah: 'Perjelas validasi berkas dan batas waktu sanggah pada alur PPDB.',
        },
        // Disdik EVALUASI_REQUEST_OPD: V2 PERLU_PERBAIKAN → SESUAI
        {
          pengajuanEvaluasiId: pe['DISDIK_REQUEST_OPD'].pengajuanEvaluasiId,
          detailSopId: d['DISDIK_001_V2'].detailSopId,
          penggunaId: evaluator1Id,
          createdAt: new Date('2025-06-01T10:00:06.500Z'),
          hasilSebelum: HasilEvaluasi.PERLU_PERBAIKAN,
          hasilSesudah: HasilEvaluasi.SESUAI,
          catatanSebelum: 'Perjelas validasi berkas dan batas waktu sanggah pada alur PPDB.',
          catatanSesudah: 'SOP PPDB versi baru sesuai regulasi zonasi terkini. Layak berlaku.',
        },
      ],
    });
  }

  // ── MODUL 6: TTE ───────────────────────────────────────────────────────

  /**
   * DokumenTte seed: jenis SOP_BERLAKU dan BERITA_ACARA_EVALUASI saja.
   * Invariant: tepat satu parent — `detailSopId` XOR `pengajuanEvaluasiId` (CHECK `chk_dokumentte_satu_orang_tua`);
   * pada `update` eksplisit nullkan FK lawan agar re-seed idempoten setelah data kotor.
   */
  private async seedDokumenTte(
    tx: Prisma.TransactionClient,
    params: {
      d: Record<string, { detailSopId: string }>;
      pe: Record<string, { pengajuanEvaluasiId: string }>;
    },
  ): Promise<Record<string, { dokumenTteId: string }>> {
    const { d, pe } = params;
    const dok: Record<string, { dokumenTteId: string }> = {};

    // JenisDokumenTte.SOP_BERLAKU — dokumen SOP Dinkes yang sudah berlaku
    dok['SOP_BERLAKU_DINKES'] = await tx.dokumenTte.upsert({
      where: { detailSopId: d['DINKES_001_V1'].detailSopId },
      create: {
        nomorDokumen: 'DOC-SOP-DINKES-2024-001',
        jenisDokumen: JenisDokumenTte.SOP_BERLAKU,
        judulDokumen: 'SOP Berlaku Pelayanan Surat Keterangan Sehat',
        hashDokumen: 'sha256-sop-dinkes-berlaku-v1-2024',
        versiDokumen: 1,
        detailSopId: d['DINKES_001_V1'].detailSopId,
      },
      update: {
        hashDokumen: 'sha256-sop-dinkes-berlaku-v1-2024',
        jenisDokumen: JenisDokumenTte.SOP_BERLAKU,
        judulDokumen: 'SOP Berlaku Pelayanan Surat Keterangan Sehat',
        pengajuanEvaluasiId: null,
      },
      select: { dokumenTteId: true },
    });

    // JenisDokumenTte.BERITA_ACARA_EVALUASI — BA evaluasi Dinkes EVALUASI_REQUEST_EVALUATOR
    dok['BA_EVALUASI_DINKES'] = await tx.dokumenTte.upsert({
      where: { pengajuanEvaluasiId: pe['DINKES_REQUEST_EVALUATOR'].pengajuanEvaluasiId },
      create: {
        nomorDokumen: 'DOC-BA-DINKES-2026-001',
        jenisDokumen: JenisDokumenTte.BERITA_ACARA_EVALUASI,
        judulDokumen: 'Berita Acara Evaluasi SOP Dinkes EVALUASI_REQUEST_EVALUATOR 2026',
        hashDokumen: 'sha256-ba-dinkes-EVALUASI_REQUEST_EVALUATOR-2026-001',
        versiDokumen: 1,
        pengajuanEvaluasiId: pe['DINKES_REQUEST_EVALUATOR'].pengajuanEvaluasiId,
      },
      update: {
        hashDokumen: 'sha256-ba-dinkes-EVALUASI_REQUEST_EVALUATOR-2026-001',
        jenisDokumen: JenisDokumenTte.BERITA_ACARA_EVALUASI,
        judulDokumen: 'Berita Acara Evaluasi SOP Dinkes EVALUASI_REQUEST_EVALUATOR 2026',
        detailSopId: null,
      },
      select: { dokumenTteId: true },
    });

    // JenisDokumenTte.SOP_BERLAKU — dokumen SOP Disdik V2 yang sudah berlaku
    dok['SOP_BERLAKU_DISDIK'] = await tx.dokumenTte.upsert({
      where: { detailSopId: d['DISDIK_001_V2'].detailSopId },
      create: {
        nomorDokumen: 'DOC-SOP-DISDIK-2024-001',
        jenisDokumen: JenisDokumenTte.SOP_BERLAKU,
        judulDokumen: 'SOP Berlaku PPDB Dinas Pendidikan Provinsi',
        hashDokumen: 'sha256-sop-disdik-ppdb-berlaku-v2-2024',
        versiDokumen: 2,
        detailSopId: d['DISDIK_001_V2'].detailSopId,
      },
      update: {
        hashDokumen: 'sha256-sop-disdik-ppdb-berlaku-v2-2024',
        jenisDokumen: JenisDokumenTte.SOP_BERLAKU,
        judulDokumen: 'SOP Berlaku PPDB Dinas Pendidikan Provinsi',
        pengajuanEvaluasiId: null,
      },
      select: { dokumenTteId: true },
    });

    // JenisDokumenTte.BERITA_ACARA_EVALUASI — BA evaluasi Disdik selesai
    dok['BA_EVALUASI_DISDIK'] = await tx.dokumenTte.upsert({
      where: { pengajuanEvaluasiId: pe['DISDIK_REQUEST_OPD'].pengajuanEvaluasiId },
      create: {
        nomorDokumen: 'DOC-BA-DISDIK-2023-001',
        jenisDokumen: JenisDokumenTte.BERITA_ACARA_EVALUASI,
        judulDokumen: 'Berita Acara Evaluasi SOP PPDB Disdik 2023',
        hashDokumen: 'sha256-ba-disdik-EVALUASI_REQUEST_OPD-2023-001',
        versiDokumen: 1,
        pengajuanEvaluasiId: pe['DISDIK_REQUEST_OPD'].pengajuanEvaluasiId,
      },
      update: {
        hashDokumen: 'sha256-ba-disdik-EVALUASI_REQUEST_OPD-2023-001',
        jenisDokumen: JenisDokumenTte.BERITA_ACARA_EVALUASI,
        judulDokumen: 'Berita Acara Evaluasi SOP PPDB Disdik 2023',
        detailSopId: null,
      },
      select: { dokumenTteId: true },
    });

    return dok;
  }
}
