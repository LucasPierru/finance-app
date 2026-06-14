import { api } from './api';
import type { BankConnectionState } from '@finance-app/shared-types';

export async function httpGetPlaidState(headers: HeadersInit): Promise<BankConnectionState | null>;
export async function httpGetPlaidState(): Promise<BankConnectionState>;
export async function httpGetPlaidState(headers?: HeadersInit): Promise<BankConnectionState | null> {
  return headers !== undefined
    ? api.get<BankConnectionState>('/v1/plaid/state', { headers }).catch(() => null)
    : api.get('/v1/plaid/state');
}

export const httpPostPlaidLinkToken = (countryCode: string): Promise<{ linkToken: string }> =>
  api.post('/v1/plaid/link-token', { countryCode });

export const httpPostPlaidExchangePublicToken = (
  publicToken: string,
  institutionName: string | null
): Promise<BankConnectionState> =>
  api.post('/v1/plaid/exchange-public-token', { publicToken, institutionName });

export const httpPostPlaidSync = (): Promise<BankConnectionState> =>
  api.post('/v1/plaid/sync');

export const httpDeletePlaidConnection = (itemId: string): Promise<{ connected: boolean }> =>
  api.delete(`/v1/plaid/connection?itemId=${encodeURIComponent(itemId)}`);
