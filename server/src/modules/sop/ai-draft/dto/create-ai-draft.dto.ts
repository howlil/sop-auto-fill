import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsObject, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateAiDraftDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  readonly workspaceId!: string;

  @ApiProperty({ minLength: 2, maxLength: 500 })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(500)
  readonly judul!: string;

  @ApiProperty({ maxLength: 255 })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  readonly nomorSop!: string;

  @ApiProperty({ maxLength: 500 })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  readonly namaLembaga!: string;

  @ApiProperty({ type: 'object', additionalProperties: true })
  @IsObject()
  readonly proposal!: Record<string, unknown>;
}
