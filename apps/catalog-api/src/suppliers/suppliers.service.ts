import { Injectable, NotFoundException } from '@nestjs/common';
import { SupplierCatalogAdapter } from './supplier.interface';
import { BoardGamesMakerAdapter } from './board-games-maker.adapter';
import { TheGameCrafterAdapter } from './the-game-crafter.adapter';

@Injectable()
export class SuppliersService {
  private adapters: Map<string, SupplierCatalogAdapter> = new Map();

  constructor(
    private readonly bgmAdapter: BoardGamesMakerAdapter,
    private readonly tgcAdapter: TheGameCrafterAdapter,
  ) {
    this.adapters.set('bgm', this.bgmAdapter);
    this.adapters.set('tgc', this.tgcAdapter);
  }

  getAdapter(supplierCode: string): SupplierCatalogAdapter {
    const adapter = this.adapters.get(supplierCode);
    if (!adapter) {
      throw new NotFoundException(
        `Adapter for supplier ${supplierCode} not found`,
      );
    }
    return adapter;
  }
}
