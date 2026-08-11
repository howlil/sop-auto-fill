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
import { CreatePeraturanDto } from './dto/create-peraturan.dto';
import { PeraturanResponseDto } from './dto/peraturan-response.dto';
import { UpdatePeraturanDto } from './dto/update-peraturan.dto';
import { PeraturanService } from './peraturan.service';

@ApiTags('Peraturan')
@Controller('peraturan')
@UseJwtAndRolesGuards()
@Roles(PeranPengguna.PENYUSUN, PeranPengguna.PJ_PENYUSUN)
export class PeraturanController {
  constructor(private readonly peraturanService: PeraturanService) {}

  @Get()
  @ApiCookieAuth(ACCESS_TOKEN_COOKIE_NAME)
  @ApiOperation({ summary: 'Daftar peraturan terkait OPD pengguna' })
  @ApiQuery({ name: 'opdId', required: false, format: 'uuid' })
  @ApiResponse({ status: 200, type: [PeraturanResponseDto] })
  @ApiForbiddenResponse()
  async list(
    @Req() req: Request & { user: JwtAccessPayload },
    @Query('opdId') opdId?: string,
  ): Promise<ApiSuccessResponse<PeraturanResponseDto[]>> {
    const data = await this.peraturanService.list(req.user, opdId);
    return {
      message: 'Daftar peraturan berhasil diambil',
      success: true,
      data,
    };
  }

  @Get(':id')
  @ApiCookieAuth(ACCESS_TOKEN_COOKIE_NAME)
  @ApiOperation({ summary: 'Detail peraturan (harus terhubung ke OPD pengguna)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiQuery({ name: 'opdId', required: false, format: 'uuid' })
  @ApiResponse({ status: 200, type: PeraturanResponseDto })
  async getById(
    @Req() req: Request & { user: JwtAccessPayload },
    @Param('id', ParseUUIDPipe) id: string,
    @Query('opdId') opdId?: string,
  ): Promise<ApiSuccessResponse<PeraturanResponseDto>> {
    const data = await this.peraturanService.getById(req.user, id, opdId);
    return {
      message: 'Peraturan berhasil diambil',
      success: true,
      data,
    };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiCookieAuth(ACCESS_TOKEN_COOKIE_NAME)
  @ApiOperation({ summary: 'Buat master peraturan dan tautkan ke OPD pengguna' })
  @ApiResponse({ status: 201, type: PeraturanResponseDto })
  async create(
    @Req() req: Request & { user: JwtAccessPayload },
    @Body() dto: CreatePeraturanDto,
  ): Promise<ApiSuccessResponse<PeraturanResponseDto>> {
    const data = await this.peraturanService.create(req.user, dto);
    return {
      message: 'Peraturan berhasil ditambahkan',
      success: true,
      data,
    };
  }

  @Patch(':id')
  @ApiCookieAuth(ACCESS_TOKEN_COOKIE_NAME)
  @ApiOperation({ summary: 'Perbarui master peraturan' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: PeraturanResponseDto })
  async update(
    @Req() req: Request & { user: JwtAccessPayload },
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePeraturanDto,
  ): Promise<ApiSuccessResponse<PeraturanResponseDto>> {
    const data = await this.peraturanService.update(req.user, id, dto);
    return {
      message: 'Peraturan berhasil diperbarui',
      success: true,
      data,
    };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth(ACCESS_TOKEN_COOKIE_NAME)
  @ApiOperation({ summary: 'Lepaskan peraturan dari OPD; hapus master jika tidak dipakai' })
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
