import {
  Body,
  Controller,
  DefaultValuePipe,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCookieAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
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
import { PenyusunWorkbenchDataDto } from '../catalog/dto/penyusun-workbench-data.dto';
import { UpdateSopProsedurDto } from './dto/update-sop-prosedur.dto';
import { SopProsedurService } from './sop-prosedur.service';

@ApiTags('SOP')
@Controller('sop/langkah')
@UseJwtAndRolesGuards()
export class SopProsedurController {
  constructor(private readonly sopProsedurService: SopProsedurService) {}

  @Patch(':detailSopId')
  @Roles(PeranPengguna.PENYUSUN, PeranPengguna.PJ_PENYUSUN)
  @ApiCookieAuth(ACCESS_TOKEN_COOKIE_NAME)
  @ApiOperation({
    summary:
      'PATCH prosedur SOP penyusun (jalur pelaksana DetailSOPPelaksana + LangkahSOP). Param :detailSopId boleh DetailSOP atau SOP header (versi terbaru dipakai). Ganti semua per bagian bila dikirim; aman untuk simpan otomatis tertunda.',
  })
  @ApiQuery({
    name: 'logsLimit',
    required: false,
    description: 'Jumlah maksimum entri logEdit pada respons penyegaran (1-500, default 100)',
    schema: { default: 100, minimum: 1, maximum: 500 },
  })
  @ApiResponse({ status: 200, type: PenyusunWorkbenchDataDto })
  @ApiBadRequestResponse({ description: 'Validasi DTO gagal / referensi tempId tidak konsisten' })
  @ApiConflictResponse({ description: 'Konflik integritas (mis. pelaksana lintas OPD)' })
  @ApiForbiddenResponse()
  @ApiNotFoundResponse({ description: 'DetailSOP tidak ditemukan' })
  async updateProsedur(
    @Req() req: Request & { user: JwtAccessPayload },
    @Param('detailSopId', ParseUUIDPipe) detailSopId: string,
    @Body() dto: UpdateSopProsedurDto,
    @Query('logsLimit', new DefaultValuePipe(100), ParseIntPipe) logsLimit: number,
  ): Promise<ApiSuccessResponse<PenyusunWorkbenchDataDto>> {
    const data = await this.sopProsedurService.updateProsedur(
      req.user,
      detailSopId,
      dto,
      logsLimit,
    );
    return {
      message: 'Prosedur SOP berhasil diperbarui',
      success: true,
      data,
    };
  }
}
