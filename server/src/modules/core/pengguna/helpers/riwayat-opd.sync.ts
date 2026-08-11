import type { Prisma } from '../../../../generated/prisma';

/** Menandai satu baris riwayat OPD sebagai tidak aktif (mis. saat pindah OPD). */
export async function markRiwayatOpdTidakAktif(
  tx: Prisma.TransactionClient,
  penggunaId: string,
  opdId: string,
): Promise<void> {
  await tx.riwayatOpdPengguna.upsert({
    where: {
      penggunaId_opdId: { penggunaId, opdId },
    },
    create: { penggunaId, opdId, isAktif: false },
    update: { isAktif: false, updatedAt: new Date() },
  });
}

/** Satu OPD aktif per pengguna: nonaktifkan semua riwayat lalu aktifkan pasangan pengguna–opd. */
export async function syncActiveRiwayatOpd(
  tx: Prisma.TransactionClient,
  penggunaId: string,
  opdId: string,
): Promise<void> {
  await tx.riwayatOpdPengguna.updateMany({
    where: { penggunaId },
    data: { isAktif: false },
  });
  await tx.riwayatOpdPengguna.upsert({
    where: {
      penggunaId_opdId: { penggunaId, opdId },
    },
    create: { penggunaId, opdId, isAktif: true },
    update: { isAktif: true, updatedAt: new Date() },
  });
}
