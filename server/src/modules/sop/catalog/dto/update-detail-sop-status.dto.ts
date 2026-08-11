import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { StatusSOP } from '../../../../generated/prisma';

/** Body PATCH ubah status DetailSOP versi terbaru (transisi dicek di service). */
export class UpdateDetailSopStatusDto {
  @ApiProperty({ enum: StatusSOP, description: 'Status DetailSOP baru' })
  @IsEnum(StatusSOP)
  readonly status!: StatusSOP;
}
