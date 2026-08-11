import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PeranPengguna, PrismaClient } from '../src/generated/prisma';

const DEFAULT_PASSWORD = '@Password123:)';
const BCRYPT_SALT_ROUNDS = 10;

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} wajib diisi untuk E2E seed`);
  return value;
}

function databasePort(): number {
  const value = Number(process.env.DATABASE_PORT ?? '3306');
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    throw new Error('DATABASE_PORT tidak valid');
  }
  return value;
}

const adapter = new PrismaMariaDb({
  host: required('DATABASE_HOST'),
  port: databasePort(),
  user: required('DATABASE_USER'),
  password: required('DATABASE_PASSWORD'),
  database: required('DATABASE_NAME'),
  connectionLimit: 4,
  connectTimeout: 15_000,
  allowPublicKeyRetrieval: true,
});

const prisma = new PrismaClient({ adapter });

type SeedUser = {
  email: string;
  nama: string;
  peran: PeranPengguna;
  nip: string;
  jabatan: string;
  pangkat: string;
  nohp: string;
  opd: 'BIRO' | 'DINKES';
};

const users: readonly SeedUser[] = [
  {
    email: 'pjevaluator@gmail.com',
    nama: 'PJ Evaluator E2E',
    peran: PeranPengguna.PJ_EVALUATOR,
    nip: '198501012009011000',
    jabatan: 'PJ Evaluator SOP',
    pangkat: 'Pembina',
    nohp: '6281234567890',
    opd: 'BIRO',
  },
  {
    email: 'evaluator1@gmail.com',
    nama: 'Evaluator E2E',
    peran: PeranPengguna.EVALUATOR,
    nip: '198501012009011001',
    jabatan: 'Evaluator SOP',
    pangkat: 'Pembina',
    nohp: '6281234567891',
    opd: 'BIRO',
  },
  {
    email: 'kepalaopd.dinkes@gmail.com',
    nama: 'Kepala OPD E2E',
    peran: PeranPengguna.KEPALA_OPD,
    nip: '198501012009011005',
    jabatan: 'Kepala Dinkes',
    pangkat: 'Pembina',
    nohp: '6281234567895',
    opd: 'DINKES',
  },
  {
    email: 'pjpenyusun.dinkes@gmail.com',
    nama: 'PJ Penyusun E2E',
    peran: PeranPengguna.PJ_PENYUSUN,
    nip: '198501012009011003',
    jabatan: 'PJ Penyusun SOP',
    pangkat: 'Pembina',
    nohp: '6281234567893',
    opd: 'DINKES',
  },
  {
    email: 'penyusun.dinkes@gmail.com',
    nama: 'Penyusun E2E',
    peran: PeranPengguna.PENYUSUN,
    nip: '198501012009011004',
    jabatan: 'Penyusun SOP',
    pangkat: 'Penata',
    nohp: '6281234567894',
    opd: 'DINKES',
  },
];

async function main(): Promise<void> {
  const password =
    process.env.E2E_SEED_PASSWORD ?? process.env.SEED_DEFAULT_PASSWORD ?? DEFAULT_PASSWORD;
  const hash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

  await prisma.$transaction(async (tx) => {
    const biro = await tx.oPD.create({ data: { nama: 'Biro Organisasi' } });
    const dinkes = await tx.oPD.create({ data: { nama: 'Dinas Kesehatan' } });
    const opdIds = { BIRO: biro.opdId, DINKES: dinkes.opdId } as const;

    for (const user of users) {
      const created = await tx.pengguna.create({
        data: {
          email: user.email,
          nama: user.nama,
          peran: user.peran,
          nip: user.nip,
          jabatan: user.jabatan,
          pangkat: user.pangkat,
          nohp: user.nohp,
          kataSandi: hash,
          opdId: opdIds[user.opd],
        },
      });

      await tx.riwayatOpdPengguna.create({
        data: {
          penggunaId: created.penggunaId,
          opdId: created.opdId,
          isAktif: true,
        },
      });
    }
  });

  console.log('E2E seed selesai: 2 OPD dan 5 role utama.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
