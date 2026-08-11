import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PdfSignatureChecksDto {
  @ApiProperty()
  readonly digestMatch!: boolean;

  @ApiProperty()
  readonly chainTrusted!: boolean;

  @ApiProperty()
  readonly certificatePeriodValid!: boolean;
}

export class PdfSignatureCertificateDto {
  @ApiProperty()
  readonly validFrom!: string;

  @ApiProperty()
  readonly validTo!: string;

  @ApiProperty()
  readonly fingerprint!: string;

  @ApiProperty()
  readonly serialNumber!: string;
}

export class PdfSignatureBindingDto {
  @ApiProperty()
  readonly dokumenTteId!: string;

  @ApiProperty()
  readonly userId!: string;

  @ApiProperty()
  readonly jenisDokumen!: string;
}

export class PdfSignatureTteMatchDto {
  @ApiProperty()
  readonly matched!: boolean;

  @ApiProperty()
  readonly reason!: string;

  @ApiPropertyOptional()
  readonly dokumenTteId?: string;

  @ApiPropertyOptional()
  readonly userId?: string;

  @ApiPropertyOptional()
  readonly peran?: string;

  @ApiPropertyOptional()
  readonly jenisDokumen?: string;

  @ApiPropertyOptional()
  readonly nomorDokumen?: string;

  @ApiPropertyOptional()
  readonly judulDokumen?: string;

  @ApiPropertyOptional()
  readonly ditandatanganiPada?: string;
}

export class PdfSignatureVerificationEntryDto {
  @ApiProperty()
  readonly index!: number;

  @ApiProperty()
  readonly valid!: boolean;

  @ApiProperty()
  readonly reason!: string;

  @ApiProperty()
  readonly signatureValue!: string;

  @ApiProperty()
  readonly signerSubject!: string;

  @ApiProperty()
  readonly signerIssuer!: string;

  @ApiPropertyOptional({ nullable: true })
  readonly signedAt!: string | null;

  @ApiPropertyOptional({ type: () => PdfSignatureBindingDto, nullable: true })
  readonly binding!: PdfSignatureBindingDto | null;

  @ApiProperty({ type: () => PdfSignatureCertificateDto })
  readonly certificate!: PdfSignatureCertificateDto;

  @ApiProperty({ type: () => PdfSignatureChecksDto })
  readonly checks!: PdfSignatureChecksDto;

  @ApiProperty({ type: () => PdfSignatureTteMatchDto })
  readonly tteMatch!: PdfSignatureTteMatchDto;
}

export class VerifyPdfResponseDto {
  @ApiProperty()
  readonly pdfSigningEnabled!: boolean;

  @ApiPropertyOptional({ nullable: true })
  readonly trustedCaSubject!: string | null;

  @ApiProperty()
  readonly hasSignatures!: boolean;

  @ApiProperty()
  readonly allValid!: boolean;

  @ApiProperty({ type: () => [PdfSignatureVerificationEntryDto] })
  readonly signatures!: PdfSignatureVerificationEntryDto[];

  @ApiProperty()
  readonly disclaimer!: string;
}
