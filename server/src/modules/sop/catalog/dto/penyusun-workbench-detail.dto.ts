import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { KepalaOpdRingkasDto } from './kepala-opd-ringkas.dto';

/** Header SOP ringkas di dalam detail area kerja. */
export class PenyusunWorkbenchSopHeaderDto {
  @ApiProperty()
  readonly id!: string;

  @ApiProperty()
  readonly opdId!: string;

  @ApiProperty()
  readonly judul!: string;

  @ApiProperty()
  readonly createdAt!: string;

  @ApiProperty()
  readonly updatedAt!: string;
}

/** DetailSOP + relasi yang dipakai editor penyusun (selaras klien SopDetail). */
export class PenyusunWorkbenchDetailDto {
  @ApiProperty({ description: 'ID DetailSOP (sama dengan id)' })
  readonly id!: string;

  @ApiProperty()
  readonly sopId!: string;

  @ApiProperty()
  readonly status!: string;

  @ApiProperty()
  readonly statusLabel!: string;

  @ApiProperty()
  readonly versi!: number;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'DetailSOP terminal yang menjadi sumber saat versi ini dibuat',
  })
  readonly revisiDariDetailSopId?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Nomor versi sumber revisi',
  })
  readonly revisiDariVersi?: number | null;

  @ApiProperty()
  readonly nomorSOP!: string;

  @ApiProperty()
  readonly tanggalPembuatan!: string;

  @ApiPropertyOptional({ nullable: true })
  readonly tanggalRevisi?: string | null;

  @ApiPropertyOptional({ nullable: true })
  readonly tanggalEfektif?: string | null;

  @ApiProperty({ description: 'URL/logo instansi (nilai pengganti bila belum diisi)' })
  readonly logoInstansi!: string;

  @ApiProperty()
  readonly namaLembaga!: string;

  @ApiPropertyOptional({ nullable: true })
  readonly dibuatOlehId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  readonly terakhirDieditOlehId?: string | null;

  @ApiProperty()
  readonly createdAt!: string;

  @ApiProperty()
  readonly updatedAt!: string;

  @ApiPropertyOptional({ type: () => PenyusunWorkbenchSopHeaderDto })
  readonly sop?: PenyusunWorkbenchSopHeaderDto;

  @ApiPropertyOptional()
  readonly dibuatOleh?: { id: string; nama: string };

  @ApiPropertyOptional()
  readonly terakhirDieditOleh?: { id: string; nama: string };

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: false,
    description: 'Lampiran non-prosedural pada dokumen SOP (struktur eksplisit per kategori).',
  })
  readonly lampiran?: {
    peringatan: Array<{ id: string; teks: string; createdAt: string }>;
    kualifikasiPelaksanaan: Array<{ id: string; teks: string; createdAt: string }>;
    peralatanPerlengkapan: Array<{ id: string; teks: string; createdAt: string }>;
    pencatatanPendataan: Array<{ id: string; teks: string; createdAt: string }>;
  };

  @ApiPropertyOptional({ type: 'array', items: { type: 'object' } })
  readonly dasarHukum?: unknown[];

  @ApiPropertyOptional({ type: 'array', items: { type: 'object' } })
  readonly relasiSopKeluar?: unknown[];

  @ApiPropertyOptional({ type: 'array', items: { type: 'object' } })
  readonly relasiSopMasuk?: unknown[];

  @ApiPropertyOptional({ type: 'array', items: { type: 'object' } })
  readonly swimlanes?: unknown[];

  @ApiPropertyOptional({ type: 'array', items: { type: 'object' } })
  readonly nilaiEvaluasi?: unknown[];

  @ApiPropertyOptional({
    type: () => KepalaOpdRingkasDto,
    nullable: true,
    description: 'Kepala OPD OPD pemilik SOP (untuk blok DISAHKAN OLEH / NIP di pratinjau dokumen)',
  })
  readonly kepalaOpd?: KepalaOpdRingkasDto | null;

  @ApiPropertyOptional({
    type: [String],
    description: 'ID peraturan dasar hukum (urut createdAt asc) untuk panel kanan editor',
  })
  readonly dasarHukumPeraturanIds?: string[];

  @ApiPropertyOptional({
    type: [String],
    description: 'ID DetailSOP terkait (relasi keluar, urut createdAt asc)',
  })
  readonly sopTerkaitDetailIds?: string[];

  // Catatan: field kompatibilitas lama `peringatan/kualifikasiPelaksanaan/peralatanPerlengkapan/pencatatanPendataan`
  // diganti menjadi `lampiran` struktur baru.
}
