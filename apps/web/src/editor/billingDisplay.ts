import { getModelOption } from './aiModelCatalog';

export interface BillingLedgerRow {
  id: string;
  provider: string;
  model_id: string;
  modality: string;
  provider_cost_cents: number;
  platform_fee_cents: number;
  total_charged_cents: number;
  request_meta: Record<string, unknown> | null;
  response_meta?: Record<string, unknown> | null;
  created_at: string;
}

const moneyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const exactMoneyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 6,
  maximumFractionDigits: 6,
});

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function formatCents(cents: number | null | undefined): string {
  return moneyFormatter.format((cents ?? 0) / 100);
}

export function formatUsdEstimate(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '$0.00';
  if (value > 0 && value < 0.01) return '< $0.01';
  return moneyFormatter.format(value);
}

export function formatExactUsd(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '$0.000000';
  return exactMoneyFormatter.format(value);
}

export function getPromptTokens(row: BillingLedgerRow): number | null {
  return readNumber(row.response_meta?.prompt_tokens);
}

export function getCompletionTokens(row: BillingLedgerRow): number | null {
  return readNumber(row.response_meta?.completion_tokens);
}

export function getProviderUsd(row: BillingLedgerRow): number {
  const stored = readNumber(row.response_meta?.provider_cost_usd);
  if (stored !== null) return stored;

  const model = getModelOption(row.model_id);
  const flatCostCents = model?.priceMeta?.flatCostCents;
  if (typeof flatCostCents === 'number') return flatCostCents / 100;

  const inputPerMillionUsd = model?.priceMeta?.inputPerMillionUsd;
  const outputPerMillionUsd = model?.priceMeta?.outputPerMillionUsd;
  const promptTokens = getPromptTokens(row);
  const completionTokens = getCompletionTokens(row);
  if (
    typeof inputPerMillionUsd === 'number'
    && typeof outputPerMillionUsd === 'number'
    && promptTokens !== null
    && completionTokens !== null
  ) {
    return ((promptTokens * inputPerMillionUsd) + (completionTokens * outputPerMillionUsd)) / 1_000_000;
  }

  return row.provider_cost_cents / 100;
}

export function getPlatformFeeUsd(row: BillingLedgerRow): number {
  const stored = readNumber(row.response_meta?.platform_fee_usd);
  if (stored !== null) return stored;
  const providerUsd = getProviderUsd(row);
  if (providerUsd > 0 && row.platform_fee_cents === 0 && row.provider_cost_cents === 0) {
    return providerUsd;
  }
  return row.platform_fee_cents / 100;
}

export function getTotalChargedUsd(row: BillingLedgerRow): number {
  const stored = readNumber(row.response_meta?.total_charged_usd);
  if (stored !== null) return stored;
  const providerUsd = getProviderUsd(row);
  const feeUsd = getPlatformFeeUsd(row);
  if (providerUsd > 0 && row.total_charged_cents === 0) return providerUsd + feeUsd;
  return row.total_charged_cents / 100;
}

export function getWalletDebitUsd(row: BillingLedgerRow): number {
  return row.total_charged_cents / 100;
}
