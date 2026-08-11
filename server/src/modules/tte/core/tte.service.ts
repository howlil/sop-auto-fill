import { Injectable } from '@nestjs/common';
import type { Request } from 'express';
import type { JwtAccessPayload } from '../../../common';
import { RegisterTteDto } from '../shared/dto/register-tte.dto';

import { SignPdfDto } from '../shared/dto/sign-pdf.dto';
import { TandaTanganiDto } from '../shared/dto/tanda-tangani.dto';
import { TandaTanganiSemuaSopDto } from '../shared/dto/tanda-tangani-semua-sop.dto';
import { UpdateTtePinDto } from '../shared/dto/update-tte-pin.dto';
import { GenerateP12Dto } from '../shared/dto/generate-p12.dto';
import { UploadP12Dto } from '../shared/dto/upload-p12.dto';
import { SetupTteGenerateDto } from '../shared/dto/setup-tte-generate.dto';
import { SetupTteUploadDto } from '../shared/dto/setup-tte-upload.dto';
import { TtePdfSigningService } from '../penandatanganan/tte-pdf-signing.service';
import type { VerifyPdfDto } from '../shared/dto/verify-pdf.dto';
import { TtePenandatangananService } from '../penandatanganan/tte-penandatanganan.service';
import { TteProfilService } from '../profil/tte-profil.service';
import { TteVerifikasiService } from '../verifikasi/tte-verifikasi.service';

import {
  PdfSigningStatusResponse,
  SignPdfResponse,
  VerifyPdfResponse,
  TteProfilResponse,
  TteRiwayatResponse,
  TtePengesahanPublicResponse,
  TteBatchSignSopPengajuanResponse,
} from '../shared/types/tte.types';

export type {
  PdfSigningStatusResponse,
  SignPdfResponse,
  VerifyPdfResponse,
  TteProfilResponse,
  TteRiwayatResponse,
  TtePengesahanPublicResponse,
  TteBatchSignSopPengajuanResponse,
} from '../shared/types/tte.types';

/**
 * Fasad TTE: mendelegasikan ke layanan profil, penandatanganan, dan verifikasi.
 */
@Injectable()
export class TteService {
  constructor(
    private readonly profilService: TteProfilService,
    private readonly penandatangananService: TtePenandatangananService,
    private readonly verifikasiService: TteVerifikasiService,
    private readonly pdfSigningService: TtePdfSigningService,
  ) {}

  getProfil(user: JwtAccessPayload): Promise<TteProfilResponse | null> {
    return this.profilService.getProfil(user);
  }

  registerProfil(user: JwtAccessPayload, dto: RegisterTteDto): Promise<TteProfilResponse> {
    return this.profilService.registerProfil(user, dto);
  }

  updateProfilPin(user: JwtAccessPayload, dto: UpdateTtePinDto): Promise<TteProfilResponse> {
    return this.profilService.updateProfilPin(user, dto);
  }

  generateP12(user: JwtAccessPayload, dto: GenerateP12Dto): Promise<TteProfilResponse> {
    return this.profilService.generateP12(user, dto);
  }

  uploadP12(user: JwtAccessPayload, dto: UploadP12Dto, file: any): Promise<TteProfilResponse> {
    return this.profilService.uploadP12(user, dto, file);
  }

  setupTteGenerate(user: JwtAccessPayload, dto: SetupTteGenerateDto): Promise<TteProfilResponse> {
    return this.profilService.setupTteGenerate(user, dto);
  }

  setupTteWithUpload(
    user: JwtAccessPayload,
    dto: SetupTteUploadDto,
    file: any,
  ): Promise<TteProfilResponse> {
    return this.profilService.setupTteWithUpload(user, dto, file);
  }

  getPengesahanPublic(
    dokumenTteId: string,
    userId: string,
    req?: Request,
  ): Promise<TtePengesahanPublicResponse> {
    return this.verifikasiService.getPengesahanPublic(dokumenTteId, userId, req);
  }

  tandaTanganiBa(
    user: JwtAccessPayload,
    pengajuanEvaluasiId: string,
    dto: TandaTanganiDto,
    req?: Request,
  ): Promise<TteRiwayatResponse> {
    return this.penandatangananService.tandaTanganiBa(user, pengajuanEvaluasiId, dto, req);
  }

  tandaTanganiSemuaSopPengajuan(
    user: JwtAccessPayload,
    pengajuanEvaluasiId: string,
    dto: TandaTanganiSemuaSopDto,
    req?: Request,
  ): Promise<TteBatchSignSopPengajuanResponse> {
    return this.penandatangananService.tandaTanganiSemuaSopPengajuan(
      user,
      pengajuanEvaluasiId,
      dto,
      req,
    );
  }

  signPdf(user: JwtAccessPayload, dto: SignPdfDto): Promise<SignPdfResponse> {
    return this.pdfSigningService.signPdf(user, dto);
  }

  getPdfSigningStatus(): PdfSigningStatusResponse {
    return this.pdfSigningService.getPdfSigningStatus();
  }

  verifyPdf(dto: VerifyPdfDto): Promise<VerifyPdfResponse> {
    return this.pdfSigningService.verifyPdf(dto);
  }
}
