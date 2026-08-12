import { Global, Module } from '@nestjs/common';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { PrismaModule } from './prisma/prisma.module';
import { CsrfProtectionService } from './security/csrf-protection.service';
import { SecurityRateLimiterService } from './security/security-rate-limiter.service';

@Global()
@Module({
  imports: [PrismaModule],
  controllers: [HealthController],
  providers: [JwtAuthGuard, CsrfProtectionService, HealthService, SecurityRateLimiterService],
  exports: [JwtAuthGuard, CsrfProtectionService, SecurityRateLimiterService],
})
export class CommonModule {}
