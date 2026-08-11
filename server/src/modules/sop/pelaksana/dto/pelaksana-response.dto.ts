import { ApiProperty } from '@nestjs/swagger';

export class PelaksanaResponseDto {
  @ApiProperty()
  readonly id!: string;

  @ApiProperty()
  readonly opdId!: string;

  @ApiProperty()
  readonly namaPelaksana!: string;

  @ApiProperty()
  readonly createdAt!: string;

  @ApiProperty()
  readonly updatedAt!: string;
}
