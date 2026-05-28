import { api } from './api';
import type { BankConnectionState } from '@finance-app/shared-types';

export async function httpGetPlaidState(headers: HeadersInit): Promise<BankConnectionState | null>;
export async function httpGetPlaidState(): Promise<BankConnectionState>;
export async function httpGetPlaidState(headers?: HeadersInit): Promise<BankConnectionState | null> {
  return headers !== undefined
    ? api.get<BankConnectionState>('/api/plaid/state', { headers }).catch(() => null)
    : api.get('/api/plaid/state');
}

export const httpPostPlaidLinkToken = (countryCode: string): Promise<{ linkToken: string }> =>
  api.post('/api/plaid/link-token', { countryCode });

export const httpPostPlaidExchangePublicToken = (
  publicToken: string,
  institutionName: string | null
): Promise<BankConnectionState> =>
  api.post('/api/plaid/exchange-public-token', { publicToken, institutionName });

export const httpPostPlaidSync = (): Promise<BankConnectionState> =>
  api.post('/api/plaid/sync');

export const httpDeletePlaidConnection = (itemId: string): Promise<{ connected: boolean }> =>
  api.delete(`/api/plaid/connection?itemId=${encodeURIComponent(itemId)}`);
