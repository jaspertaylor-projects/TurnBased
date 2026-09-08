import { Module } from '@nestjs/common';
import { BoardGamesMakerAdapter } from './board-games-maker.adapter';
import { TheGameCrafterAdapter } from './the-game-crafter.adapter';
import { SuppliersService } from './suppliers.service';

@Module({
  providers: [BoardGamesMakerAdapter, TheGameCrafterAdapter, SuppliersService],
  exports: [SuppliersService],
})
export class SuppliersModule {}
