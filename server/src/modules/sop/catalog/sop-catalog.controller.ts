import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
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
import { CreateSopDto } from './dto/create-sop.dto';
import { ListSopQueryDto } from './dto/list-sop-query.dto';
import { PenyusunWorkbenchDataDto } from './dto/penyusun-workbench-data.dto';
import { SopDaftarRowDto } from './dto/sop-daftar-row.dto';
import { SopRiwayatVersiRowDto } from './dto/sop-riwayat-versi-row.dto';
import { UpdateDetailSopStatusDto } from './dto/update-detail-sop-status.dto';
import { UpdateSopHeaderDto } from './dto/update-sop-header.dto';
import { SopCatalogService } from './sop-catalog.service';

@ApiTags('SOP')
@Controller('sop')
@UseGuards(JwtAuthGuard)
@ApiCookieAuth(ACCESS_TOKEN_COOKIE_NAME)
export class SopCatalogController {
  constructor(private readonly sopCatalogService: SopCatalogService) {}

  @Get('penyusun-workbench/:detailSopId')
  @ApiOperation({ summary: 'Ambil seluruh data editor SOP' })
  @ApiResponse({ status: 200, type: PenyusunWorkbenchDataDto })
  async getPenyusunWorkbench(
    @Req() req: Request & { user: JwtAccessPayload },
    @Param('detailSopId', ParseUUIDPipe) detailSopId: string,
    @Query('logsLimit', new DefaultValuePipe(100), ParseIntPipe) logsLimit: number,
  ): Promise<ApiSuccessResponse<PenyusunWorkbenchDataDto>> {
    return {
      message: 'Data area kerja SOP berhasil diambil',
      success: true,
      data: await this.sopCatalogService.getPenyusunWorkbench(req.user, detailSopId, logsLimit),
    };
  }

  @Get()
  @ApiOperation({ summary: 'Daftar SOP dalam workspace milik user' })
  @ApiResponse({ status: 200, type: [SopDaftarRowDto] })
  async list(
    @Req() req: Request & { user: JwtAccessPayload },
    @Query() query: ListSopQueryDto,
  ): Promise<ApiSuccessResponse<SopDaftarRowDto[]>> {
    return {
      message: 'Daftar SOP berhasil diambil',
      success: true,
      data: await this.sopCatalogService.listForCurrentUser(req.user, query),
    };
  }

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Buat SOP baru di dalam workspace' })
  @ApiResponse({ status: 201, type: SopDaftarRowDto })
  async create(
    @Req() req: Request & { user: JwtAccessPayload },
    @Body() dto: CreateSopDto,
  ): Promise<ApiSuccessResponse<SopDaftarRowDto>> {
    return {
      message: 'SOP berhasil dibuat',
      success: true,
      data: await this.sopCatalogService.createForPenyusun(req.user, dto),
    };
  }

  @Patch('status/:detailSopId')
  @ApiOperation({ summary: 'Ubah status project SOP menjadi COMPLETED atau ARCHIVED' })
  @ApiResponse({ status: 200, type: PenyusunWorkbenchDataDto })
  async updateStatus(
    @Req() req: Request & { user: JwtAccessPayload },
    @Param('detailSopId', ParseUUIDPipe) detailSopId: string,
    @Body() dto: UpdateDetailSopStatusDto,
    @Query('logsLimit', new DefaultValuePipe(100), ParseIntPipe) logsLimit: number,
  ): Promise<ApiSuccessResponse<PenyusunWorkbenchDataDto>> {
    return {
      message: 'Status SOP berhasil diperbarui',
      success: true,
      data: await this.sopCatalogService.transitionDetailSopStatus(
        req.user,
        detailSopId,
        dto,
        logsLimit,
      ),
    };
  }

  @Patch('header/:detailSopId')
  @ApiOperation({ summary: 'Simpan metadata/header SOP' })
  @ApiResponse({ status: 200, type: PenyusunWorkbenchDataDto })
  async updateHeader(
    @Req() req: Request & { user: JwtAccessPayload },
    @Param('detailSopId', ParseUUIDPipe) detailSopId: string,
    @Body() dto: UpdateSopHeaderDto,
    @Query('logsLimit', new DefaultValuePipe(100), ParseIntPipe) logsLimit: number,
  ): Promise<ApiSuccessResponse<PenyusunWorkbenchDataDto>> {
    return {
      message: 'Header SOP berhasil diperbarui',
      success: true,
      data: await this.sopCatalogService.updatePenyusunHeader(
        req.user,
        detailSopId,
        dto,
        logsLimit,
      ),
    };
  }

  @Post(':detailSopId/buat-versi-baru')
  @HttpCode(201)
  @ApiOperation({ summary: 'Clone versi COMPLETED terbaru menjadi versi DRAFT baru' })
  @ApiResponse({ status: 201, type: PenyusunWorkbenchDataDto })
  async buatVersiBaru(
    @Req() req: Request & { user: JwtAccessPayload },
    @Param('detailSopId', ParseUUIDPipe) detailSopId: string,
    @Query('logsLimit', new DefaultValuePipe(100), ParseIntPipe) logsLimit: number,
  ): Promise<ApiSuccessResponse<PenyusunWorkbenchDataDto>> {
    return {
      message: 'Versi SOP baru berhasil dibuat',
      success: true,
      data: await this.sopCatalogService.buatVersiBaru(req.user, detailSopId, logsLimit),
    };
  }

  @Get(':detailSopId/riwayat-versi')
  @ApiOperation({ summary: 'Riwayat versi SOP' })
  @ApiResponse({ status: 200, type: [SopRiwayatVersiRowDto] })
  async getRiwayatVersi(
    @Req() req: Request & { user: JwtAccessPayload },
    @Param('detailSopId', ParseUUIDPipe) detailSopId: string,
  ): Promise<ApiSuccessResponse<SopRiwayatVersiRowDto[]>> {
    return {
      message: 'Riwayat versi berhasil diambil',
      success: true,
      data: await this.sopCatalogService.getRiwayatVersi(req.user, detailSopId),
    };
  }

  @Delete(':detailSopId/versi-draft')
  async hapusVersiDraft(
    @Req() req: Request & { user: JwtAccessPayload },
    @Param('detailSopId', ParseUUIDPipe) detailSopId: string,
  ): Promise<ApiSuccessResponse<null>> {
    await this.sopCatalogService.hapusVersiDraft(req.user, detailSopId);
    return { message: 'Versi draft berhasil dihapus', success: true, data: null };
  }

  @Delete(':detailSopId/draft')
  async hapusSopDraftAwal(
    @Req() req: Request & { user: JwtAccessPayload },
    @Param('detailSopId', ParseUUIDPipe) detailSopId: string,
  ): Promise<ApiSuccessResponse<null>> {
    await this.sopCatalogService.hapusSopDraftAwal(req.user, detailSopId);
    return { message: 'SOP draft berhasil dihapus', success: true, data: null };
  }
}
