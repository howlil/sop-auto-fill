import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Metadata sesi log: field domain yang berubah + jumlah event dalam sesi. */
export class PenyusunWorkbenchLogEditMetaDto {
  @ApiProperty({ type: [String], description: 'Daftar field domain yang berubah dalam sesi.' })
  readonly fields!: string[];

  @ApiProperty({ description: 'Jumlah event yang digabung dalam sesi.' })
  readonly count!: number;
}

/** Satu entri log edit untuk tab Aktivitas (sesi gaya Google Docs + bagian SOP). */
export class PenyusunWorkbenchLogEditDto {
  @ApiProperty({
    description:
      'Identitas stabil entri log (bukan UUID): gabungan detailSopId + penggunaId + createdAt (unit separator).',
  })
  readonly id!: string;

  @ApiProperty()
  readonly sopDetailId!: string;

  @ApiProperty()
  readonly userId!: string;

  @ApiProperty({
    enum: ['HEADER', 'LANGKAH', 'STATUS', 'UMPAN_BALIK', 'EVALUASI'],
    description: 'Bagian SOP yang disentuh (selaras BagianSOP server).',
  })
  readonly bagian!: 'HEADER' | 'LANGKAH' | 'STATUS' | 'UMPAN_BALIK' | 'EVALUASI';

  @ApiPropertyOptional({ nullable: true, description: 'Ringkasan keterangan untuk UI.' })
  readonly keterangan?: string | null;

  @ApiPropertyOptional({
    type: () => PenyusunWorkbenchLogEditMetaDto,
    nullable: true,
    description: 'Metadata terstruktur sesi log (fields union + count).',
  })
  readonly meta?: PenyusunWorkbenchLogEditMetaDto | null;

  @ApiProperty({ description: 'Peran pengguna saat mencatat log' })
  readonly aktorRole!: string;

  @ApiProperty({ description: 'Waktu ISO 8601' })
  readonly createdAt!: string;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Waktu sesi ditutup (null bila sesi masih berlangsung).',
  })
  readonly closedAt?: string | null;

  @ApiPropertyOptional({
    description: 'Ringkasan pengguna pembuat log',
  })
  readonly user?: { id: string; nama: string; email: string };
}
