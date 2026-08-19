import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard, type ApiSuccessResponse } from '../../../common';
import { ACCESS_TOKEN_COOKIE_NAME, type JwtAccessPayload } from '../../core/auth/helpers/auth.shared';
import type { SopDraftCreateIdentity } from '../draft/sop-draft.types';
import { CreateAiDraftDto } from './dto/create-ai-draft.dto';
import { GenerateAiDraftDto } from './dto/generate-ai-draft.dto';
import { SopAiDraftService } from './sop-ai-draft.service';
import type { AiDraftProposal } from './sop-ai-draft.types';

@ApiTags('SOP AI Drafts')
@Controller('sop/ai-drafts')
@UseGuards(JwtAuthGuard)
@ApiCookieAuth(ACCESS_TOKEN_COOKIE_NAME)
export class SopAiDraftController {
  constructor(private readonly service: SopAiDraftService) {}

  @Get('availability')
  @ApiOperation({ summary: 'Status ketersediaan AI-assisted drafting' })
  availability(): ApiSuccessResponse<{ enabled: boolean }> {
    return {
      message: 'Status AI drafting berhasil diambil',
      success: true,
      data: this.service.availability(),
    };
  }

  @Post('generate')
  @HttpCode(200)
  @ApiOperation({ summary: 'Generate preview draft SOP tanpa persistence' })
  async generate(
    @Req() req: Request & { user: JwtAccessPayload },
    @Body() dto: GenerateAiDraftDto,
  ): Promise<ApiSuccessResponse<{ proposal: AiDraftProposal }>> {
    return {
      message: 'Draft SOP AI berhasil digenerate',
      success: true,
      data: await this.service.generate(req.user, dto),
    };
  }

  @Post('create')
  @HttpCode(201)
  @ApiOperation({ summary: 'Konfirmasi proposal AI menjadi SOP draft biasa' })
  async create(
    @Req() req: Request & { user: JwtAccessPayload },
    @Body() dto: CreateAiDraftDto,
  ): Promise<ApiSuccessResponse<SopDraftCreateIdentity>> {
    return {
      message: 'SOP dari draft AI berhasil dibuat',
      success: true,
      data: await this.service.create(req.user, dto),
    };
  }
}
