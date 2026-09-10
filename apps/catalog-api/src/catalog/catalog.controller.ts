import { Controller, Get, Param, Query } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { GetProductsDto } from './dto/get-products.dto';

@Controller('v1')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('products')
  getProducts(@Query() query: GetProductsDto) {
    return this.catalogService.getProducts(query);
  }

  @Get('products/:slug')
  getProductBySlug(@Param('slug') slug: string) {
    return this.catalogService.getProductBySlug(slug);
  }

  @Get('variants/:variantId')
  getVariant(@Param('variantId') variantId: string) {
    return this.catalogService.getVariant(variantId);
  }

  @Get('products/:slug/layout')
  getProductLayout(
    @Param('slug') slug: string,
    @Query('variantId') variantId?: string,
  ) {
    return this.catalogService.getProductLayout(slug, variantId);
  }

  @Get('variants/:variantId/pricing')
  getVariantPricing(@Param('variantId') variantId: string) {
    return this.catalogService.getVariantPricing(variantId);
  }
}
