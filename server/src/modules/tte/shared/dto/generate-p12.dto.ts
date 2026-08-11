import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class GenerateP12Dto {
  @ApiProperty({
    example: '1234',
    description: 'PIN TTE saat ini untuk memverifikasi dan mengenkripsi P12',
  })
  @IsString()
  @MinLength(4)
  @MaxLength(32)
  readonly pin!: string;
}
