import { Controller, Get, Param, ParseUUIDPipe, Query, Req } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
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
import { BeritaAcaraEvaluasiViewDto } from './dto/berita-acara-evaluasi-view.dto';
import { PengajuanEvaluasiShellDto } from './dto/pengajuan-evaluasi-shell.dto';
import { PengajuanArsipQueryDto } from '../pengajuan/dto/pengajuan-arsip-query.dto';
import { PengajuanSopDokumenQueryDto } from './dto/pengajuan-sop-dokumen-query.dto';
import { PengajuanSopWorkbenchResponseDto } from './dto/pengajuan-sop-workbench-response.dto';
import { PengajuanEvaluasiDetailService } from './pengajuan-evaluasi-detail.service';

@ApiTags('Evaluasi')
@Controller('evaluasi/pengajuan')
@UseJwtAndRolesGuards()
export class PengajuanEvaluasiDetailController {
  constructor(private readonly pengajuanEvaluasiDetailService: PengajuanEvaluasiDetailService) {}

  @Get(':pengajuanId/sop-dokumen/:detailSopId')
  @Roles(
    PeranPengguna.PJ_EVALUATOR,
    PeranPengguna.EVALUATOR,
    PeranPengguna.PENYUSUN,
    PeranPengguna.PJ_PENYUSUN,
    PeranPengguna.KEPALA_OPD,
  )
  @ApiCookieAuth(ACCESS_TOKEN_COOKIE_NAME)
  @ApiOperation({
    summary: 'Dokumen SOP lengkap dalam konteks pengajuan evaluasi',
    description:
      'Area kerja penyusun (detail + langkah + log) hanya untuk DetailSOP yang termasuk pengajuan. Mencegah akses dokumen luar pengajuan evaluasi dengan menebak UUID.',
  })
  @ApiParam({ name: 'pengajuanId', format: 'uuid' })
  @ApiParam({ name: 'detailSopId', format: 'uuid' })
  @ApiQuery({
    name: 'logsLimit',
    required: false,
    schema: { default: 100, minimum: 1, maximum: 500 },
  })
  @ApiQuery({
    name: 'arsip',
    required: false,
    type: Boolean,
    description: 'Jika true, hanya untuk cetak arsip (wajib status SELESAI).',
  })
  @ApiResponse({ status: 200, type: PengajuanSopWorkbenchResponseDto })
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  async getSopDokumen(
    @Req() req: Request & { user: JwtAccessPayload },
    @Param('pengajuanId', ParseUUIDPipe) pengajuanId: string,
    @Param('detailSopId', ParseUUIDPipe) detailSopId: string,
    @Query() query: PengajuanSopDokumenQueryDto,
  ): Promise<ApiSuccessResponse<PengajuanSopWorkbenchResponseDto>> {
    const logsLimit = query.logsLimit ?? 100;
    const data = await this.pengajuanEvaluasiDetailService.getSopDokumen(
      req.user,
      pengajuanId,
      detailSopId,
      logsLimit,
      query.arsip,
    );
    return {
      message: 'Dokumen SOP pengajuan evaluasi berhasil diambil',
      success: true,
      data,
    };
  }

  @Get(':pengajuanId/berita-acara')
  @Roles(
    PeranPengguna.PJ_EVALUATOR,
    PeranPengguna.EVALUATOR,
    PeranPengguna.PENYUSUN,
    PeranPengguna.PJ_PENYUSUN,
    PeranPengguna.KEPALA_OPD,
  )
  @ApiCookieAuth(ACCESS_TOKEN_COOKIE_NAME)
  @ApiOperation({
    summary: 'Model baca Berita Acara evaluasi',
    description:
      'Agregasi nomor BA, tanggal, hasil per SOP, skor OPD, tim evaluator, dan metadata TTE (tanpa data biner tanda tangan).',
  })
  @ApiParam({ name: 'pengajuanId', format: 'uuid' })
  @ApiQuery({
    name: 'arsip',
    required: false,
    type: Boolean,
    description: 'Jika true, hanya untuk cetak arsip (wajib status SELESAI).',
  })
  @ApiResponse({ status: 200, type: BeritaAcaraEvaluasiViewDto })
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  async getBeritaAcara(
    @Req() req: Request & { user: JwtAccessPayload },
    @Param('pengajuanId', ParseUUIDPipe) pengajuanId: string,
    @Query() query: PengajuanArsipQueryDto,
  ): Promise<ApiSuccessResponse<BeritaAcaraEvaluasiViewDto>> {
    const data = await this.pengajuanEvaluasiDetailService.getBeritaAcaraView(
      req.user,
      pengajuanId,
      query.arsip,
    );
    return {
      message: 'Data Berita Acara evaluasi berhasil diambil',
      success: true,
      data,
    };
  }

  @Get(':pengajuanId')
  @Roles(
    PeranPengguna.PJ_EVALUATOR,
    PeranPengguna.EVALUATOR,
    PeranPengguna.PENYUSUN,
    PeranPengguna.PJ_PENYUSUN,
    PeranPengguna.KEPALA_OPD,
  )
  @ApiCookieAuth(ACCESS_TOKEN_COOKIE_NAME)
  @ApiOperation({
    summary: 'Ringkasan pengajuan evaluasi',
    description:
      'Metadata pengajuan, daftar SOP dalam pengajuan evaluasi, nilai per baris, dan lini masa tanpa isi dokumen besar.',
  })
  @ApiParam({ name: 'pengajuanId', format: 'uuid' })
  @ApiResponse({ status: 200, type: PengajuanEvaluasiShellDto })
  @ApiForbiddenResponse()
  @ApiNotFoundResponse()
  async getShell(
    @Req() req: Request & { user: JwtAccessPayload },
    @Param('pengajuanId', ParseUUIDPipe) pengajuanId: string,
  ): Promise<ApiSuccessResponse<PengajuanEvaluasiShellDto>> {
    const data = await this.pengajuanEvaluasiDetailService.getShell(req.user, pengajuanId);
    return {
      message: 'Detail ringkas pengajuan evaluasi berhasil diambil',
      success: true,
      data,
    };
  }
}
