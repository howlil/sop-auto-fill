import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard, type ApiSuccessResponse } from '../../../common';
import { ACCESS_TOKEN_COOKIE_NAME, type JwtAccessPayload } from '../../core/auth/helpers/auth.shared';
import { CreateSopFromTemplateDto } from './dto/create-sop-from-template.dto';
import { TemplatePreviewQueryDto } from './dto/template-preview-query.dto';
import { SopTemplateService } from './sop-template.service';
import type { SopTemplateCreateIdentity, SopTemplatePreview, SopTemplateSummary } from './sop-template.types';

@ApiTags('SOP Templates')
@Controller('sop/templates')
@UseGuards(JwtAuthGuard)
@ApiCookieAuth(ACCESS_TOKEN_COOKIE_NAME)
export class SopTemplateController {
  constructor(private readonly service: SopTemplateService) {}

  @Get()
  @ApiOperation({ summary: 'Daftar system template SOP aktif' })
  async list(): Promise<ApiSuccessResponse<SopTemplateSummary[]>> {
    return { message: 'Daftar template SOP berhasil diambil', success: true, data: await this.service.list() };
  }

  @Get(':templateId/preview')
  @ApiOperation({ summary: 'Preview reuse/create pelaksana sebelum membuat SOP' })
  async preview(
    @Req() req: Request & { user: JwtAccessPayload },
    @Param('templateId', ParseUUIDPipe) templateId: string,
    @Query() query: TemplatePreviewQueryDto,
  ): Promise<ApiSuccessResponse<SopTemplatePreview>> {
    return {
      message: 'Preview template SOP berhasil diambil',
      success: true,
      data: await this.service.preview(req.user, templateId, query.workspaceId),
    };
  }

  @Post(':templateId/create')
  @HttpCode(201)
  @ApiOperation({ summary: 'Buat SOP draft dari system template' })
  async create(
    @Req() req: Request & { user: JwtAccessPayload },
    @Param('templateId', ParseUUIDPipe) templateId: string,
    @Body() dto: CreateSopFromTemplateDto,
  ): Promise<ApiSuccessResponse<SopTemplateCreateIdentity>> {
    return {
      message: 'SOP dari template berhasil dibuat',
      success: true,
      data: await this.service.create(req.user, templateId, dto),
    };
  }
}
