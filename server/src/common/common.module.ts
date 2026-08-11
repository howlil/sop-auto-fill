import { Global, Module } from '@nestjs/common';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { PrismaModule } from './prisma/prisma.module';
import { RolesGuard } from './guards/roles.guard';
import { CsrfProtectionService } from './security/csrf-protection.service';
import { SecurityRateLimiterService } from './security/security-rate-limiter.service';

/**
 * Guard dan service lintas fitur. JWT tetap dipasang eksplisit pada controller.
 */
@Global()
@Module({
  imports: [PrismaModule],
  controllers: [HealthController],
  providers: [
    JwtAuthGuard,
    RolesGuard,
    CsrfProtectionService,
    HealthService,
    SecurityRateLimiterService,
  ],
  exports: [JwtAuthGuard, RolesGuard, CsrfProtectionService, SecurityRateLimiterService],
})
export class CommonModule {}
