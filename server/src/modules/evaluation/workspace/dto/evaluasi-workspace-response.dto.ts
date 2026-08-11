import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EvaluasiWorkspaceDaftarSopRowDto } from './evaluasi-workspace-daftar-sop-row.dto';
import { EvaluasiWorkspaceOpRingkasDto } from './evaluasi-workspace-op-ringkas.dto';
import { EvaluasiWorkspacePengajuanAktifDto } from './evaluasi-workspace-pengajuan-aktif.dto';
import { EvaluasiWorkspacePreviewDto } from './evaluasi-workspace-preview.dto';
import { EvaluasiWorkspaceLogNilaiEntryDto } from './evaluasi-workspace-log-nilai-entry.dto';
import { EvaluasiWorkspaceRiwayatOpdEntryDto } from './evaluasi-workspace-riwayat-opd-entry.dto';

/** Respons GET `/evaluasi/workspace/opd/:opdId`. */
export class EvaluasiWorkspaceOpdResponseDto {
  @ApiProperty({ type: () => EvaluasiWorkspaceOpRingkasDto })
  readonly opd!: EvaluasiWorkspaceOpRingkasDto;

  @ApiPropertyOptional({
    nullable: true,
    type: () => EvaluasiWorkspacePengajuanAktifDto,
    description: 'Pengajuan aktif untuk OPD ini, atau null',
  })
  readonly pengajuanAktif!: EvaluasiWorkspacePengajuanAktifDto | null;

  @ApiProperty({ type: () => [EvaluasiWorkspaceDaftarSopRowDto] })
  readonly daftarSop!: EvaluasiWorkspaceDaftarSopRowDto[];

  @ApiProperty({ type: () => [EvaluasiWorkspaceRiwayatOpdEntryDto] })
  readonly riwayatOpd!: EvaluasiWorkspaceRiwayatOpdEntryDto[];

  @ApiPropertyOptional({
    nullable: true,
    type: () => EvaluasiWorkspacePreviewDto,
    description: 'Terisi hanya jika `detailSopId` + expand menyertakan `preview`',
  })
  readonly preview!: EvaluasiWorkspacePreviewDto | null;

  @ApiProperty({
    type: () => [EvaluasiWorkspaceLogNilaiEntryDto],
    description:
      'Log penilaian untuk DetailSOP pada query (pengajuan aktif); kosong jika detailSopId tidak dikirim',
  })
  readonly logNilaiSopTerpilih!: EvaluasiWorkspaceLogNilaiEntryDto[];
}
