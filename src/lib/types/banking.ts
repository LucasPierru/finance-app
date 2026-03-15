export interface BankAccount {
  accountId: string;
  name: string;
  officialName: string | null;
  mask: string | null;
  type: string;
  subtype: string | null;
  currentBalance: number | null;
  availableBalance: number | null;
  isoCurrencyCode: string | null;
}

export interface BankTransaction {
  transactionId: string;
  accountId: string;
  date: string;
  name: string;
  merchantName: string | null;
  amount: number;
  isoCurrencyCode: string | null;
  category: string[];
  pending: boolean;
}

export interface BankConnectionState {
  connected: boolean;
  institutionName: string | null;
  lastSyncAt: string | null;
  accounts: BankAccount[];
  recentTransactions: BankTransaction[];
}
