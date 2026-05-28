import { api } from './api';
import type { CreateEntryBody, FinanceCategory, FinanceEntryItem, InvestmentSettings } from '@finance-app/shared-types';

export const httpGetFinanceCategories = (headers?: HeadersInit): Promise<FinanceCategory[] | null> =>
  api.get<FinanceCategory[]>('/api/finance/categories', { headers }).catch(() => null);

export const httpGetFinanceState = <T = unknown>(headers?: HeadersInit): Promise<T | null> =>
  api.get<T>('/api/finance/state', { headers }).catch(() => null);

export const httpGetFinanceEntries = (headers?: HeadersInit): Promise<unknown> =>
  api.get('/api/finance/entries', { headers }).catch(() => null);

export const httpPutFinanceRevenues = (items: FinanceEntryItem[]): Promise<void> =>
  api.put('/api/finance/revenues', items);

export const httpPutFinanceCosts = (items: FinanceEntryItem[]): Promise<void> =>
  api.put('/api/finance/costs', items);

export const httpPutFinanceSettings = (settings: InvestmentSettings): Promise<void> =>
  api.put('/api/finance/settings', settings);

export const httpPostFinanceEntry = <T = unknown>(body: CreateEntryBody): Promise<T> =>
  api.post('/api/finance/entries', body);
