import { api } from './api';
import type { BankTransaction, PagedTransactionsResult, TransactionSummary, UpdateTransactionBody } from '@finance-app/shared-types';

export const httpGetTransactions = (params: URLSearchParams, headers?: HeadersInit): Promise<PagedTransactionsResult | null> =>
  api.get<PagedTransactionsResult>(`/api/plaid/transactions?${params}`, { headers }).catch(() => null);

export const httpGetTransactionSummary = (params: URLSearchParams, headers?: HeadersInit): Promise<TransactionSummary | null> =>
  api.get<TransactionSummary>(`/api/plaid/transactions/summary?${params}`, { headers }).catch(() => null);

export const httpPatchTransaction = <T = BankTransaction>(id: string, body: UpdateTransactionBody): Promise<T> =>
  api.patch(`/api/plaid/transactions/${id}`, body);

export const httpDeleteTransaction = (id: string): Promise<void> =>
  api.delete(`/api/plaid/transactions/${id}`);
