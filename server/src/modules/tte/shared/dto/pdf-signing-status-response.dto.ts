import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PdfSigningStatusResponseDto {
  @ApiProperty()
  readonly enabled!: boolean;

  @ApiPropertyOptional()
  readonly trustedCaSubject?: string | null;

  @ApiPropertyOptional()
  readonly trustedSignerSubject?: string | null;

  @ApiProperty({ example: '/validasi/pdf' })
  readonly verificationPath!: string;

  @ApiPropertyOptional({
    description:
      'Alasan penandatanganan nonaktif meskipun env mungkin sudah diatur (P12 invalid, passphrase salah, atau perlu restart server).',
  })
  readonly configError?: string;
}
