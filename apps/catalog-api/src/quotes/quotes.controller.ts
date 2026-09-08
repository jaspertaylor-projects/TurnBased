import { Controller, Post, Body } from '@nestjs/common';
import { QuotesService } from './quotes.service';
import { CreateQuoteDto } from './dto/create-quote.dto';

@Controller('v1/quotes')
export class QuotesController {
  constructor(private readonly quotesService: QuotesService) {}

  @Post()
  createQuote(@Body() dto: CreateQuoteDto) {
    return this.quotesService.createQuote(dto);
  }
}
