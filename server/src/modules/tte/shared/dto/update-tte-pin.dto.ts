import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

/** Body ubah PIN TTE — wajib PIN lama yang valid. */
export class UpdateTtePinDto {
  @ApiProperty({ example: '1234', description: 'PIN TTE saat ini' })
  @IsString()
  @MinLength(4)
  @MaxLength(32)
  readonly pinLama!: string;

  @ApiProperty({ example: '5678', description: 'PIN TTE baru' })
  @IsString()
  @MinLength(4)
  @MaxLength(32)
  readonly pinBaru!: string;
}
