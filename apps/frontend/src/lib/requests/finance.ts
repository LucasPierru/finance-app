import { api } from './api';
import type { CreateEntryBody, FinanceCategory, FinanceEntryItem, InvestmentSettings } from '@finance-app/shared-types';

export const httpGetFinanceCategories = (headers?: HeadersInit): Promise<FinanceCategory[] | null> =>
  api.get<FinanceCategory[]>('/v1/finance/categories', { headers }).catch(() => null);

export const httpGetFinanceState = <T = unknown>(headers?: HeadersInit): Promise<T | null> =>
  api.get<T>('/v1/finance/state', { headers }).catch(() => null);

export const httpGetFinanceEntries = (headers?: HeadersInit): Promise<unknown> =>
  api.get('/v1/finance/entries', { headers }).catch(() => null);

export const httpPutFinanceRevenues = (items: FinanceEntryItem[]): Promise<void> =>
  api.put('/v1/finance/revenues', items);

export const httpPutFinanceCosts = (items: FinanceEntryItem[]): Promise<void> =>
  api.put('/v1/finance/costs', items);

export const httpPutFinanceSettings = (settings: InvestmentSettings): Promise<void> =>
  api.put('/v1/finance/settings', settings);

export const httpPostFinanceEntry = <T = unknown>(body: CreateEntryBody): Promise<T> =>
  api.post('/v1/finance/entries', body);
