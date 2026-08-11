import type { PrismaService } from '../../../src/common/prisma/prisma.service';

export function assertSafeIntegrationDatabase(): void {
  const databaseName = process.env.DATABASE_NAME ?? '';
  if (!databaseName.toLowerCase().includes('test')) {
    throw new Error(
      `Integration test dibatalkan: DATABASE_NAME harus mengandung kata "test". Nilai saat ini: ${databaseName}`,
    );
  }
}

/** Memastikan koneksi Prisma ke database test aktif (setelah app Nest di-init). */
export async function pingIntegrationDatabase(prisma: PrismaService): Promise<void> {
  const host = process.env.DATABASE_HOST ?? '127.0.0.1';
  const port = process.env.DATABASE_PORT ?? '3306';
  const database = process.env.DATABASE_NAME ?? '';
  try {
    await prisma.$executeRawUnsafe('SELECT 1');
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Database integration tidak dapat dijangkau (${host}:${port}/${database}). ` +
        `Jalankan integration test via Docker: pnpm test:integration:docker. Detail: ${detail}`,
    );
  }
}

export async function resetIntegrationDatabase(prisma: PrismaService): Promise<void> {
  const tables = [
    'TitikTekukPanahDiagramSOP',
    'OverrideLabelDiagramSOP',
    'OverridePanahDiagramSOP',
    'KonfigurasiDiagramSOP',
    'LogEditSopDomainField',
    'LogEditSOP',
    'RiwayatTandaTangan',
    'DokumenTte',
    'PengingatWhatsApp',
    'LogNilaiEvaluasi',
    'NilaiEvaluasi',
    'PengajuanEvaluasi',
    'LangkahSOP',
    'DetailSOPPelaksana',
    'SopTerkait',
    'DasarHukum',
    'LampiranPeringatan',
    'LampiranKualifikasiPelaksanaan',
    'LampiranPeralatanPerlengkapan',
    'LampiranPencatatanPendataan',
    'DetailSOP',
    'SOP',
    'Pelaksana',
    'OPDPeraturan',
    'Peraturan',
    'RiwayatOpdPengguna',
    'Pengguna',
    'OPD',
  ];

  await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS=0');
  try {
    for (const table of tables) {
      await prisma.$executeRawUnsafe(`DELETE FROM \`${table}\``);
    }
  } finally {
    await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS=1');
  }
}
