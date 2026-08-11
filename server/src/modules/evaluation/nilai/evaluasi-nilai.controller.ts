import { Body, Controller, Param, ParseUUIDPipe, Patch, Req } from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { type ApiSuccessResponse, Roles, UseJwtAndRolesGuards } from '../../../common';
import { PeranPengguna } from '../../../generated/prisma';
import {
  ACCESS_TOKEN_COOKIE_NAME,
  type JwtAccessPayload,
} from '../../core/auth/helpers/auth.shared';
import { IsiNilaiEvaluasiDto } from './dto/isi-nilai-evaluasi.dto';
import { NilaiEvaluasiPatchResponseDto } from './dto/nilai-evaluasi-patch-response.dto';
import { PengajuanEvaluasiSelesaiResponseDto } from './dto/pengajuan-evaluasi-selesai-response.dto';
import { SelesaiEvaluasiDto } from './dto/selesai-evaluasi.dto';
import { TolakPengajuanEvaluasiDto } from './dto/tolak-pengajuan-evaluasi.dto';
import { EvaluasiNilaiService } from './evaluasi-nilai.service';

@ApiTags('Evaluasi')
@Controller('evaluasi')
@UseJwtAndRolesGuards()
export class EvaluasiNilaiController {
  constructor(private readonly evaluasiNilaiService: EvaluasiNilaiService) {}

  @Patch(':pengajuanEvaluasiId/nilai/:detailSopId')
  @Roles(PeranPengguna.EVALUATOR)
  @ApiCookieAuth(ACCESS_TOKEN_COOKIE_NAME)
  @ApiOperation({
    summary: 'Isi / ubah nilai evaluasi untuk satu DetailSOP dalam pengajuan aktif',
    description:
      'Pengajuan harus berstatus SEDANG_DIEVALUASI. Hasil Perlu perbaikan wajib catatan; status tindak lanjut TERBUKA; status dokumen → REVISI_DARI_EVALUATOR.',
  })
  @ApiParam({ name: 'pengajuanEvaluasiId', format: 'uuid' })
  @ApiParam({ name: 'detailSopId', format: 'uuid' })
  @ApiResponse({ status: 200, type: NilaiEvaluasiPatchResponseDto })
  @ApiForbiddenResponse({ description: 'Bukan EVALUATOR' })
  @ApiNotFoundResponse({ description: 'Pengajuan atau baris nilai tidak ditemukan' })
  @ApiConflictResponse({ description: 'Konflik versi optimistik' })
  async isiNilai(
    @Req() req: Request & { user: JwtAccessPayload },
    @Param('pengajuanEvaluasiId', ParseUUIDPipe) pengajuanEvaluasiId: string,
    @Param('detailSopId', ParseUUIDPipe) detailSopId: string,
    @Body() dto: IsiNilaiEvaluasiDto,
  ): Promise<ApiSuccessResponse<NilaiEvaluasiPatchResponseDto>> {
    const data = await this.evaluasiNilaiService.isiNilai(
      req.user,
      pengajuanEvaluasiId,
      detailSopId,
      dto,
    );
    return {
      message: 'Nilai evaluasi berhasil disimpan',
      success: true,
      data,
    };
  }

  @Patch(':pengajuanEvaluasiId/nilai/:detailSopId/tindak-lanjut-selesai')
  @Roles(PeranPengguna.PENYUSUN, PeranPengguna.PJ_PENYUSUN)
  @ApiCookieAuth(ACCESS_TOKEN_COOKIE_NAME)
  @ApiOperation({
    summary: 'Tandai umpan balik evaluasi sudah ditindaklanjuti (penyusun / PJ Penyusun)',
    description:
      'Wajib sebelum kirim ulang ke evaluator. Hanya untuk DetailSOP REVISI_DARI_EVALUATOR dengan hasil Perlu perbaikan dan status tindak lanjut TERBUKA.',
  })
  @ApiParam({ name: 'pengajuanEvaluasiId', format: 'uuid' })
  @ApiParam({ name: 'detailSopId', format: 'uuid' })
  @ApiResponse({ status: 200, type: NilaiEvaluasiPatchResponseDto })
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  @ApiConflictResponse()
  async tandaiTindakLanjutSelesai(
    @Req() req: Request & { user: JwtAccessPayload },
    @Param('pengajuanEvaluasiId', ParseUUIDPipe) pengajuanEvaluasiId: string,
    @Param('detailSopId', ParseUUIDPipe) detailSopId: string,
  ): Promise<ApiSuccessResponse<NilaiEvaluasiPatchResponseDto>> {
    const data = await this.evaluasiNilaiService.tandaiTindakLanjutSelesai(
      req.user,
      pengajuanEvaluasiId,
      detailSopId,
    );
    return {
      message: 'Umpan balik evaluasi ditandai selesai',
      success: true,
      data,
    };
  }

