import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { IngestionService } from './ingestion.service';
import { SnapshotService } from './snapshot.service';
import { SuppliersService } from '../suppliers/suppliers.service';
import { PrismaService } from '../prisma/prisma.service';
import { Logger } from '@nestjs/common';

@Processor('scrape-queue')
export class ScrapeProcessor extends WorkerHost {
  private readonly logger = new Logger(ScrapeProcessor.name);

  constructor(
    private readonly ingestionService: IngestionService,
    private readonly snapshotService: SnapshotService,
    private readonly suppliersService: SuppliersService,
    private readonly prisma: PrismaService,
    @InjectQueue('scrape-queue') private scrapeQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    const { supplierCode, scrapeRunId } = job.data;
    const adapter = this.suppliersService.getAdapter(supplierCode);

    if (job.name === 'discover-products') {
      this.logger.log(
        `Discovering products for ${supplierCode} (Run ${scrapeRunId})`,
      );
      const urls = await adapter.discoverProductUrls();
      await this.prisma.scrapeRun.update({
        where: { id: scrapeRunId },
        data: {
          status: 'running',
          productsDiscovered: urls.length,
          pagesFetched: { increment: 1 },
        },
      });
      for (const url of urls) {
        await this.scrapeQueue.add('process-product', {
          url,
          supplierCode,
          scrapeRunId,
        });
      }
      // Nothing to process — the run is already done.
      if (urls.length === 0) {
        await this.markRunComplete(scrapeRunId);
      }
      return { discoveredCount: urls.length };
    }

    if (job.name === 'process-product') {
      const { url } = job.data;
      this.logger.log(`Processing product ${url}`);

      try {
        const result = await this.processProduct(
          adapter,
          supplierCode,
          scrapeRunId,
          url,
        );
        await this.prisma.scrapeRun.update({
          where: { id: scrapeRunId },
          data: {
            pagesFetched: { increment: 1 },
            productsUpdated: { increment: 1 },
          },
        });
        await this.checkRunComplete(scrapeRunId);
        return result;
      } catch (err: any) {
        const maxAttempts = job.opts.attempts ?? 1;
        const isFinalAttempt = job.attemptsMade >= maxAttempts - 1;
        this.logger.error(
          `Failed to process ${url} (attempt ${job.attemptsMade + 1}/${maxAttempts}): ${err.message}`,
        );
        // Only record the failure once, on the final attempt, so retries don't double-count.
        if (isFinalAttempt) {
          await this.prisma.scrapeRun.update({
            where: { id: scrapeRunId },
            data: {
              pagesFetched: { increment: 1 },
              parseFailures: { increment: 1 },
              errorSummary: `${url}: ${err.message}`.slice(0, 1000),
            },
          });
          await this.checkRunComplete(scrapeRunId);
        }
        throw err;
      }
    }
  }

  /**
   * Marks the run completed once every discovered product has been processed
   * (successfully or as a recorded failure).
   */
  private async checkRunComplete(scrapeRunId: string): Promise<void> {
    const run = await this.prisma.scrapeRun.findUnique({
      where: { id: scrapeRunId },
    });
    if (!run || run.status === 'completed') return;
    if (run.productsUpdated + run.parseFailures >= run.productsDiscovered) {
      await this.markRunComplete(scrapeRunId);
    }
  }

  private async markRunComplete(scrapeRunId: string): Promise<void> {
    await this.prisma.scrapeRun.update({
      where: { id: scrapeRunId },
      data: { status: 'completed', finishedAt: new Date() },
    });
    this.logger.log(`Scrape run ${scrapeRunId} completed`);
  }

  private async processProduct(
    adapter: ReturnType<SuppliersService['getAdapter']>,
    supplierCode: string,
    scrapeRunId: string,
    url: string,
  ): Promise<any> {
    const page = await adapter.fetchProduct(url);

    await this.snapshotService.createSnapshot(scrapeRunId, url, page.html);

    const parsed = await adapter.parseProduct(page);

    // 1. Upsert the CatalogProduct row
    const product = await this.prisma.catalogProduct.upsert({
      where: { slug: parsed.product.slug },
      create: {
        supplier: { connect: { code: supplierCode } },
        externalProductId: parsed.product.externalProductId,
        slug: parsed.product.slug,
        title: parsed.product.title,
        category: parsed.product.category,
        subcategory: parsed.product.subcategory,
        shape: parsed.product.shape,
        sourceUrl: parsed.product.sourceUrl,
        imageUrl: parsed.product.imageUrl,
        description: parsed.product.description,
        currency: parsed.product.currency,
      },
      update: {
        title: parsed.product.title,
        category: parsed.product.category,
        subcategory: parsed.product.subcategory,
        shape: parsed.product.shape,
        sourceUrl: parsed.product.sourceUrl,
        imageUrl: parsed.product.imageUrl,
        description: parsed.product.description,
        currency: parsed.product.currency,
        lastSeenAt: new Date(),
      },
    });

    // 2. Persist variants, options, layout constraints, and price tiers
    for (const v of parsed.variants) {
      const variant = await this.prisma.productVariant.upsert({
        where: {
          productId_variantCode: {
            productId: product.id,
            variantCode: v.variantCode,
          },
        },
        create: {
          productId: product.id,
          variantCode: v.variantCode,
          title: v.title,
          isDefault: v.isDefault ?? false,
        },
        update: {
          title: v.title,
          isDefault: v.isDefault ?? false,
        },
      });

      // Clear stale child data for this variant, then re-insert
      await this.prisma.variantOption.deleteMany({
        where: { variantId: variant.id },
      });
      await this.prisma.layoutConstraint.deleteMany({
        where: { variantId: variant.id },
      });
      await this.prisma.priceTier.deleteMany({
        where: { variantId: variant.id },
      });

      // Options
      if (v.options.length > 0) {
        await this.prisma.variantOption.createMany({
          data: v.options.map((o, i) => ({
            variantId: variant.id,
            optionGroup: o.optionGroup,
            optionKey: `${o.optionKey}:${i}`,
            optionLabel: o.optionLabel,
            optionValue: o.optionValue,
            displayOrder: i,
            priceDataJson: o.priceDataJson ?? null,
          })),
        });
      }

      // Layout constraints
      if (v.layoutConstraints.length > 0) {
        await this.prisma.layoutConstraint.createMany({
          data: v.layoutConstraints.map((lc) => ({
            variantId: variant.id,
            faceKey: lc.faceKey,
            widthMm: lc.widthMm,
            heightMm: lc.heightMm,
            widthPx: lc.widthPx,
            heightPx: lc.heightPx,
            bleedMm: lc.bleedMm,
            safeZoneMm: lc.safeZoneMm,
            dpi: lc.dpi,
            panelCount: lc.panelCount,
            cutlineRequired: lc.cutlineRequired ?? false,
            notes: lc.notes,
          })),
        });
      }

      // Price tiers
      if (v.priceTiers.length > 0) {
        await this.prisma.priceTier.createMany({
          data: v.priceTiers.map((pt) => ({
            variantId: variant.id,
            minQuantity: pt.minQuantity,
            maxQuantity: pt.maxQuantity,
            unitPrice: pt.unitPrice,
            totalPrice: pt.totalPrice,
            currency: pt.currency,
          })),
        });
      }

      this.logger.log(
        `Saved variant "${v.variantCode}" with ${v.options.length} options, ` +
          `${v.layoutConstraints.length} layouts, ${v.priceTiers.length} price tiers`,
      );
    }

    return {
      productId: product.id,
      slug: product.slug,
      variantCount: parsed.variants.length,
    };
  }
}
