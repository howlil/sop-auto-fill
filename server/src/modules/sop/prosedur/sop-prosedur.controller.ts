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
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard, type ApiSuccessResponse } from '../../../common';
import {
  ACCESS_TOKEN_COOKIE_NAME,
  type JwtAccessPayload,
} from '../../core/auth/helpers/auth.shared';
import { PenyusunWorkbenchDataDto } from '../catalog/dto/penyusun-workbench-data.dto';
import { UpdateSopProsedurDto } from './dto/update-sop-prosedur.dto';
import { SopProsedurService } from './sop-prosedur.service';

@ApiTags('SOP')
@Controller('sop/langkah')
@UseGuards(JwtAuthGuard)
@ApiCookieAuth(ACCESS_TOKEN_COOKIE_NAME)
export class SopProsedurController {
  constructor(private readonly sopProsedurService: SopProsedurService) {}

  @Patch(':detailSopId')
  @ApiOperation({ summary: 'Simpan jalur pelaksana dan langkah prosedur SOP' })
  @ApiResponse({ status: 200, type: PenyusunWorkbenchDataDto })
  async updateProsedur(
    @Req() req: Request & { user: JwtAccessPayload },
    @Param('detailSopId', ParseUUIDPipe) detailSopId: string,
    @Body() dto: UpdateSopProsedurDto,
    @Query('logsLimit', new DefaultValuePipe(100), ParseIntPipe) logsLimit: number,
  ): Promise<ApiSuccessResponse<PenyusunWorkbenchDataDto>> {
    return {
      message: 'Prosedur SOP berhasil diperbarui',
      success: true,
      data: await this.sopProsedurService.updateProsedur(
        req.user,
        detailSopId,
        dto,
        logsLimit,
      ),
    };
  }
}
