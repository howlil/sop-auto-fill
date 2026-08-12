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
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard, type ApiSuccessResponse } from '../../../common';
import { ACCESS_TOKEN_COOKIE_NAME, type JwtAccessPayload } from '../auth/helpers/auth.shared';
import { CreatePeraturanDto } from './dto/create-peraturan.dto';
import { PeraturanResponseDto } from './dto/peraturan-response.dto';
import { UpdatePeraturanDto } from './dto/update-peraturan.dto';
import { PeraturanService } from './peraturan.service';

@ApiTags('Peraturan')
@Controller('peraturan')
@UseGuards(JwtAuthGuard)
@ApiCookieAuth(ACCESS_TOKEN_COOKIE_NAME)
export class PeraturanController {
  constructor(private readonly peraturanService: PeraturanService) {}

  @Get()
  @ApiOperation({ summary: 'Daftar peraturan milik user' })
  @ApiResponse({ status: 200, type: [PeraturanResponseDto] })
  async list(
    @Req() req: Request & { user: JwtAccessPayload },
  ): Promise<ApiSuccessResponse<PeraturanResponseDto[]>> {
    return {
      message: 'Daftar peraturan berhasil diambil',
      success: true,
      data: await this.peraturanService.list(req.user),
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detail peraturan milik user' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: PeraturanResponseDto })
  async getById(
    @Req() req: Request & { user: JwtAccessPayload },
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiSuccessResponse<PeraturanResponseDto>> {
    return {
      message: 'Peraturan berhasil diambil',
      success: true,
      data: await this.peraturanService.getById(req.user, id),
    };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Buat peraturan milik user' })
  @ApiResponse({ status: 201, type: PeraturanResponseDto })
  async create(
    @Req() req: Request & { user: JwtAccessPayload },
    @Body() dto: CreatePeraturanDto,
  ): Promise<ApiSuccessResponse<PeraturanResponseDto>> {
    return {
      message: 'Peraturan berhasil ditambahkan',
      success: true,
      data: await this.peraturanService.create(req.user, dto),
    };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Perbarui peraturan milik user' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: PeraturanResponseDto })
  async update(
    @Req() req: Request & { user: JwtAccessPayload },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePeraturanDto,
  ): Promise<ApiSuccessResponse<PeraturanResponseDto>> {
    return {
      message: 'Peraturan berhasil diperbarui',
      success: true,
      data: await this.peraturanService.update(req.user, id, dto),
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Hapus peraturan yang tidak digunakan SOP' })
  @ApiParam({ name: 'id', format: 'uuid' })
  async remove(
    @Req() req: Request & { user: JwtAccessPayload },
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiSuccessResponse<null>> {
    await this.peraturanService.remove(req.user, id);
    return {
      message: 'Peraturan berhasil dihapus',
      success: true,
      data: null,
    };
  }
}
