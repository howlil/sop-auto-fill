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
  Req,
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
import type { Request } from 'express';
import { type ApiSuccessResponse, Roles, UseJwtAndRolesGuards } from '../../../common';
import { PeranPengguna } from '../../../generated/prisma';
import { ACCESS_TOKEN_COOKIE_NAME, type JwtAccessPayload } from '../auth/helpers/auth.shared';
import { CreateOpdDto } from './dto/create-opd.dto';
import { UpdateOpdDto } from './dto/update-opd.dto';
import { OpdMutasiResponseDto } from './dto/opd-mutasi-response.dto';
import { OpdRingkasResponseDto } from './dto/opd-ringkas-response.dto';
import { OpdService } from './opd.service';

@ApiTags('OPD')
@Controller('opd')
@UseJwtAndRolesGuards()
export class OpdController {
  constructor(private readonly opdService: OpdService) {}

  @Get()
  @ApiCookieAuth(ACCESS_TOKEN_COOKIE_NAME)
  @ApiOperation({ summary: 'Daftar OPD (ringkas)' })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Filter nama OPD (substring; untuk PJ_EVALUATOR)',
  })
  @ApiResponse({ status: 200, description: 'Berhasil', type: [OpdRingkasResponseDto] })
  async findAll(
    @Req() req: Request & { user: JwtAccessPayload },
    @Query('search') search?: string,
  ): Promise<ApiSuccessResponse<OpdRingkasResponseDto[]>> {
    const data = await this.opdService.listRingkas(req.user, search);
    return {
      message: 'Daftar OPD berhasil diambil',
      success: true,
      data,
    };
  }

  @Post()
  @Roles(PeranPengguna.PJ_EVALUATOR)
  @HttpCode(HttpStatus.CREATED)
  @ApiCookieAuth(ACCESS_TOKEN_COOKIE_NAME)
  @ApiOperation({ summary: 'Buat OPD (Biro Organisasi)' })
  @ApiResponse({ status: 201, description: 'Dibuat', type: OpdMutasiResponseDto })
  @ApiForbiddenResponse({ description: 'Bukan PJ_EVALUATOR' })
  async create(@Body() dto: CreateOpdDto): Promise<ApiSuccessResponse<OpdMutasiResponseDto>> {
    const data = await this.opdService.create(dto);
    return {
      message: 'OPD berhasil dibuat',
      success: true,
      data,
    };
  }

  @Patch(':id')
  @Roles(PeranPengguna.PJ_EVALUATOR)
  @ApiCookieAuth(ACCESS_TOKEN_COOKIE_NAME)
  @ApiOperation({ summary: 'Perbarui nama OPD (Biro Organisasi)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Diperbarui', type: OpdMutasiResponseDto })
  @ApiResponse({ status: 404, description: 'Tidak ditemukan' })
  @ApiForbiddenResponse({ description: 'Bukan PJ_EVALUATOR' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOpdDto,
  ): Promise<ApiSuccessResponse<OpdMutasiResponseDto>> {
    const data = await this.opdService.update(id, dto);
    return {
      message: 'OPD berhasil diperbarui',
      success: true,
      data,
    };
  }

  @Delete(':id')
  @Roles(PeranPengguna.PJ_EVALUATOR)
  @ApiCookieAuth(ACCESS_TOKEN_COOKIE_NAME)
  @ApiOperation({ summary: 'Nonaktifkan OPD (Biro Organisasi)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Berhasil dinonaktifkan' })
  @ApiResponse({ status: 409, description: 'Konflik data terkait' })
  @ApiForbiddenResponse({ description: 'Bukan PJ_EVALUATOR' })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<ApiSuccessResponse<null>> {
    await this.opdService.softDelete(id);
    return {
      message: 'OPD berhasil dinonaktifkan',
      success: true,
      data: null,
    };
  }
}
