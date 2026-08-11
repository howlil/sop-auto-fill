import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { type ApiSuccessResponse, Roles, UseJwtAndRolesGuards } from '../../../common';
import { PeranPengguna } from '../../../generated/prisma';
import { ACCESS_TOKEN_COOKIE_NAME } from '../auth/helpers/auth.shared';
import { CreatePenyusunDto } from './dto/create-penyusun.dto';
import { PindahPenyusunDto } from './dto/pindah-penyusun.dto';
import { PenyusunOpdGrupDto } from './dto/penyusun-opd-grup.dto';
import { PenyusunPublikItemDto } from './dto/penyusun-publik-item.dto';
import { RiwayatOpdPenyusunItemDto } from './dto/riwayat-opd-penyusun-item.dto';
import { UpdatePenyusunDto } from './dto/update-penyusun.dto';
import { PenyusunService } from './penyusun.service';

@ApiTags('Penyusun')
@Controller('penyusun')
@UseJwtAndRolesGuards()
@Roles(PeranPengguna.PJ_EVALUATOR)
export class PenyusunController {
  constructor(private readonly penyusunService: PenyusunService) {}

  @Get()
  @ApiCookieAuth(ACCESS_TOKEN_COOKIE_NAME)
  @ApiOperation({ summary: 'Daftar grup penyusun per OPD' })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Filter nama, NIP, atau email penyusun (substring)',
  })
  @ApiResponse({ status: 200, type: [PenyusunOpdGrupDto] })
  @ApiForbiddenResponse({ description: 'Bukan PJ_EVALUATOR' })
  async findAll(
    @Query('search') search?: string,
  ): Promise<ApiSuccessResponse<PenyusunOpdGrupDto[]>> {
    const data = await this.penyusunService.listGrup(search);
    return {
      message: 'Daftar penyusun berhasil diambil',
      success: true,
      data,
    };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiCookieAuth(ACCESS_TOKEN_COOKIE_NAME)
  @ApiOperation({ summary: 'Tambah penyusun / PJ penyusun (sandi default server)' })
  @ApiResponse({ status: 201, type: PenyusunPublikItemDto })
  async create(@Body() dto: CreatePenyusunDto): Promise<ApiSuccessResponse<PenyusunPublikItemDto>> {
    const data = await this.penyusunService.create(dto);
    return {
      message: 'Penyusun berhasil ditambahkan',
      success: true,
      data,
    };
  }

  @Get(':id/riwayat-opd')
  @ApiCookieAuth(ACCESS_TOKEN_COOKIE_NAME)
  @ApiOperation({ summary: 'Riwayat penempatan OPD penyusun (mutasi pindah)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: [RiwayatOpdPenyusunItemDto] })
  async riwayatOpd(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiSuccessResponse<RiwayatOpdPenyusunItemDto[]>> {
    const data = await this.penyusunService.listRiwayatOpdPenyusun(id);
    return {
      message: 'Riwayat OPD penyusun berhasil diambil',
      success: true,
      data,
    };
  }

  @Patch(':id/nonaktifkan')
  @ApiCookieAuth(ACCESS_TOKEN_COOKIE_NAME)
  @ApiOperation({ summary: 'Nonaktifkan penyusun' })
  @ApiParam({ name: 'id', format: 'uuid' })
  async nonaktifkan(@Param('id', ParseUUIDPipe) id: string): Promise<ApiSuccessResponse<null>> {
    await this.penyusunService.nonaktifkan(id);
    return {
      message: 'Penyusun berhasil dinonaktifkan',
      success: true,
      data: null,
    };
  }

  @Patch(':id/aktifkan')
  @ApiCookieAuth(ACCESS_TOKEN_COOKIE_NAME)
  @ApiOperation({ summary: 'Aktifkan kembali penyusun yang dinonaktifkan' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: PenyusunPublikItemDto })
  async aktifkan(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiSuccessResponse<PenyusunPublikItemDto>> {
    const data = await this.penyusunService.aktifkan(id);
    return {
      message: 'Penyusun berhasil diaktifkan kembali',
      success: true,
      data,
    };
  }

  @Patch(':id/pindah')
  @ApiCookieAuth(ACCESS_TOKEN_COOKIE_NAME)
  @ApiOperation({ summary: 'Pindahkan penyusun ke OPD lain' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: PenyusunPublikItemDto })
  async pindah(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PindahPenyusunDto,
  ): Promise<ApiSuccessResponse<PenyusunPublikItemDto>> {
    const data = await this.penyusunService.pindah(id, dto.opdId);
    return {
      message: 'Penyusun berhasil dipindahkan',
      success: true,
      data,
    };
  }

  @Patch(':id')
  @ApiCookieAuth(ACCESS_TOKEN_COOKIE_NAME)
  @ApiOperation({ summary: 'Perbarui data penyusun' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: PenyusunPublikItemDto })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePenyusunDto,
  ): Promise<ApiSuccessResponse<PenyusunPublikItemDto>> {
    const data = await this.penyusunService.update(id, dto);
    return {
      message: 'Data penyusun berhasil diperbarui',
      success: true,
      data,
    };
  }

  @Delete(':id')
  @ApiCookieAuth(ACCESS_TOKEN_COOKIE_NAME)
  @ApiOperation({ summary: 'Hapus permanen penyusun (hanya jika tidak ada relasi data)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  async hapus(@Param('id', ParseUUIDPipe) id: string): Promise<ApiSuccessResponse<null>> {
    await this.penyusunService.hapusPermanen(id);
    return {
      message: 'Penyusun berhasil dihapus permanen',
      success: true,
      data: null,
    };
  }
}
