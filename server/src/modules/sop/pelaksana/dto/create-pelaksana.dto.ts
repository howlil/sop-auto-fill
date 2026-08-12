import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreatePelaksanaDto {
  @ApiProperty({ description: 'Workspace tempat master pelaksana disimpan', format: 'uuid' })
  @IsUUID()
  readonly workspaceId!: string;

  @ApiProperty({ description: 'Nama pelaksana / aktor SOP' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(255)
  readonly namaPelaksana!: string;
}
