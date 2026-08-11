import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req } from '@nestjs/common';
import {
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
import { CreatePengajuanEvaluasiDto } from './dto/create-pengajuan-evaluasi.dto';
import { PengajuanEvaluasiListQueryDto } from './dto/pengajuan-evaluasi-list-query.dto';
import { PengajuanEvaluasiRingkasQueryDto } from './dto/pengajuan-evaluasi-ringkas-query.dto';
import { PengajuanEvaluasiService } from '../pengajuan/pengajuan-evaluasi.service';

@ApiTags('Evaluasi')
@Controller('evaluasi')
@UseJwtAndRolesGuards()
export class PengajuanEvaluasiController {
  constructor(private readonly pengajuanEvaluasiService: PengajuanEvaluasiService) {}

  @Get()
  @Roles(
    PeranPengguna.PJ_EVALUATOR,
    PeranPengguna.EVALUATOR,
    PeranPengguna.PENYUSUN,
    PeranPengguna.PJ_PENYUSUN,
    PeranPengguna.KEPALA_OPD,
  )
  @ApiCookieAuth(ACCESS_TOKEN_COOKIE_NAME)
  @ApiOperation({
    summary: 'Daftar pengajuan evaluasi',
    description:
      'PJ Evaluator dan Evaluator melihat seluruh pengajuan (dapat difilter). PJ Penyusun dan Kepala OPD hanya melihat pengajuan untuk OPD-nya. Filter beberapa status pakai query `statusIn` (diulang per nilai atau koma); bila digunakan, lebih diutamakan daripada `status` tunggal.',
  })
  @ApiResponse({ status: 200, description: 'Daftar muatan data pengajuan selaras kontrak klien' })
  @ApiForbiddenResponse({ description: 'Peran tidak diizinkan' })
  async findAll(
    @Req() req: Request & { user: JwtAccessPayload },
    @Query() query: PengajuanEvaluasiListQueryDto,
  ): Promise<ApiSuccessResponse<Record<string, unknown>[]>> {
    const data = await this.pengajuanEvaluasiService.findAll(req.user, query);
    return {
      message: 'Daftar pengajuan evaluasi berhasil diambil',
      success: true,
      data,
    };
  }

  @Get('ringkas')
  @Roles(
    PeranPengguna.PJ_EVALUATOR,
    PeranPengguna.EVALUATOR,
    PeranPengguna.PENYUSUN,
    PeranPengguna.PJ_PENYUSUN,
    PeranPengguna.KEPALA_OPD,
  )
  @ApiCookieAuth(ACCESS_TOKEN_COOKIE_NAME)
  @ApiOperation({
    summary: 'Daftar pengajuan evaluasi ringkas (terpaginasi)',
    description:
      'Payload ringan untuk tabel dashboard: OPD, status, jenis, progres penilaian SOP. PJ Evaluator dan Evaluator melihat seluruh pengajuan (filter/search). PJ Penyusun dan Kepala OPD terbatas OPD sendiri.',
  })
  @ApiResponse({ status: 200 })
  @ApiForbiddenResponse({ description: 'Peran tidak diizinkan' })
  async findAllRingkas(
    @Req() req: Request & { user: JwtAccessPayload },
    @Query() query: PengajuanEvaluasiRingkasQueryDto,
  ): Promise<ApiSuccessResponse<Record<string, unknown>>> {
    const data = await this.pengajuanEvaluasiService.findAllRingkas(req.user, query);
    return {
      message: 'Daftar ringkas pengajuan evaluasi berhasil diambil',
      success: true,
      data,
    };
  }

  @Get(':pengajuanEvaluasiId')
  @Roles(
    PeranPengguna.PJ_EVALUATOR,
    PeranPengguna.EVALUATOR,
    PeranPengguna.PENYUSUN,
    PeranPengguna.PJ_PENYUSUN,
    PeranPengguna.KEPALA_OPD,
  )
  @ApiCookieAuth(ACCESS_TOKEN_COOKIE_NAME)
  @ApiOperation({ summary: 'Detail satu pengajuan evaluasi (beserta nilai & riwayat ringkas)' })
  @ApiParam({ name: 'pengajuanEvaluasiId', format: 'uuid' })
  @ApiResponse({ status: 200 })
  @ApiForbiddenResponse({ description: 'Tidak boleh mengakses OPD lain (PJ Penyusun/Kepala OPD)' })
  @ApiNotFoundResponse({ description: 'Pengajuan tidak ditemukan' })
  async findOne(
    @Req() req: Request & { user: JwtAccessPayload },
    @Param('pengajuanEvaluasiId', ParseUUIDPipe) pengajuanEvaluasiId: string,
  ): Promise<ApiSuccessResponse<Record<string, unknown>>> {
    const data = await this.pengajuanEvaluasiService.findOne(req.user, pengajuanEvaluasiId);
    return {
      message: 'Detail pengajuan evaluasi berhasil diambil',
      success: true,
      data,
    };
  }

  @Post()
  @Roles(PeranPengguna.PJ_PENYUSUN)
  @ApiCookieAuth(ACCESS_TOKEN_COOKIE_NAME)
  @ApiOperation({
    summary: 'Buka pengajuan evaluasi untuk sekumpulan DetailSOP satu OPD',
    description:
      'Hanya PJ Penyusun OPD. OPD diambil otomatis dari akun login. Body wajib `jenis`: EVALUASI_REQUEST_EVALUATOR (pengajuan evaluasi EVALUASI_REQUEST_EVALUATOR; evaluator wajib mengisi skor OPD 1-5 saat PATCH selesai) atau EVALUASI_REQUEST_OPD (tanpa penilaian OPD tingkat pengajuan). Hanya DetailSOP berstatus MENUNGGU_PENGAJUAN_EVALUASI yang dapat diajukan. Membuat pengajuan SEDANG_DIEVALUASI, baris NilaiEvaluasi per dokumen, dan menyelaraskan status DetailSOP ke SEDANG_DIEVALUASI.',
  })
  @ApiResponse({ status: 201 })
  @ApiForbiddenResponse({ description: 'Bukan PJ Penyusun atau OPD tidak sesuai' })
  async create(
    @Req() req: Request & { user: JwtAccessPayload },
    @Body() dto: CreatePengajuanEvaluasiDto,
  ): Promise<ApiSuccessResponse<Record<string, unknown>>> {
    const data = await this.pengajuanEvaluasiService.create(req.user, dto);
    return {
      message: 'Pengajuan evaluasi berhasil dibuat',
      success: true,
      data,
    };
  }
}
