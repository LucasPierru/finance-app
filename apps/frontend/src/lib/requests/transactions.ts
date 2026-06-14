import { api } from './api';
import type { BankTransaction, CombinedTransactionSummary, CreateManualTransactionBody, PagedTransactionsResult, TransactionSummary, UpdateTransactionBody } from '@finance-app/shared-types';

export const httpGetTransactions = (params: URLSearchParams, headers?: HeadersInit): Promise<PagedTransactionsResult | null> =>
  api.get<PagedTransactionsResult>(`/v1/transactions?${params}`, { headers }).catch(() => null);

export const httpGetTransactionSummary = (params: URLSearchParams, headers?: HeadersInit): Promise<TransactionSummary | null> =>
  api.get<TransactionSummary>(`/v1/transactions/summary?${params}`, { headers }).catch(() => null);

export const httpGetTransactionSummaries = (month: string, previousMonth: string, headers?: HeadersInit): Promise<CombinedTransactionSummary | null> => {
  const params = new URLSearchParams({ month, previousMonth });
  return api.get<CombinedTransactionSummary>(`/v1/transactions/summary?${params}`, { headers }).catch(() => null);
};

export const httpPostManualTransaction = (body: CreateManualTransactionBody): Promise<BankTransaction> =>
  api.post<BankTransaction>('/v1/transactions', body);

export const httpPatchTransaction = <T = BankTransaction>(id: string, body: UpdateTransactionBody): Promise<T> =>
  api.patch(`/v1/transactions/${id}`, body);

export const httpDeleteTransaction = (id: string): Promise<void> =>
  api.delete(`/v1/transactions/${id}`);
