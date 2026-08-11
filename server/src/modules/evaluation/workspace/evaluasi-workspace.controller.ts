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
import { EvaluasiWorkspaceQueryDto } from './dto/evaluasi-workspace-query.dto';
import { EvaluasiWorkspaceOpdResponseDto } from './dto/evaluasi-workspace-response.dto';
import { EvaluasiWorkspaceService } from './evaluasi-workspace.service';

@ApiTags('Evaluasi')
@Controller('evaluasi/workspace')
@UseJwtAndRolesGuards()
export class EvaluasiWorkspaceController {
  constructor(private readonly evaluasiWorkspaceService: EvaluasiWorkspaceService) {}

  @Get('opd-saya')
  @Roles(PeranPengguna.PJ_PENYUSUN, PeranPengguna.KEPALA_OPD)
  @ApiCookieAuth(ACCESS_TOKEN_COOKIE_NAME)
  @ApiOperation({
    summary: 'Evaluasi OPD pengguna (tanpa param opdId)',
    description:
      'OPD diambil dari akun JWT. Dipakai dialog buka pengajuan PJ Penyusun dan layar terkait Kepala OPD.',
  })
  @ApiQuery({ name: 'detailSopId', required: false, format: 'uuid' })
  @ApiQuery({
    name: 'expand',
    required: false,
    description: 'Contoh: `preview` (butuh detailSopId)',
  })
  @ApiQuery({
    name: 'riwayatLimit',
    required: false,
    description: '1–50, default 30',
    schema: { default: 30, minimum: 1, maximum: 50 },
  })
  @ApiResponse({ status: 200, type: EvaluasiWorkspaceOpdResponseDto })
  @ApiForbiddenResponse({ description: 'Bukan PJ_PENYUSUN/KEPALA_OPD atau OPD tidak ditemukan' })
  async getWorkspaceOpdSaya(
    @Req() req: Request & { user: JwtAccessPayload },
    @Query() query: EvaluasiWorkspaceQueryDto,
  ): Promise<ApiSuccessResponse<EvaluasiWorkspaceOpdResponseDto>> {
    const data = await this.evaluasiWorkspaceService.getWorkspaceOpdSaya(req.user, query);
    return {
      message: 'Data evaluasi berhasil diambil',
      success: true,
      data,
    };
  }

  @Get('opd/:opdId')
  @Roles(PeranPengguna.EVALUATOR, PeranPengguna.PJ_EVALUATOR, PeranPengguna.PJ_PENYUSUN)
  @ApiCookieAuth(ACCESS_TOKEN_COOKIE_NAME)
  @ApiOperation({
    summary: 'Evaluasi per OPD (agregat untuk halaman evaluator)',
    description:
      'Menggabungkan OPD, daftar SOP alur evaluasi, pengajuan aktif, riwayat terbatas, dan pratinjau area kerja opsional saat `expand=preview` + `detailSopId`. PJ Penyusun hanya dapat membuka area kerja OPD sendiri.',
  })
  @ApiParam({ name: 'opdId', format: 'uuid' })
  @ApiQuery({ name: 'detailSopId', required: false, format: 'uuid' })
  @ApiQuery({
    name: 'expand',
    required: false,
    description: 'Contoh: `preview` (butuh detailSopId)',
  })
  @ApiQuery({
    name: 'riwayatLimit',
    required: false,
    description: '1–50, default 30',
    schema: { default: 30, minimum: 1, maximum: 50 },
  })
  @ApiResponse({ status: 200, type: EvaluasiWorkspaceOpdResponseDto })
  @ApiForbiddenResponse({
    description: 'Bukan EVALUATOR/PJ_EVALUATOR/PJ_PENYUSUN atau OPD tidak sesuai',
  })
  @ApiNotFoundResponse({ description: 'OPD tidak ditemukan' })
  async getWorkspaceOpd(
    @Req() req: Request & { user: JwtAccessPayload },
    @Param('opdId', ParseUUIDPipe) opdId: string,
    @Query() query: EvaluasiWorkspaceQueryDto,
  ): Promise<ApiSuccessResponse<EvaluasiWorkspaceOpdResponseDto>> {
    const data = await this.evaluasiWorkspaceService.getWorkspaceOpd(req.user, opdId, query);
    return {
      message: 'Data evaluasi berhasil diambil',
      success: true,
      data,
    };
  }

  @Get('pengajuan/:pengajuanEvaluasiId')
  @Roles(PeranPengguna.EVALUATOR, PeranPengguna.PJ_EVALUATOR)
  @ApiCookieAuth(ACCESS_TOKEN_COOKIE_NAME)
  @ApiOperation({
    summary: 'Evaluasi untuk satu pengajuan (daftar SOP = anggota pengajuan evaluasi)',
    description:
      'Sama bentuk respons dengan GET `.../workspace/opd/:opdId`, tetapi `daftarSop` dan `pengajuanAktif` selalu terikat pada `pengajuanEvaluasiId` yang diminta.',
  })
  @ApiParam({ name: 'pengajuanEvaluasiId', format: 'uuid' })
  @ApiResponse({ status: 200, type: EvaluasiWorkspaceOpdResponseDto })
  @ApiForbiddenResponse({ description: 'Bukan EVALUATOR atau PJ_EVALUATOR' })
  @ApiNotFoundResponse({ description: 'Pengajuan atau OPD tidak ditemukan' })
  async getWorkspacePengajuan(
    @Req() req: Request & { user: JwtAccessPayload },
    @Param('pengajuanEvaluasiId', ParseUUIDPipe) pengajuanEvaluasiId: string,
    @Query() query: EvaluasiWorkspaceQueryDto,
  ): Promise<ApiSuccessResponse<EvaluasiWorkspaceOpdResponseDto>> {
    const data = await this.evaluasiWorkspaceService.getWorkspacePengajuan(
      req.user,
      pengajuanEvaluasiId,
      query,
    );
    return {
      message: 'Data evaluasi pengajuan berhasil diambil',
      success: true,
      data,
    };
  }
}
