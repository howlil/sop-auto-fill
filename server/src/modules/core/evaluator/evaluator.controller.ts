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
import { AnggotaEvaluatorItemDto } from './dto/anggota-evaluator-item.dto';
import { CreateEvaluatorDto } from './dto/create-evaluator.dto';
import { EvaluatorOpdGrupDto } from './dto/evaluator-opd-grup.dto';
import { UpdateEvaluatorDto } from './dto/update-evaluator.dto';
import { EvaluatorService } from './evaluator.service';

@ApiTags('Evaluator')
@Controller('evaluator')
@UseJwtAndRolesGuards()
@Roles(PeranPengguna.PJ_EVALUATOR)
export class EvaluatorController {
  constructor(private readonly evaluatorService: EvaluatorService) {}

  @Get()
  @ApiCookieAuth(ACCESS_TOKEN_COOKIE_NAME)
  @ApiOperation({ summary: 'Daftar evaluator grup per OPD Biro' })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Filter nama, NIP, atau email evaluator (substring)',
  })
  @ApiResponse({ status: 200, type: [EvaluatorOpdGrupDto] })
  @ApiForbiddenResponse({ description: 'Bukan PJ_EVALUATOR' })
  async findAll(
    @Query('search') search?: string,
  ): Promise<ApiSuccessResponse<EvaluatorOpdGrupDto[]>> {
    const data = await this.evaluatorService.listGrup(search);
    return {
      message: 'Daftar evaluator berhasil diambil',
      success: true,
      data,
    };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiCookieAuth(ACCESS_TOKEN_COOKIE_NAME)
  @ApiOperation({ summary: 'Tambah evaluator (sandi default server)' })
  @ApiResponse({ status: 201, type: AnggotaEvaluatorItemDto })
  async create(
    @Body() dto: CreateEvaluatorDto,
  ): Promise<ApiSuccessResponse<AnggotaEvaluatorItemDto>> {
    const data = await this.evaluatorService.createAnggota(dto);
    return {
      message: 'Evaluator berhasil ditambahkan',
      success: true,
      data,
    };
  }

  @Patch(':id')
  @ApiCookieAuth(ACCESS_TOKEN_COOKIE_NAME)
  @ApiOperation({ summary: 'Perbarui data evaluator' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiResponse({ status: 200, type: AnggotaEvaluatorItemDto })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEvaluatorDto,
  ): Promise<ApiSuccessResponse<AnggotaEvaluatorItemDto>> {
    const data = await this.evaluatorService.updateAnggota(id, dto);
    return {
      message: 'Data evaluator berhasil diperbarui',
      success: true,
      data,
    };
  }

  @Delete(':id')
  @ApiCookieAuth(ACCESS_TOKEN_COOKIE_NAME)
  @ApiOperation({ summary: 'Nonaktifkan evaluator' })
  @ApiParam({ name: 'id', format: 'uuid' })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<ApiSuccessResponse<null>> {
    await this.evaluatorService.softDeleteAnggota(id);
    return {
      message: 'Evaluator berhasil dinonaktifkan',
      success: true,
      data: null,
    };
  }
}
