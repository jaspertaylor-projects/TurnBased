import { IsString, IsNumber, IsObject, Min, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateQuoteDto {
  @IsString()
  @IsNotEmpty()
  quoteRequestId: string;

  @IsString()
  @IsNotEmpty()
  supplierCode: string;

  @IsString()
  @IsNotEmpty()
  productSlug: string;

  @IsString()
  @IsNotEmpty()
  variantId: string;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsString()
  currency?: string = 'USD';

  @IsOptional()
  @IsObject()
  optionSelections?: Record<string, string>;
}
