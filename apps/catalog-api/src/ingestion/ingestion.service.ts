import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class IngestionService {
  constructor(
    @InjectQueue('scrape-queue') private scrapeQueue: Queue,
    private readonly prisma: PrismaService,
  ) {}

  async startScrapeRun(supplierCode: string, runType: string) {
    try {
      const supplier = await this.prisma.supplier.findUnique({ where: { code: supplierCode } });
      if (!supplier) throw new Error('Supplier not found');

      const scrapeRun = await this.prisma.scrapeRun.create({
        data: {
          supplierId: supplier.id,
          runType,
          status: 'started',
          startedAt: new Date(),
        },
      });

      await this.scrapeQueue.add(
        'discover-products',
        { scrapeRunId: scrapeRun.id, supplierCode },
        { attempts: 3, backoff: { type: 'exponential', delay: 5000 } }
      );
      return scrapeRun;
    } catch (error: any) {
      throw new Error(`Failed to initiate scrape run: ${error.message}`);
    }
  }
}
