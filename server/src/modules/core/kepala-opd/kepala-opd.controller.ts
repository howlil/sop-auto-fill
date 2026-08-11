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
import { CreateKepalaOpdDto } from './dto/create-kepala-opd.dto';
import { KepalaOpdPublicDto } from './dto/kepala-opd-public.dto';
import { KepalaOpdRiwayatItemDto } from './dto/kepala-opd-riwayat-item.dto';
import { UpdateKepalaOpdDto } from './dto/update-kepala-opd.dto';
import { KepalaOpdService } from './kepala-opd.service';

@ApiTags('Kepala OPD')
@Controller('kepala-opd')
@UseJwtAndRolesGuards()
@Roles(PeranPengguna.PJ_EVALUATOR)
export class KepalaOpdController {
  constructor(private readonly kepalaOpdService: KepalaOpdService) {}

  @Get()
  @ApiCookieAuth(ACCESS_TOKEN_COOKIE_NAME)
  @ApiOperation({ summary: 'Daftar semua Kepala OPD (Biro Organisasi)' })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Filter nama, NIP, atau email (substring)',
  })
  @ApiResponse({ status: 200, type: [KepalaOpdPublicDto] })
  @ApiForbiddenResponse({ description: 'Bukan PJ_EVALUATOR' })
  async findAll(
    @Query('search') search?: string,
  ): Promise<ApiSuccessResponse<KepalaOpdPublicDto[]>> {
    const data = await this.kepalaOpdService.findAll(search);
    return {
      message: 'Daftar Kepala OPD berhasil diambil',
      success: true,
      data,
    };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiCookieAuth(ACCESS_TOKEN_COOKIE_NAME)
  @ApiOperation({ summary: 'Buat akun Kepala OPD baru (sandi awal default server)' })
  @ApiResponse({ status: 201, type: KepalaOpdPublicDto })
  @ApiForbiddenResponse({ description: 'Bukan PJ_EVALUATOR' })
  async create(@Body() dto: CreateKepalaOpdDto): Promise<ApiSuccessResponse<KepalaOpdPublicDto>> {
    const data = await this.kepalaOpdService.create(dto);
    return {
      message: 'Kepala OPD berhasil ditambahkan',
      success: true,
      data,
    };
  }

  @Patch(':id')
  @ApiCookieAuth(ACCESS_TOKEN_COOKIE_NAME)
  @ApiOperation({ summary: 'Perbarui data Kepala OPD (termasuk nonaktif / pindah OPD)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: KepalaOpdPublicDto })
  @ApiForbiddenResponse({ description: 'Bukan PJ_EVALUATOR' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateKepalaOpdDto,
  ): Promise<ApiSuccessResponse<KepalaOpdPublicDto>> {
    const data = await this.kepalaOpdService.update(id, dto);
    return {
      message: 'Kepala OPD berhasil diperbarui',
      success: true,
      data,
    };
  }

  @Delete(':id')
  @ApiCookieAuth(ACCESS_TOKEN_COOKIE_NAME)
  @ApiOperation({ summary: 'Nonaktifkan Kepala OPD (tolak jika masih ada SOP dibuat)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200 })
  @ApiForbiddenResponse({ description: 'Bukan PJ_EVALUATOR' })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<ApiSuccessResponse<null>> {
    await this.kepalaOpdService.remove(id);
    return {
      message: 'Kepala OPD berhasil dinonaktifkan',
      success: true,
      data: null,
    };
  }

  @Get(':id/riwayat-opd')
  @ApiCookieAuth(ACCESS_TOKEN_COOKIE_NAME)
  @ApiOperation({ summary: 'Riwayat OPD yang pernah / sedang dijabat oleh Kepala OPD' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: [KepalaOpdRiwayatItemDto] })
  @ApiForbiddenResponse({ description: 'Bukan PJ_EVALUATOR' })
  async riwayatOpd(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiSuccessResponse<KepalaOpdRiwayatItemDto[]>> {
    const data = await this.kepalaOpdService.listRiwayatOpd(id);
    return {
      message: 'Riwayat penugasan OPD berhasil diambil',
      success: true,
      data,
    };
  }
}
