import { Controller, Get, Param, ParseUUIDPipe, Req } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
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
import { UmpanBalikEvaluasiDetailDto } from './dto/umpan-balik-evaluasi-detail.dto';
import { EvaluasiUmpanBalikService } from './evaluasi-umpan-balik.service';

@ApiTags('Evaluasi')
@Controller('evaluasi/umpan-balik')
@UseJwtAndRolesGuards()
export class EvaluasiUmpanBalikController {
  constructor(private readonly evaluasiUmpanBalikService: EvaluasiUmpanBalikService) {}

  @Get('detail/:detailSopId')
  @Roles(PeranPengguna.PENYUSUN, PeranPengguna.PJ_PENYUSUN, PeranPengguna.KEPALA_OPD)
  @ApiCookieAuth(ACCESS_TOKEN_COOKIE_NAME)
  @ApiOperation({
    summary: 'Umpan balik evaluasi aktif untuk satu DetailSOP (panel penyusun)',
    description:
      'Mengembalikan baris NilaiEvaluasi dengan hasil Perlu perbaikan dalam pengajuan SEDANG_DIEVALUASI. Null jika tidak ada umpan balik aktif.',
  })
  @ApiResponse({ status: 200, type: UmpanBalikEvaluasiDetailDto })
  @ApiForbiddenResponse()
  @ApiNotFoundResponse({ description: 'Detail SOP tidak ditemukan' })
  async getForDetail(
    @Req() req: Request & { user: JwtAccessPayload },
    @Param('detailSopId', ParseUUIDPipe) detailSopId: string,
  ): Promise<ApiSuccessResponse<UmpanBalikEvaluasiDetailDto | null>> {
    const data = await this.evaluasiUmpanBalikService.getUmpanBalikForDetail(req.user, detailSopId);
    return {
      message:
        data === null
          ? 'Tidak ada umpan balik evaluasi aktif'
          : 'Umpan balik evaluasi berhasil diambil',
      success: true,
      data,
    };
  }
}