  @Patch(':pengajuanEvaluasiId/selesai')
  @Roles(PeranPengguna.EVALUATOR)
  @ApiCookieAuth(ACCESS_TOKEN_COOKIE_NAME)
  @ApiOperation({
    summary: 'Selesaikan pengajuan evaluasi (semua SOP harus SESUAI, lalu ajukan ke PJ)',
    description:
      'Memvalidasi seluruh baris NilaiEvaluasi berhasil SESUAI, memperbarui status dokumen ke MENUNGGU_TTD_PJ_EVALUATOR, dan mengubah pengajuan ke SELESAI_DIEVALUASI. Untuk pengajuan EVALUASI_REQUEST_EVALUATOR wajib `nilaiOPD` 1–5; untuk EVALUASI_REQUEST_OPD jangan kirim `nilaiOPD` (evaluasi hanya per dokumen SOP).',
  })
  @ApiParam({ name: 'pengajuanEvaluasiId', format: 'uuid' })
  @ApiResponse({ status: 200, type: PengajuanEvaluasiSelesaiResponseDto })
  @ApiForbiddenResponse({ description: 'Bukan EVALUATOR' })
  @ApiNotFoundResponse({ description: 'Pengajuan tidak ditemukan' })
  async selesai(
    @Req() req: Request & { user: JwtAccessPayload },
    @Param('pengajuanEvaluasiId', ParseUUIDPipe) pengajuanEvaluasiId: string,
    @Body() dto: SelesaiEvaluasiDto,
  ): Promise<ApiSuccessResponse<PengajuanEvaluasiSelesaiResponseDto>> {
    const data = await this.evaluasiNilaiService.selesai(req.user, pengajuanEvaluasiId, dto);
    return {
      message: 'Pengajuan evaluasi berhasil diselesaikan',
      success: true,
      data,
    };
  }

  @Patch(':pengajuanEvaluasiId/tolak')
  @Roles(PeranPengguna.EVALUATOR)
  @ApiCookieAuth(ACCESS_TOKEN_COOKIE_NAME)
  @ApiOperation({
    summary: 'Tolak final pengajuan evaluasi beserta seluruh versi SOP di dalamnya',
    description:
      'Hanya pengajuan SEDANG_DIEVALUASI. Alasan wajib. Seluruh versi SOP menjadi DITOLAK_EVALUATOR dan tidak dapat diajukan ulang; penyusun wajib membuat versi baru dan pengajuan baru.',
  })
  @ApiParam({ name: 'pengajuanEvaluasiId', format: 'uuid' })
  @ApiResponse({ status: 200, type: PengajuanEvaluasiSelesaiResponseDto })
  @ApiForbiddenResponse({ description: 'Bukan EVALUATOR' })
  @ApiNotFoundResponse({ description: 'Pengajuan tidak ditemukan' })
  @ApiConflictResponse({ description: 'Status atau versi pengajuan sudah berubah' })
  async tolak(
    @Req() req: Request & { user: JwtAccessPayload },
    @Param('pengajuanEvaluasiId', ParseUUIDPipe) pengajuanEvaluasiId: string,
    @Body() dto: TolakPengajuanEvaluasiDto,
  ): Promise<ApiSuccessResponse<PengajuanEvaluasiSelesaiResponseDto>> {
    const data = await this.evaluasiNilaiService.tolak(req.user, pengajuanEvaluasiId, dto);
    return {
      message: 'Pengajuan evaluasi berhasil ditolak',
      success: true,
      data,
    };
  }
}
