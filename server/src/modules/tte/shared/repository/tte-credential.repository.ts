import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../common/prisma/prisma.service';
import type { TteKredensialRow } from './tte.repository';

@Injectable()
export class TteCredentialRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * PIN hash dan ciphertext passphrase P12 harus berubah dalam satu DB write.
   * Memisahkan dua update dapat meninggalkan kredensial yang tidak bisa didekripsi
   * bila salah satu operasi gagal di tengah perubahan PIN.
   */
  async updatePinAndEncryptedPassphrase(params: {
    userId: string;
    hashPin: string;
    p12PassphraseEncrypted: string | null;
  }): Promise<TteKredensialRow> {
    const row = await this.prisma.pengguna.update({
      where: { penggunaId: params.userId },
      data: {
        ttePinHash: params.hashPin,
        tteP12PassphraseEncrypted: params.p12PassphraseEncrypted,
      },
      select: {
        ttePinHash: true,
        tteP12Base64: true,
        tteP12PassphraseEncrypted: true,
        updatedAt: true,
      },
    });

    if (row.ttePinHash === null) {
      throw new Error('Kredensial TTE tidak ditemukan setelah pembaruan PIN');
    }

    return {
      hashPin: row.ttePinHash,
      p12Base64: row.tteP12Base64,
      p12PassphraseEncrypted: row.tteP12PassphraseEncrypted,
      updatedAt: row.updatedAt,
    };
  }
}
