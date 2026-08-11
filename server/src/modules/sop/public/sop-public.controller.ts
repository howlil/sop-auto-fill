import { Controller, Get, Param, ParseUUIDPipe, Query, Res, StreamableFile } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { type ApiSuccessResponse } from '../../../common';
import { PublicArsipQueryDto } from './dto/public-arsip-query.dto';
import { PublicOpdItemDto } from './dto/public-opd-item.dto';
import { PublicSopDokumenDto } from './dto/public-sop-dokumen.dto';
import { PublicSopByOpdPageDto } from './dto/public-sop-by-opd-page.dto';
import { PublicSopItemDto } from './dto/public-sop-item.dto';
import { SopPublicService } from './sop-public.service';
import type { PaginatedData } from '../../../common/utils/pagination.util';
import type { Response } from 'express';

@ApiTags('SOP Publik')
@Controller('sop/public')
export class SopPublicController {
  constructor(private readonly sopPublicService: SopPublicService) {}

  @Get('opd')
  @ApiOperation({
    summary: 'Daftar OPD dengan SOP berlaku (arsip publik)',
    description:
      'Tidak memerlukan autentikasi. Hanya OPD yang memiliki minimal satu SOP berstatus BERLAKU.',
  })
  @ApiResponse({ status: 200, description: 'Daftar OPD terpaginated' })
  async listOpd(
    @Query() query: PublicArsipQueryDto,
  ): Promise<ApiSuccessResponse<PaginatedData<PublicOpdItemDto>>> {
    const data = await this.sopPublicService.listOpd(query);
    return {
      message: 'Daftar OPD arsip SOP berhasil diambil',
      success: true,
      data,
    };
  }

  @Get('sop')
  @ApiOperation({
    summary: 'Cari SOP berlaku lintas OPD (arsip publik)',
    description:
      'Tidak memerlukan autentikasi. Pencarian judul, nomor SOP, atau nama OPD. Hanya status BERLAKU.',
  })
  @ApiResponse({ status: 200, description: 'Daftar SOP terpaginated' })
  async listSopGlobal(
    @Query() query: PublicArsipQueryDto,
  ): Promise<ApiSuccessResponse<PaginatedData<PublicSopItemDto>>> {
    const data = await this.sopPublicService.listSopGlobal(query);
    return {
      message: 'Hasil pencarian SOP arsip berhasil diambil',
      success: true,
      data,
    };
  }

  @Get('opd/:opdId/sop')
  @ApiOperation({
    summary: 'Daftar SOP berlaku per OPD (arsip publik)',
    description: 'Tidak memerlukan autentikasi. Hanya DetailSOP berstatus BERLAKU.',
  })
  @ApiResponse({ status: 200, description: 'Daftar SOP terpaginated beserta meta OPD' })
  @ApiNotFoundResponse({ description: 'OPD tidak ditemukan' })
  async listSopByOpd(
    @Param('opdId', ParseUUIDPipe) opdId: string,
    @Query() query: PublicArsipQueryDto,
  ): Promise<ApiSuccessResponse<PublicSopByOpdPageDto>> {
    const data = await this.sopPublicService.listSopByOpd(opdId, query);
    return {
      message: 'Daftar SOP berlaku berhasil diambil',
      success: true,
      data,
    };
  }

  @Get('dokumen/:detailSopId')
  @ApiOperation({
    summary: 'Pratinjau dokumen SOP berlaku (arsip publik)',
    description:
      'Tidak memerlukan autentikasi. Mengembalikan header, lampiran, dan langkah prosedur tanpa log audit.',
  })
  @ApiResponse({ status: 200, type: PublicSopDokumenDto })
  @ApiNotFoundResponse({ description: 'Dokumen tidak ditemukan atau bukan status BERLAKU' })
  async getDokumen(
    @Param('detailSopId', ParseUUIDPipe) detailSopId: string,
  ): Promise<ApiSuccessResponse<PublicSopDokumenDto>> {
    const data = await this.sopPublicService.getDokumen(detailSopId);
    return {
      message: 'Dokumen SOP berlaku berhasil diambil',
      success: true,
      data,
    };
  }

  @Get('pdf/:detailSopId')
  @ApiOperation({
    summary: 'Stream PDF resmi SOP berlaku',
    description:
      'Tidak memerlukan autentikasi. Server mengecek status BERLAKU dan artifact PDF published setiap request.',
  })
  @ApiResponse({ status: 200, description: 'PDF SOP resmi' })
  @ApiNotFoundResponse({ description: 'PDF tidak ditemukan' })
  async getPdf(
    @Param('detailSopId', ParseUUIDPipe) detailSopId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const file = await this.sopPublicService.getPublishedPdf(detailSopId);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Length': String(file.sizeBytes),
      'Content-Disposition': `inline; filename="${file.filename}"`,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    return new StreamableFile(file.buffer);
  }
}
