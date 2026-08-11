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
import {
  ACCESS_TOKEN_COOKIE_NAME,
  type JwtAccessPayload,
} from '../../core/auth/helpers/auth.shared';
import { CreatePelaksanaDto } from './dto/create-pelaksana.dto';
import { PelaksanaResponseDto } from './dto/pelaksana-response.dto';
import { UpdatePelaksanaDto } from './dto/update-pelaksana.dto';
import { PelaksanaService } from './pelaksana.service';

@ApiTags('Pelaksana')
@Controller('pelaksana')
@UseJwtAndRolesGuards()
@Roles(PeranPengguna.PENYUSUN, PeranPengguna.PJ_PENYUSUN)
export class PelaksanaController {
  constructor(private readonly pelaksanaService: PelaksanaService) {}

  @Get()
  @ApiCookieAuth(ACCESS_TOKEN_COOKIE_NAME)
  @ApiOperation({ summary: 'Daftar pelaksana per OPD' })
  @ApiQuery({ name: 'opdId', required: false, format: 'uuid' })
  @ApiResponse({ status: 200, type: [PelaksanaResponseDto] })
  @ApiForbiddenResponse()
  async list(
    @Req() req: Request & { user: JwtAccessPayload },
    @Query('opdId') opdId?: string,
  ): Promise<ApiSuccessResponse<PelaksanaResponseDto[]>> {
    const data = await this.pelaksanaService.list(req.user, opdId);
    return {
      message: 'Daftar pelaksana berhasil diambil',
      success: true,
      data,
    };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiCookieAuth(ACCESS_TOKEN_COOKIE_NAME)
  @ApiOperation({ summary: 'Tambah pelaksana untuk OPD pengguna' })
  @ApiResponse({ status: 201, type: PelaksanaResponseDto })
  async create(
    @Req() req: Request & { user: JwtAccessPayload },
    @Body() dto: CreatePelaksanaDto,
  ): Promise<ApiSuccessResponse<PelaksanaResponseDto>> {
    const data = await this.pelaksanaService.create(req.user, dto);
    return {
      message: 'Pelaksana berhasil ditambahkan',
      success: true,
      data,
    };
  }

  @Patch(':id')
  @ApiCookieAuth(ACCESS_TOKEN_COOKIE_NAME)
  @ApiOperation({ summary: 'Perbarui nama pelaksana' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: PelaksanaResponseDto })
  async update(
    @Req() req: Request & { user: JwtAccessPayload },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePelaksanaDto,
  ): Promise<ApiSuccessResponse<PelaksanaResponseDto>> {
    const data = await this.pelaksanaService.update(req.user, id, dto);
    return {
      message: 'Pelaksana berhasil diperbarui',
      success: true,
      data,
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth(ACCESS_TOKEN_COOKIE_NAME)
  @ApiOperation({ summary: 'Hapus pelaksana jika tidak direferensikan' })
  @ApiParam({ name: 'id', format: 'uuid' })
  async remove(
    @Req() req: Request & { user: JwtAccessPayload },
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiSuccessResponse<null>> {
    await this.pelaksanaService.remove(req.user, id);
    return {
      message: 'Pelaksana berhasil dihapus',
      success: true,
      data: null,
    };
  }
}
