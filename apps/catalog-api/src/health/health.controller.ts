import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('health')
  checkLiveness() {
    return { status: 'ok' };
  }

  @Get('ready')
  async checkReadiness() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      return {
        status: 'error',
        database: 'disconnected',
        catalogStatus: 'unknown',
      };
    }

    return {
      status: 'ok',
      database: 'connected',
      catalogStatus: 'ready',
    };
  }
}
