import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getScrapeRuns() {
    return this.prisma.scrapeRun.findMany({
      orderBy: { startedAt: 'desc' },
      take: 20,
    });
  }

  async getStaleProducts() {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return this.prisma.catalogProduct.findMany({
      where: {
        lastSeenAt: {
          lt: twentyFourHoursAgo,
        },
      },
    });
  }

  getProductChanges() {
    return [];
  }

  triggerRefresh() {
    return { status: 'triggered' };
  }
}
