import { Body, Controller, Get, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard, type ApiSuccessResponse } from '../../../common';
import { ACCESS_TOKEN_COOKIE_NAME, type JwtAccessPayload } from '../../core/auth/helpers/auth.shared';
import type { SopQualityFinding } from '../ai-review/sop-ai-review.types';
import { SuggestAiRevisionDto } from './dto/suggest-ai-revision.dto';
import { SopAiRevisionService } from './sop-ai-revision.service';
import type { SuggestAiRevisionResponse } from './sop-ai-revision.types';

@ApiTags('SOP AI Revisions')
@Controller('sop')
@UseGuards(JwtAuthGuard)
@ApiCookieAuth(ACCESS_TOKEN_COOKIE_NAME)
export class SopAiRevisionController {
  constructor(private readonly service: SopAiRevisionService) {}

  @Get('ai-revisions/availability')
  @ApiOperation({ summary: 'Status ketersediaan AI-assisted revision SOP' })
  availability(): ApiSuccessResponse<{ enabled: boolean }> {
    return {
      message: 'Status AI revision berhasil diambil',
      success: true,
      data: this.service.availability(),
    };
  }

  @Post(':detailSopId/ai-revisions/suggest')
  @HttpCode(200)
  @ApiOperation({ summary: 'Buat satu usulan revisi tekstual transient untuk SOP draft' })
  async suggest(
    @Req() req: Request & { user: JwtAccessPayload },
    @Param('detailSopId') detailSopId: string,
    @Body() body: SuggestAiRevisionDto,
  ): Promise<ApiSuccessResponse<SuggestAiRevisionResponse>> {
    return {
      message: 'Usulan perbaikan SOP berhasil dibuat',
      success: true,
      data: await this.service.suggest(
        req.user,
        detailSopId,
        body.finding as unknown as SopQualityFinding,
      ),
    };
  }
}
