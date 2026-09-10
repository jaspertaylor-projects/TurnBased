import { Controller, Get, Param, Post } from '@nestjs/common';
import { AdminService } from './admin.service';
import { IngestionService } from '../ingestion/ingestion.service';

@Controller('v1/admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly ingestionService: IngestionService,
  ) {}

  @Get('scrape-runs')
  getScrapeRuns() {
    return this.adminService.getScrapeRuns();
  }

  @Get('products/stale')
  getStaleProducts() {
    return this.adminService.getStaleProducts();
  }

  @Get('products/changes')
  getProductChanges() {
    return this.adminService.getProductChanges();
  }

  @Post('refresh')
  triggerRefresh() {
    return this.ingestionService.startScrapeRun('bgm', 'full');
  }

  /** Trigger a full ingestion run for any registered supplier (e.g. "bgm", "tgc"). */
  @Post('refresh/:supplierCode')
  triggerRefreshForSupplier(@Param('supplierCode') supplierCode: string) {
    return this.ingestionService.startScrapeRun(supplierCode, 'full');
  }
}
