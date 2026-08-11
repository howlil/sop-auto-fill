import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

/**
 * Satu entri jalur pelaksana (DetailSOPPelaksana). Urutan diturunkan dari posisi index
 * di array `pelaksana[]` muatan data.
 */
export class PelaksanaPatchItem {
  @ApiProperty({
    description: 'ID master Pelaksana milik OPD pemilik SOP',
    format: 'uuid',
  })
  @IsUUID('4')
  readonly pelaksanaId!: string;
}
