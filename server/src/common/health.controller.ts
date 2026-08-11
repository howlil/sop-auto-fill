import { Controller, Get, VERSION_NEUTRAL, Version } from '@nestjs/common';
import { HealthService, type ReadinessCheckResult } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  /** Backward-compatible liveness endpoint. */
  @Get()
  @Version(VERSION_NEUTRAL)
  check() {
    return this.healthService.live();
  }

  @Get('live')
  @Version(VERSION_NEUTRAL)
  live() {
    return this.healthService.live();
  }

  @Get('ready')
  @Version(VERSION_NEUTRAL)
  ready(): Promise<ReadinessCheckResult> {
    return this.healthService.ready();
  }
}
