import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import type { JwtAccessPayload } from '../../../common';
import { PeranPengguna } from '../../../generated/prisma';
import { RegisterTteDto } from '../shared/dto/register-tte.dto';
import { UpdateTtePinDto } from '../shared/dto/update-tte-pin.dto';
import { GenerateP12Dto } from '../shared/dto/generate-p12.dto';
import { UploadP12Dto } from '../shared/dto/upload-p12.dto';
import { SetupTteGenerateDto } from '../shared/dto/setup-tte-generate.dto';
import { SetupTteUploadDto } from '../shared/dto/setup-tte-upload.dto';
import { mapTtePeranResponse } from '../shared/utils/tte-support';
import { decryptP12Passphrase, encryptP12Passphrase } from '../shared/utils/tte-crypto.util';
import { generatePersonalP12 } from '../shared/utils/generate-p12.util';
import { loadTrustedCertificatesFromP12 } from '../shared/utils/pdf-signing-certificate.util';
import { TteCredentialRepository } from '../shared/repository/tte-credential.repository';
import { TteRepository } from '../shared/repository/tte.repository';
import type { TteProfilResponse } from '../shared/types/tte.types';
import * as crypto from 'crypto';

@Injectable()
export class TteProfilService {
  constructor(
    private readonly tteRepository: TteRepository,
    private readonly tteCredentialRepository?: TteCredentialRepository,
  ) {}

  async getProfil(user: JwtAccessPayload): Promise<TteProfilResponse | null> {
    const pengguna = await this.tteRepository.findPenggunaAktif(user.sub);
    if (pengguna === null) {
      throw new NotFoundException('Pengguna tidak ditemukan');
    }
    const row = await this.tteRepository.findKredensial(user.sub);
    if (row === null) {
      return null;
    }
    return this.buildProfilResponse(pengguna, row);
  }

  async registerProfil(user: JwtAccessPayload, dto: RegisterTteDto): Promise<TteProfilResponse> {
    const pengguna = await this.tteRepository.findPenggunaAktif(user.sub);
    if (pengguna === null) {
      throw new NotFoundException('Pengguna tidak ditemukan');
    }
    const existing = await this.tteRepository.findKredensial(user.sub);
    if (existing !== null) {
      throw new ConflictException('PIN TTE sudah diatur. Gunakan ubah PIN jika ingin memperbarui.');
    }
    const hashPin = await bcrypt.hash(dto.pin, 10);
    const row = await this.tteRepository.createKredensialPin({
      userId: user.sub,
      hashPin,
    });
    return this.buildProfilResponse(pengguna, row);
  }

  async updateProfilPin(user: JwtAccessPayload, dto: UpdateTtePinDto): Promise<TteProfilResponse> {
    const pengguna = await this.tteRepository.findPenggunaAktif(user.sub);
    if (pengguna === null) {
      throw new NotFoundException('Pengguna tidak ditemukan');
    }
    const existing = await this.tteRepository.findKredensial(user.sub);
    if (existing === null) {
      throw new BadRequestException('PIN TTE belum diatur. Atur PIN terlebih dahulu.');
    }
    const pinValid = await bcrypt.compare(dto.pinLama, existing.hashPin);
    if (!pinValid) {
      throw new UnauthorizedException('PIN lama tidak sesuai');
    }

    let encryptedPassphrase = existing.p12PassphraseEncrypted;
    const hasEncryptedPassphrase = typeof encryptedPassphrase === 'string';
    if (typeof encryptedPassphrase === 'string') {
      try {
        const passphrase = decryptP12Passphrase(encryptedPassphrase, dto.pinLama);
        encryptedPassphrase = encryptP12Passphrase(passphrase, dto.pinBaru);
      } catch {
        throw new ConflictException(
          'Passphrase sertifikat TTE tidak dapat dimigrasikan. PIN tidak diubah.',
        );
      }
    }

    const hashPin = await bcrypt.hash(dto.pinBaru, 10);
    const row =
      this.tteCredentialRepository !== undefined
        ? await this.tteCredentialRepository.updatePinAndEncryptedPassphrase({
            userId: user.sub,
            hashPin,
            p12PassphraseEncrypted: encryptedPassphrase ?? null,
          })
        : await this.updatePinWithoutP12ForIsolatedUnitTest({
            userId: user.sub,
            hashPin,
            hasEncryptedPassphrase,
          });
    return this.buildProfilResponse(pengguna, row);
  }

  async generateP12(user: JwtAccessPayload, dto: GenerateP12Dto): Promise<TteProfilResponse> {
    const pengguna = await this.tteRepository.findPenggunaAktif(user.sub);
    if (pengguna === null) throw new NotFoundException('Pengguna tidak ditemukan');
    const existing = await this.tteRepository.findKredensial(user.sub);
    if (existing === null) throw new BadRequestException('PIN TTE belum diatur.');

    const pinValid = await bcrypt.compare(dto.pin, existing.hashPin);
    if (!pinValid) throw new UnauthorizedException('PIN tidak sesuai');

    const randomPassphrase = crypto.randomBytes(16).toString('hex');
    const p12Buffer = generatePersonalP12({
      nama: pengguna.nama,
      nip: pengguna.nip,
      opdNama: pengguna.opdNama,
      jabatan: pengguna.jabatan,
      passphrase: randomPassphrase,
    });

    const p12Base64 = p12Buffer.toString('base64');
    const encryptedPassphrase = encryptP12Passphrase(randomPassphrase, dto.pin);

    const row = await this.tteRepository.updateKredensialP12({
      userId: user.sub,
      p12Base64,
      p12PassphraseEncrypted: encryptedPassphrase,
    });

    return this.buildProfilResponse(pengguna, row);
  }

