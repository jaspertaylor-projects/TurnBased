import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import type { Quote } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateQuoteDto } from './dto/create-quote.dto';

/** Flat per-copy handling fee The Game Crafter charges on custom-printed products (USD). */
const TGC_HANDLING_FEE_PER_COPY = 0.89;

@Injectable()
export class QuotesService {
  constructor(private readonly prisma: PrismaService) {}

  async createQuote(dto: CreateQuoteDto) {
    // 1. Idempotency Check
    const existingQuote = await this.prisma.quote.findUnique({
      where: { quoteRequestId: dto.quoteRequestId },
    });
    if (existingQuote) {
      return this.formatQuoteResponse(existingQuote);
    }

    // 2. Resolve Product, Supplier, and Variant
    const supplier = await this.prisma.supplier.findUnique({
      where: { code: dto.supplierCode },
    });
    if (!supplier) throw new NotFoundException('Supplier not found');

    const product = await this.prisma.catalogProduct.findUnique({
      where: { slug: dto.productSlug },
    });
    if (!product) throw new NotFoundException('Product not found');

    const variant = await this.prisma.productVariant.findUnique({
      where: { id: dto.variantId },
      include: { priceTiers: true },
    });
    if (!variant || variant.productId !== product.id) {
      throw new NotFoundException('Variant not found for this product');
    }

    // 3. Find matching PriceTier
    const sortedTiers = variant.priceTiers.sort(
      (a, b) => a.minQuantity - b.minQuantity,
    );
    let matchedTier = null;
    for (const tier of sortedTiers) {
      if (
        dto.quantity >= tier.minQuantity &&
        (!tier.maxQuantity || dto.quantity <= tier.maxQuantity)
      ) {
        matchedTier = tier;
        break;
      }
    }

    if (!matchedTier) {
      // Fallback: pick the highest tier if quantity exceeds all max
      if (
        sortedTiers.length > 0 &&
        dto.quantity >= sortedTiers[sortedTiers.length - 1].minQuantity
      ) {
        matchedTier = sortedTiers[sortedTiers.length - 1];
      } else {
        throw new BadRequestException(
          'No applicable pricing tier for requested quantity',
        );
      }
    }

    // 4. Compute Subtotal
    const unitPrice = matchedTier.unitPrice.toNumber();
    const subtotal = unitPrice * dto.quantity;

    // 5. Apply configurable rule model
    const rules = {
      defaultMarkupRate: 0.1,
      categoryMarkupRates: {
        cards: 0.12,
        boards: 0.15,
      },
      riskBufferRules: {
        default: { type: 'percent', value: 0.03 },
      },
    };

    const markupRate = Object.keys(rules.categoryMarkupRates).includes(
      product.category,
    )
      ? rules.categoryMarkupRates[
          product.category as keyof typeof rules.categoryMarkupRates
        ]
      : rules.defaultMarkupRate;

    const markupAmount = subtotal * markupRate;
    const riskBufferAmount = subtotal * rules.riskBufferRules.default.value;

    // The Game Crafter charges a flat per-copy handling fee on its custom-printed
    // products (decks, boards, booklets, score pads, boxes). It is a pass-through
    // cost added after markup/buffer so it isn't marked up. It applies only to
    // TGC's curated printable products (identified by the `tgc-curated-` external
    // id prefix), not to stock parts or other suppliers.
    const isTgcPrinted =
      dto.supplierCode === 'tgc' &&
      !!product.externalProductId?.startsWith('tgc-curated-');
    const handlingAmount = isTgcPrinted
      ? TGC_HANDLING_FEE_PER_COPY * dto.quantity
      : 0;

    const total = subtotal + markupAmount + riskBufferAmount + handlingAmount;

    const catalogVersion = `${new Date().toISOString().split('T')[0]}T00:00:00Z`;

    // 6. Persist Quote
    const quote = await this.prisma.quote.create({
      data: {
        quoteRequestId: dto.quoteRequestId,
        supplierId: supplier.id,
        productId: product.id,
        variantId: variant.id,
        quantity: dto.quantity,
        currency: dto.currency || 'USD',
        inputOptionsJson: dto.optionSelections || {},
        pricingInputsJson: {
          matchedTierId: matchedTier.id,
          unitPrice,
          markupRate,
          riskBufferRule: rules.riskBufferRules.default,
          handlingFeePerCopy: isTgcPrinted ? TGC_HANDLING_FEE_PER_COPY : 0,
        },
        unitPrice,
        subtotal,
        markupAmount,
        riskBufferAmount,
        handlingAmount,
        total,
        catalogVersion,
      },
    });

    return this.formatQuoteResponse(quote);
  }

  private formatQuoteResponse(quote: Quote) {
    return {
      quoteId: quote.id,
      catalogVersion: quote.catalogVersion,
      unitPrice: Number(quote.unitPrice),
      subtotal: Number(quote.subtotal),
      markupAmount: Number(quote.markupAmount),
      riskBufferAmount: Number(quote.riskBufferAmount),
      handlingAmount: Number(quote.handlingAmount),
      total: Number(quote.total),
      currency: quote.currency,
      pricingSource: {
        variantId: quote.variantId,
        pricingInputs: quote.pricingInputsJson,
      },
    };
  }
}
