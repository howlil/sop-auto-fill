import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import type { Workspace } from '../../generated/prisma';
import { JwtAuthGuard, type ApiSuccessResponse, type JwtAccessPayload } from '../../common';
import { WorkspaceNameDto } from './dto/workspace-name.dto';
import { WorkspaceService } from './workspace.service';

@Controller('workspaces')
@UseGuards(JwtAuthGuard)
export class WorkspaceController {
  constructor(private readonly workspaceService: WorkspaceService) {}

  @Get()
  async list(
    @Req() req: Request & { user: JwtAccessPayload },
  ): Promise<ApiSuccessResponse<Workspace[]>> {
    return {
      success: true,
      message: 'Workspace berhasil diambil',
      data: await this.workspaceService.list(req.user.sub),
    };
  }

  @Post()
  async create(
    @Req() req: Request & { user: JwtAccessPayload },
    @Body() dto: WorkspaceNameDto,
  ): Promise<ApiSuccessResponse<Workspace>> {
    return {
      success: true,
      message: 'Workspace berhasil dibuat',
      data: await this.workspaceService.create(req.user.sub, dto.name),
    };
  }

  @Get(':workspaceId')
  async get(
    @Req() req: Request & { user: JwtAccessPayload },
    @Param('workspaceId') workspaceId: string,
  ): Promise<ApiSuccessResponse<Workspace>> {
    return {
      success: true,
      message: 'Workspace berhasil diambil',
      data: await this.workspaceService.getOwned(req.user.sub, workspaceId),
    };
  }

  @Patch(':workspaceId')
  async rename(
    @Req() req: Request & { user: JwtAccessPayload },
    @Param('workspaceId') workspaceId: string,
    @Body() dto: WorkspaceNameDto,
  ): Promise<ApiSuccessResponse<Workspace>> {
    return {
      success: true,
      message: 'Workspace berhasil diperbarui',
      data: await this.workspaceService.rename(req.user.sub, workspaceId, dto.name),
    };
  }

  @Delete(':workspaceId')
  @HttpCode(204)
  async remove(
    @Req() req: Request & { user: JwtAccessPayload },
    @Param('workspaceId') workspaceId: string,
  ): Promise<void> {
    await this.workspaceService.remove(req.user.sub, workspaceId);
  }
}
