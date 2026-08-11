import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SopDaftarVersiSliceDto } from './sop-daftar-versi-slice.dto';
import { TerakhirDieditDto } from './terakhir-diedit.dto';

/** Satu baris daftar SOP (header + versi DetailSOP terbaru) untuk UI Manajemen SOP penyusun. */
export class SopDaftarRowDto {
  @ApiProperty({ description: 'ID header SOP (sopId)' })
  readonly id!: string;

  @ApiProperty({ description: 'OPD pemilik header SOP' })
  readonly opdId!: string;

  @ApiPropertyOptional({
    description: 'ID DetailSOP versi terakhir; null jika belum ada versi',
    nullable: true,
  })
  readonly detailSopId!: string | null;

  @ApiProperty()
  readonly judul!: string;

  @ApiPropertyOptional({ description: 'Nomor SOP pada versi terakhir', nullable: true })
  readonly nomorSop!: string | null;

  @ApiPropertyOptional({
    description: 'Nomor versi DetailSOP terbaru',
    nullable: true,
    example: 2,
  })
  readonly versi!: number | null;

  @ApiPropertyOptional({ description: 'Nama pembuat versi terakhir', nullable: true })
  readonly pembuat!: string | null;

  @ApiProperty({ type: () => TerakhirDieditDto })
  readonly terakhirDiedit!: TerakhirDieditDto;

  @ApiProperty({ description: 'Status DetailSOP versi terakhir' })
  readonly status!: string;

  @ApiProperty({ description: 'Label UI status dokumen (Bahasa Indonesia)' })
  readonly statusLabel!: string;

  @ApiPropertyOptional({
    description: 'ID peraturan pertama (dasar hukum) untuk filter UI',
    nullable: true,
  })
  readonly peraturanId!: string | null;

  @ApiPropertyOptional({
    description: 'updatedAt versi terakhir (ISO 8601); untuk filter tanggal di klien',
    nullable: true,
  })
  readonly terakhirDiperbarui!: string | null;

  @ApiPropertyOptional({
    type: () => SopDaftarVersiSliceDto,
    nullable: true,
    description: 'Versi yang sedang BERLAKU (resmi), bila berbeda dari versi terbaru',
  })
  readonly versiBerlaku!: SopDaftarVersiSliceDto | null;

  @ApiProperty({
    description: 'Tombol buat versi baru dari SOP BERLAKU dapat dipakai',
  })
  readonly canBuatVersiBaru!: boolean;

  @ApiProperty({
    description: 'Kepala OPD dapat mencabut versi BERLAKU (tanpa revisi yang sedang berjalan)',
  })
  readonly canCabutSop!: boolean;

  @ApiProperty({
    description: 'Penyusun dapat menghapus SOP bila masih berupa draft awal satu-satunya',
  })
  readonly canHapusSopDraft!: boolean;
}
