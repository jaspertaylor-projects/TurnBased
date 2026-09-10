import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Prisma } from '@prisma/client';
import { GetProductsDto } from './dto/get-products.dto';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async getProducts(query: GetProductsDto) {
    const cacheKey = `catalog:products:${JSON.stringify(query)}`;
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) return cached;

    const {
      category,
      subcategory,
      q,
      page = 1,
      pageSize = 20,
      activeOnly = true,
    } = query;
    const where: Prisma.CatalogProductWhereInput = {};
    if (category) where.category = category;
    if (subcategory) where.subcategory = subcategory;
    if (activeOnly) where.status = 'active';
    if (q) {
      where.title = { contains: q, mode: 'insensitive' };
    }

    const items = await this.prisma.catalogProduct.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    const total = await this.prisma.catalogProduct.count({ where });

    const result = {
      items,
      total,
      page,
      pageSize,
    };

    await this.cacheManager.set(cacheKey, result, 60000);
    return result;
  }

  async getProductBySlug(slug: string) {
    const product = await this.prisma.catalogProduct.findUnique({
      where: { slug },
      include: {
        productVariants: {
          include: {
            options: true,
            layoutConstraints: true,
            priceTiers: true,
          },
        },
      },
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async getVariant(variantId: string) {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
      include: {
        options: true,
        layoutConstraints: true,
        priceTiers: true,
      },
    });
    if (!variant) throw new NotFoundException('Variant not found');
    return variant;
  }

  async getProductLayout(slug: string, variantId?: string) {
    const product = await this.prisma.catalogProduct.findUnique({
      where: { slug },
      include: {
        productVariants: {
          where: variantId ? { id: variantId } : { isDefault: true },
          include: { layoutConstraints: true },
        },
      },
    });

    if (!product || product.productVariants.length === 0) {
      throw new NotFoundException('Layout not found');
    }

    const variant = product.productVariants[0];

    return {
      productSlug: product.slug,
      variantId: variant.id,
      faces: variant.layoutConstraints,
      constraints: {
        panelCount: variant.layoutConstraints[0]?.panelCount || 1,
        cutlineRequired: variant.layoutConstraints[0]?.cutlineRequired || false,
      },
    };
  }

  async getVariantPricing(variantId: string) {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
      include: { priceTiers: true, catalogProduct: true },
    });

    if (!variant) throw new NotFoundException('Variant not found');

    return {
      variantId: variant.id,
      currency: variant.catalogProduct.currency,
      tiers: variant.priceTiers,
    };
  }
}
