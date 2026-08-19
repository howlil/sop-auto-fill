import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class TemplatePreviewQueryDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  readonly workspaceId!: string;
}
