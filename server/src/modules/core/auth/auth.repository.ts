import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import type { User } from '../../../generated/prisma';

export type AuthUserRecord = User;

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(userId: string): Promise<AuthUserRecord | null> {
    return this.prisma.user.findUnique({ where: { userId } });
  }

  upsertGoogleUser(input: {
    googleSub: string;
    email: string;
    name: string;
    avatarUrl: string | null;
  }): Promise<AuthUserRecord> {
    return this.prisma.user.upsert({
      where: { googleSub: input.googleSub },
      create: input,
      update: {
        email: input.email,
        name: input.name,
        avatarUrl: input.avatarUrl,
      },
    });
  }
}
