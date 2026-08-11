import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ApiNotFoundResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { type ApiSuccessResponse } from '../../../common';
import { PdfSigningStatusResponseDto } from '../shared/dto/pdf-signing-status-response.dto';
import { TtePengesahanPublicResponseDto } from '../shared/dto/tte-pengesahan-public-response.dto';
import { VerifyPdfDto } from '../shared/dto/verify-pdf.dto';
import { VerifyPdfResponseDto } from '../shared/dto/verify-pdf-response.dto';

import { TteService } from './tte.service';

@ApiTags('TTE Publik')
@Controller('tte/public')
export class TtePublicController {
  constructor(private readonly tteService: TteService) {}

  @Get('pengesahan/:dokumenTteId/:userId')
  @ApiOperation({
    summary: 'Verifikasi pengesahan (publik)',
    description:
      'Mengambil ringkasan data pengesahan berdasarkan pasangan junction `(dokumenTteId, userId)` — sama dengan segmen path halaman validasi publik / QR. Tidak memerlukan autentikasi.',
  })
  @ApiResponse({ status: 200, type: TtePengesahanPublicResponseDto })
  @ApiNotFoundResponse({ description: 'Riwayat pengesahan tidak ditemukan' })
  async getPengesahan(
    @Req() req: Request,
    @Param('dokumenTteId', ParseUUIDPipe) dokumenTteId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<ApiSuccessResponse<TtePengesahanPublicResponseDto>> {
    const data = await this.tteService.getPengesahanPublic(dokumenTteId, userId, req);
    return {
      message: 'Data pengesahan berhasil ditemukan',
      success: true,
      data: data as TtePengesahanPublicResponseDto,
    };
  }

  @Get('pdf-signing/status')
  @ApiOperation({
    summary: 'Status penandatanganan PDF kriptografis (publik)',
    description:
      'Menyatakan apakah server mengaktifkan PKCS#7 internal dan CA yang dipakai untuk halaman /validasi/pdf.',
  })
  @ApiResponse({ status: 200, type: PdfSigningStatusResponseDto })
  getPdfSigningStatus(): ApiSuccessResponse<PdfSigningStatusResponseDto> {
    const data = this.tteService.getPdfSigningStatus();
    return {
      message: data.enabled
        ? 'Penandatanganan PDF kriptografis aktif'
        : 'Penandatanganan PDF kriptografis nonaktif',
      success: true,
      data: data as PdfSigningStatusResponseDto,
    };
  }

  @Post('pdf/verify')
  @ApiOperation({
    summary: 'Verifikasi tanda tangan PKCS#7 pada PDF (publik)',
    description:
      'Memverifikasi signature embedded terhadap CA internal yang dikonfigurasi di server. Bukan pengganti portal Komdigi.',
  })
  @ApiResponse({ status: 200, type: VerifyPdfResponseDto })
  async verifyPdf(@Body() dto: VerifyPdfDto): Promise<ApiSuccessResponse<VerifyPdfResponseDto>> {
    const data = await this.tteService.verifyPdf(dto);
    return {
      message: data.allValid
        ? 'Semua tanda tangan PDF valid (CA internal)'
        : data.hasSignatures
          ? 'Terdapat tanda tangan PDF yang tidak valid'
          : 'PDF tidak memiliki tanda tangan digital',
      success: true,
      data: data as VerifyPdfResponseDto,
    };
  }
}
