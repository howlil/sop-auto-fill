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
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard, type ApiSuccessResponse } from '../../../common';
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
@UseGuards(JwtAuthGuard)
@ApiCookieAuth(ACCESS_TOKEN_COOKIE_NAME)
export class PelaksanaController {
  constructor(private readonly pelaksanaService: PelaksanaService) {}

  @Get()
  @ApiOperation({ summary: 'Daftar pelaksana dalam workspace' })
  @ApiQuery({ name: 'workspaceId', required: true, format: 'uuid' })
  @ApiResponse({ status: 200, type: [PelaksanaResponseDto] })
  async list(
    @Req() req: Request & { user: JwtAccessPayload },
    @Query('workspaceId', ParseUUIDPipe) workspaceId: string,
  ): Promise<ApiSuccessResponse<PelaksanaResponseDto[]>> {
    return {
      message: 'Daftar pelaksana berhasil diambil',
      success: true,
      data: await this.pelaksanaService.list(req.user, workspaceId),
    };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Tambah pelaksana dalam workspace' })
  @ApiResponse({ status: 201, type: PelaksanaResponseDto })
  async create(
    @Req() req: Request & { user: JwtAccessPayload },
    @Body() dto: CreatePelaksanaDto,
  ): Promise<ApiSuccessResponse<PelaksanaResponseDto>> {
    return {
      message: 'Pelaksana berhasil ditambahkan',
      success: true,
      data: await this.pelaksanaService.create(req.user, dto),
    };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Perbarui nama pelaksana' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: PelaksanaResponseDto })
  async update(
    @Req() req: Request & { user: JwtAccessPayload },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePelaksanaDto,
  ): Promise<ApiSuccessResponse<PelaksanaResponseDto>> {
    return {
      message: 'Pelaksana berhasil diperbarui',
      success: true,
      data: await this.pelaksanaService.update(req.user, id, dto),
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
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
