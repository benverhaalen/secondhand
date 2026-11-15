import { api, ApiFailure } from '@/api/client';
import { itemView } from '@/data/world';
import type { Item } from '@/demo';

export type Money = { amount_cents: number; currency: string };
export type SellerItem = { item: Item; version: number; price: Money | null; cost: Money | null };
export const moneyOf = (value: unknown): Money | null => {
  if (!value || typeof value !== 'object') return null;
  const valueMoney = value as Partial<Money>;
  return Number.isSafeInteger(valueMoney.amount_cents) && typeof valueMoney.currency === 'string'
    ? valueMoney as Money : null;
};
export const showMoney = (value: Money | null) => value ? new Intl.NumberFormat('en-US', { style: 'currency', currency: value.currency }).format(value.amount_cents / 100) : 'Pending';
export function amountOf(value: string): number | null {
  if (!/^\d+(\.\d{1,2})?$/.test(value.trim())) return null;
  const cents = Math.round(Number(value) * 100);
  return Number.isSafeInteger(cents) ? cents : null;
}
export const sellerError = (error: unknown) => error instanceof ApiFailure && error.status === 409
  ? 'This item changed. Reload it before saving again.'
  : error instanceof ApiFailure && error.status === 401 ? 'Sign in again to continue.'
  : error instanceof Error ? error.message : 'Could not save your changes. Retry.';
export async function readItem(id: string, signal?: AbortSignal): Promise<SellerItem> {
  const row = await api.call<Record<string, unknown>>(`GET /v1/items/${encodeURIComponent(id)}`, { signal });
  if (row.id !== id || !Number.isSafeInteger(row.version) || Number(row.version) < 1) throw new Error('This item could not be loaded for editing.');
  return { item: itemView(row), version: Number(row.version), price: moneyOf(row.price_cents), cost: moneyOf(row.cost) };
}
export async function saveItem(data: SellerItem, edits: { title?: string; quantity?: number; location?: { label: string }; cost?: Money; price_cents?: Money }) {
  return api.call(`PATCH /v1/items/${encodeURIComponent(data.item.id)}`, { body: { version: data.version, ...edits } });
}
