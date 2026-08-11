import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { type ApiSuccessResponse, Roles, UseJwtAndRolesGuards } from '../../../common';
import { PeranPengguna } from '../../../generated/prisma';
import { ACCESS_TOKEN_COOKIE_NAME } from '../../core/auth/helpers/auth.shared';
import { EvaluasiGrafikTahunanQueryDto } from './dto/evaluasi-grafik-tahunan-query.dto';
import { EvaluasiGrafikTahunanResponseDto } from './dto/evaluasi-grafik-tahunan-response.dto';
import { EvaluasiGrafikService } from './evaluasi-grafik.service';

@ApiTags('Evaluasi')
@Controller('evaluasi/laporan')
@UseJwtAndRolesGuards()
export class EvaluasiGrafikController {
  constructor(private readonly evaluasiGrafikService: EvaluasiGrafikService) {}

  @Get('grafik-tahunan')
  @Roles(PeranPengguna.PJ_EVALUATOR)
  @ApiCookieAuth(ACCESS_TOKEN_COOKIE_NAME)
  @ApiOperation({
    summary: 'Laporan grafik evaluasi tahunan (PJ Evaluator)',
    description:
      'Statistik agregat per tahun kalender dan per OPD aktif untuk dasbor grafik evaluasi. Query `tahun` = satu tahun saja (jika `tahunDari`/`tahunSampai` tidak dikirim). Tanpa query: rentang default lima tahun terakhir termasuk tahun berjalan.',
  })
  @ApiResponse({ status: 200, type: EvaluasiGrafikTahunanResponseDto })
  @ApiForbiddenResponse({ description: 'Bukan PJ_EVALUATOR' })
  async getGrafikTahunan(
    @Query() query: EvaluasiGrafikTahunanQueryDto,
  ): Promise<ApiSuccessResponse<EvaluasiGrafikTahunanResponseDto>> {
    const data = await this.evaluasiGrafikService.getGrafikTahunan(query);
    return {
      message: 'Data grafik evaluasi tahunan berhasil diambil',
      success: true,
      data,
    };
  }
}
