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
import { UpdateSopDiagramDto } from './dto/diagram-path-overrides.dto';
import { SopDiagramService } from './sop-diagram.service';

@ApiTags('SOP')
@Controller('sop/diagram')
@UseGuards(JwtAuthGuard)
@ApiCookieAuth(ACCESS_TOKEN_COOKIE_NAME)
export class SopDiagramController {
  constructor(private readonly sopDiagramService: SopDiagramService) {}

  @Patch(':detailSopId')
  @ApiOperation({ summary: 'Simpan konfigurasi Flowchart/BPMN dan path override manual' })
  @ApiResponse({ status: 200, type: PenyusunWorkbenchDataDto })
  async updateDiagram(
    @Req() req: Request & { user: JwtAccessPayload },
    @Param('detailSopId', ParseUUIDPipe) detailSopId: string,
    @Body() dto: UpdateSopDiagramDto,
    @Query('logsLimit', new DefaultValuePipe(100), ParseIntPipe) logsLimit: number,
  ): Promise<ApiSuccessResponse<PenyusunWorkbenchDataDto>> {
    return {
      message: 'Konfigurasi diagram berhasil diperbarui',
      success: true,
      data: await this.sopDiagramService.updateDiagram(
        req.user,
        detailSopId,
        dto,
        logsLimit,
      ),
    };
  }
}
