import { Controller, Get, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard, type ApiSuccessResponse } from '../../../common';
import { ACCESS_TOKEN_COOKIE_NAME, type JwtAccessPayload } from '../../core/auth/helpers/auth.shared';
import { SopAiReviewService, type SopAiReviewResponse } from './sop-ai-review.service';

@ApiTags('SOP AI Reviews')
@Controller('sop')
@UseGuards(JwtAuthGuard)
@ApiCookieAuth(ACCESS_TOKEN_COOKIE_NAME)
export class SopAiReviewController {
  constructor(private readonly service: SopAiReviewService) {}

  @Get('ai-reviews/availability')
  @ApiOperation({ summary: 'Status ketersediaan AI quality review SOP' })
  availability(): ApiSuccessResponse<{ enabled: boolean }> {
    return {
      message: 'Status AI review berhasil diambil',
      success: true,
      data: this.service.availability(),
    };
  }

  @Post(':detailSopId/ai-review')
  @HttpCode(200)
  @ApiOperation({ summary: 'Review kualitas snapshot SOP draft yang tersimpan' })
  async review(
    @Req() req: Request & { user: JwtAccessPayload },
    @Param('detailSopId') detailSopId: string,
  ): Promise<ApiSuccessResponse<SopAiReviewResponse>> {
    return {
      message: 'Review kualitas SOP berhasil dibuat',
      success: true,
      data: await this.service.review(req.user, detailSopId),
    };
  }
}
