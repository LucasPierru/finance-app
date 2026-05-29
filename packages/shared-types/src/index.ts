export interface User {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  birthDate: string | null;
}

export type FinanceEntryType = "income" | "expense";

export type FinanceFrequency = "weekly" | "biweekly" | "monthly" | "yearly";

export interface SubCategory {
  id: string;
  categoryId: string;
  type: FinanceEntryType;
  name: string;
  keywords: string[];
}

export interface FinanceCategory {
  id: string;
  type: FinanceEntryType;
  name: string;
  keywords: string[];
  subCategories: SubCategory[];
}

export interface FinanceItemInput {
  id: string;
  name: string;
  categoryId?: string;
  categoryName?: string;
  amount: number;
  rawAmount: string;
  frequency: FinanceFrequency;
}

export interface FinanceItem {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
  amount: number;
  rawAmount: string;
  frequency: FinanceFrequency;
}

export interface FinanceEntry extends FinanceItem {
  type: FinanceEntryType;
}

export interface InvestmentSettings {
  annualReturn: number;
  years: number;
  initialAmount: number;
  dividendYield: number;
  incomeGrowth: number;
  expenseGrowth: number;
}

export interface FinanceState {
  revenues: FinanceItem[];
  costs: FinanceItem[];
  categories: FinanceCategory[];
  investmentSettings: InvestmentSettings;
}

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
  /** Raw Plaid category array (empty for manual transactions) */
  category: string[];
  pending: boolean;
  /** Effective flow direction — always set; user can override via PATCH */
  flow: 'income' | 'expense';
  /** Plaid personal_finance_category primary (e.g. FOOD_AND_DRINK, TRANSFER_IN) */
  personalFinanceCategory: string | null;
  /** Plaid personal_finance_category detailed (e.g. RESTAURANTS, GROCERIES) */
  personalFinanceCategoryDetailed: string | null;
  /** User-selected category id (null = auto-detected) */
  categoryId: string | null;
  /** Resolved name for categoryId */
  categoryName: string | null;
  /** Optional sub-category under the main category */
  subCategoryId: string | null;
  subCategoryName: string | null;
  /** When true, excluded from home-page summary totals */
  isInternal: boolean;
}

export interface CreateManualTransactionBody {
  name?: string;
  date?: string;
  amount?: number;
  flow?: "income" | "expense";
  categoryId?: string | null;
  subCategoryId?: string | null;
}

export interface UpdateTransactionBody {
  categoryId?: string | null;
  subCategoryId?: string | null;
  flow?: 'income' | 'expense';
  isInternal?: boolean;
  /** When true, apply the same category/flow/isInternal/subCategoryId to similar transactions using fuzzy name matching. */
  applyToSimilar?: boolean;
}

export interface PlaidConnection {
  itemId: string;
  institutionName: string | null;
  lastSyncAt: string | null;
  accounts: BankAccount[];
}

export interface BankConnectionState {
  connected: boolean;
  /** All individual bank connections for the user. */
  connections: PlaidConnection[];
  /** Convenience: institution name of the first connection (null if none). */
  institutionName: string | null;
  /** Convenience: most-recent lastSyncAt across all connections. */
  lastSyncAt: string | null;
  /** All accounts merged across every connection. */
  accounts: BankAccount[];
  recentTransactions: BankTransaction[];
}

export interface StoredBankState {
  accessToken: string;
  itemId: string;
  institutionName: string | null;
  cursor: string | null;
  lastSyncAt: string | null;
  accounts: BankAccount[];
  transactions: BankTransaction[];
}

export interface TransactionFilters {
  month?: string;
  flow?: "income" | "expense";
  search?: string;
  minAmount?: number;
  maxAmount?: number;
  categoryId?: string;
  subCategoryId?: string;
  sortBy?: "date" | "name" | "amount";
  sortDir?: "asc" | "desc";
}

export interface TransactionSummary {
  totalIncome: number;
  totalExpenses: number;
  transferCount: number;
  expenseTransactionCount: number;
  categoryBreakdown: Array<{ category: string; totalAmount: number }>;
  dailyExpenseBreakdown: Array<{ date: string; totalAmount: number }>;
}

export interface PagedTransactionsResult {
  transactions: BankTransaction[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface AuthUser {
  id: User["id"];
  email: User["email"];
  name: string;
  dateOfBirth: User["birthDate"];
  phoneNumber: User["phone"];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface RegisterProfile {
  email: string;
  name: string;
  dateOfBirth: string;
  phoneNumber: string;
}

export interface RegisterBody {
  email?: string;
  name?: string;
  phone?: string;
  birthDate?: string;
}

export interface RequestCodeBody {
  email?: string;
}

export interface VerifyCodeBody {
  email?: string;
  code?: string;
}

export interface RefreshBody {
  refreshToken?: string;
}

export interface LogoutBody {
  refreshToken?: string;
}

export interface FinanceEntryItem {
  id?: string;
  name?: string;
  categoryId?: string;
  categoryName?: string;
  amount?: number;
  rawAmount?: string;
  frequency?: FinanceFrequency;
}

export interface CreateCategoryBody {
  type?: FinanceEntryType;
  name?: string;
}

export interface CreateEntryBody {
  type?: FinanceEntryType;
  id?: string;
  name?: string;
  categoryId?: string;
  categoryName?: string;
  amount?: number;
  rawAmount?: string;
  frequency?: FinanceFrequency;
}

export type ReplaceEntriesBody = FinanceEntryItem[];

export type UpdateSettingsBody = Partial<InvestmentSettings>;

export interface CreateLinkTokenBody {
  countryCode?: string;
}

export interface ExchangePublicTokenBody {
  publicToken?: string;
  institutionName?: string;
}

export interface Budget {
  id: string;
  name: string;
  categoryId: string | null;
  categoryName: string | null;
  amount: number;
  period: "weekly" | "monthly" | "yearly";
}

export interface CreateBudgetBody {
  name?: string;
  categoryId?: string | null;
  amount?: number;
  period?: "weekly" | "monthly" | "yearly";
}

export interface UpdateBudgetBody {
  name?: string;
  categoryId?: string | null;
  amount?: number;
  period?: "weekly" | "monthly" | "yearly";
}

export interface BudgetPlanItem {
  id: string;
  planId: string;
  categoryId: string | null;
  categoryName: string | null;
  amount: number;
  period: "weekly" | "monthly" | "yearly";
}

export interface BudgetPlan {
  id: string;
  name: string;
  items: BudgetPlanItem[];
}

export interface CreateBudgetPlanBody {
  name?: string;
  items?: Array<{
    categoryId?: string | null;
    amount?: number;
    period?: "weekly" | "monthly" | "yearly";
  }>;
}

export interface UpdateBudgetPlanBody {
  name?: string;
  items?: Array<{
    categoryId?: string | null;
    amount?: number;
    period?: "weekly" | "monthly" | "yearly";
  }>;
}
