import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { IngestionService } from './ingestion.service';
import { SnapshotService } from './snapshot.service';
import { ScrapeProcessor } from './scrape.processor';
import { SuppliersModule } from '../suppliers/suppliers.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'scrape-queue',
    }),
    SuppliersModule,
  ],
  providers: [IngestionService, SnapshotService, ScrapeProcessor],
  exports: [IngestionService, SnapshotService],
})
export class IngestionModule {}