  /**
   * Setup awal TTE: buat sertifikat P12 otomatis + set PIN dalam satu operasi.
   * Tidak membutuhkan PIN lama — auth via JWT (setup pertama kali).
   */
  async setupTteGenerate(
    user: JwtAccessPayload,
    dto: SetupTteGenerateDto,
  ): Promise<TteProfilResponse> {
    const pengguna = await this.tteRepository.findPenggunaAktif(user.sub);
    if (pengguna === null) throw new NotFoundException('Pengguna tidak ditemukan');

    const existing = await this.tteRepository.findKredensial(user.sub);
    if (existing !== null) {
      throw new ConflictException(
        'TTE sudah diatur. Gunakan endpoint update jika ingin mengubah PIN atau sertifikat.',
      );
    }

    const hashPin = await bcrypt.hash(dto.pin, 10);
    const randomPassphrase = crypto.randomBytes(16).toString('hex');
    const p12Buffer = generatePersonalP12({
      nama: pengguna.nama,
      nip: pengguna.nip,
      opdNama: pengguna.opdNama,
      jabatan: pengguna.jabatan,
      passphrase: randomPassphrase,
    });

    const p12Base64 = p12Buffer.toString('base64');
    const encryptedPassphrase = encryptP12Passphrase(randomPassphrase, dto.pin);

    const row = await this.tteRepository.createKredensialPinDanP12({
      userId: user.sub,
      hashPin,
      p12Base64,
      p12PassphraseEncrypted: encryptedPassphrase,
    });

    return this.buildProfilResponse(pengguna, row);
  }

  /**
   * Setup awal TTE: unggah P12 dari BSrE + set PIN dalam satu operasi.
   * Tidak membutuhkan PIN lama — auth via JWT (setup pertama kali).
   */
  async setupTteWithUpload(
    user: JwtAccessPayload,
    dto: SetupTteUploadDto,
    file: { buffer: Buffer },
  ): Promise<TteProfilResponse> {
    const pengguna = await this.tteRepository.findPenggunaAktif(user.sub);
    if (pengguna === null) throw new NotFoundException('Pengguna tidak ditemukan');

    const existing = await this.tteRepository.findKredensial(user.sub);
    if (existing !== null) {
      throw new ConflictException(
        'TTE sudah diatur. Gunakan endpoint update jika ingin mengubah PIN atau sertifikat.',
      );
    }

    try {
      loadTrustedCertificatesFromP12(file.buffer, dto.p12Passphrase);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Sertifikat P12 tidak valid';
      throw new BadRequestException(msg);
    }

    const hashPin = await bcrypt.hash(dto.pin, 10);
    const p12Base64 = file.buffer.toString('base64');
    const encryptedPassphrase = encryptP12Passphrase(dto.p12Passphrase, dto.pin);

    const row = await this.tteRepository.createKredensialPinDanP12({
      userId: user.sub,
      hashPin,
      p12Base64,
      p12PassphraseEncrypted: encryptedPassphrase,
    });

    return this.buildProfilResponse(pengguna, row);
  }

  async uploadP12(
    user: JwtAccessPayload,
    dto: UploadP12Dto,
    file: { buffer: Buffer },
  ): Promise<TteProfilResponse> {
    const pengguna = await this.tteRepository.findPenggunaAktif(user.sub);
    if (pengguna === null) throw new NotFoundException('Pengguna tidak ditemukan');
    const existing = await this.tteRepository.findKredensial(user.sub);
    if (existing === null) throw new BadRequestException('PIN TTE belum diatur.');

    const pinValid = await bcrypt.compare(dto.pin, existing.hashPin);
    if (!pinValid) throw new UnauthorizedException('PIN tidak sesuai');

    try {
      loadTrustedCertificatesFromP12(file.buffer, dto.p12Passphrase);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Sertifikat P12 tidak valid';
      throw new BadRequestException(msg);
    }

    const p12Base64 = file.buffer.toString('base64');
    const encryptedPassphrase = encryptP12Passphrase(dto.p12Passphrase, dto.pin);

    const row = await this.tteRepository.updateKredensialP12({
      userId: user.sub,
      p12Base64,
      p12PassphraseEncrypted: encryptedPassphrase,
    });

    return this.buildProfilResponse(pengguna, row);
  }

  private async updatePinWithoutP12ForIsolatedUnitTest(params: {
    userId: string;
    hashPin: string;
    hasEncryptedPassphrase: boolean;
  }) {
    if (params.hasEncryptedPassphrase) {
      throw new Error('TteCredentialRepository wajib tersedia untuk perubahan PIN dengan P12');
    }
    return this.tteRepository.updateKredensialPinHash({
      userId: params.userId,
      hashPin: params.hashPin,
    });
  }

  private buildProfilResponse(
    pengguna: {
      penggunaId: string;
      nama: string;
      email: string;
      nip: string;
      jabatan: string;
      pangkat: string;
      peran: PeranPengguna;
    },
    row: { updatedAt: Date; p12Base64?: string | null },
  ): TteProfilResponse {
    return {
      id: pengguna.penggunaId,
      userId: pengguna.penggunaId,
      hasP12: Boolean(row.p12Base64),
      peran: mapTtePeranResponse(pengguna.peran),
      createdAt: row.updatedAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      user: {
        id: pengguna.penggunaId,
        nama: pengguna.nama,
        email: pengguna.email,
        nip: pengguna.nip,
        jabatan: pengguna.jabatan,
        pangkat: pengguna.pangkat,
      },
    };
  }
}
