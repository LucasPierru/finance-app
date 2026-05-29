import type {
  FinanceItem,
  FinanceStatePayload,
  InvestmentSettings,
  ProjectionPoint,
} from "$lib/stores/finance";
import type { BankConnectionState, BankTransaction, FinanceCategory } from "@finance-app/shared-types";

export type { FinanceCategory };

export interface CategorizedBankTransaction {
  transactionId: string;
  accountId: string;
  date: string;
  name: string;
  merchantName: string | null;
  amount: number;
  isoCurrencyCode: string | null;
  category: string[];
  pending: boolean;
  flow: "income" | "expense";
  personalFinanceCategory: string | null;
  personalFinanceCategoryDetailed: string | null;
  categoryId: string | null;
  categoryName: string | null;
  resolvedCategory: string;
  resolvedCategoryId: string | null;
  merchantKey: string;
  isTransfer: boolean;
  isInternal: boolean;
}

export interface RecurringBankEntry {
  merchantKey: string;
  displayName: string;
  resolvedCategory: string;
  flow: "income" | "expense";
  occurrences: number;
  averageAmount: number;
  cadence: "weekly" | "biweekly" | "monthly" | "quarterly";
  lastSeenDate: string;
}

export interface EffectiveFinanceView {
  revenues: FinanceItem[];
  costs: FinanceItem[];
  totalRevenue: number;
  totalCosts: number;
  monthlySurplus: number;
  isUsingSyncedCashflow: boolean;
  categorizedBankTransactions: CategorizedBankTransaction[];
  recurringBankEntries: RecurringBankEntry[];
  detectedTransferCount: number;
}

export const emptyFinanceState: FinanceStatePayload = {
  revenues: [],
  costs: [],
  investmentSettings: {
    annualReturn: 7,
    years: 20,
    initialAmount: 0,
    dividendYield: 2,
    incomeGrowth: 2,
    expenseGrowth: 2,
  },
};

export const emptyBankState: BankConnectionState = {
  connected: false,
  connections: [],
  institutionName: null,
  lastSyncAt: null,
  accounts: [],
  recentTransactions: [],
};

const incomeCategories = new Set<string>([
  "Salary",
  "Freelance",
  "Business",
  "Investments",
  "Rental",
  "Benefits",
  "Other",
]);

const expenseCategories = new Set<string>([
  "Housing",
  "Food",
  "Transport",
  "Utilities",
  "Insurance",
  "Debt",
  "Health",
  "Entertainment",
  "Education",
  "Shopping",
  "Other",
]);

const categoryKeywordMap: Array<{ category: string; keywords: string[] }> = [
  { category: "Housing", keywords: ["rent", "mortgage", "landlord", "property"] },
  { category: "Utilities", keywords: ["electric", "water", "gas", "internet", "phone", "utility"] },
  { category: "Food", keywords: ["grocery", "market", "restaurant", "coffee", "uber eats", "doordash"] },
  { category: "Transport", keywords: ["fuel", "gas station", "uber", "lyft", "metro", "transit", "airline", "airlines", "travel", "car rental", "parking", "toll", "train", "bus", "subway"] },
  { category: "Insurance", keywords: ["insurance", "insure", "geico", "allstate", "progressive"] },
  { category: "Health", keywords: ["pharmacy", "clinic", "hospital", "medical", "dental", "doctor", "cvs", "walgreens", "health", "vision", "optometrist"] },
  { category: "Shopping", keywords: ["amazon", "store", "shop", "retail", "shops", "walmart", "target", "costco", "ebay", "online shopping", "merchandise", "clothing"] },
  { category: "Entertainment", keywords: ["netflix", "spotify", "cinema", "game", "streaming", "hulu", "disney", "music", "gym", "fitness", "recreation", "apple tv", "youtube", "twitch"] },
  { category: "Salary", keywords: ["salary", "payroll", "paycheck", "deposit", "direct deposit", "paystub"] },
  { category: "Investments", keywords: ["dividend", "interest", "brokerage", "fidelity", "vanguard", "schwab", "robinhood", "investment"] },
  { category: "Benefits", keywords: ["benefit", "refund", "rebate", "cashback", "reward"] },
];

function normalizeMerchantKey(transaction: BankTransaction): string {
  return (transaction.merchantName || transaction.name || "Unknown")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/**
 * Detects credit card payments and internal account moves that cause double-counting
 * and should be excluded from income/expense totals.
 * ACH payments to external parties (rent, mortgage) are TRANSFER_OUT but are genuine
 * expenses — only TRANSFER_OUT_CREDIT_CARD_PAYMENT is excluded.
 */
export function isTransferTransaction(
  transaction: Pick<BankTransaction, 'category' | 'name' | 'personalFinanceCategory' | 'personalFinanceCategoryDetailed'>,
): boolean {
  // Credit card payment (debit from checking = credit on card — counts in both accounts)
  if (transaction.personalFinanceCategoryDetailed === 'TRANSFER_OUT_CREDIT_CARD_PAYMENT') return true;
  // Internal account moves showing as income in the destination account
  if (
    transaction.personalFinanceCategory === 'TRANSFER_IN' &&
    (transaction.personalFinanceCategoryDetailed === 'TRANSFER_IN_ACCOUNT_TRANSFER' ||
      transaction.personalFinanceCategoryDetailed === 'TRANSFER_IN_SAVINGS')
  ) return true;
  // Legacy Plaid category array fallback
  if (
    transaction.category.length >= 2 &&
    transaction.category[0]?.toLowerCase() === 'transfer' &&
    transaction.category[1]?.toLowerCase() === 'credit card'
  ) return true;
  // Name-based fallback
  const n = transaction.name.toLowerCase();
  return n.includes('credit card payment') || n.includes('autopay');
}

function resolveCategoryFromDb(
  transaction: BankTransaction,
  categories: FinanceCategory[],
): { name: string; id: string | null } {
  // User override takes priority
  if (transaction.categoryId && transaction.categoryName) {
    return { name: transaction.categoryName, id: transaction.categoryId };
  }

  const flow = transaction.flow;
  const haystack = `${transaction.name} ${transaction.merchantName ?? ""} ${(transaction.category ?? []).join(" ")}`.toLowerCase();

  const matchedCat = categories
    .filter((c) => c.type === flow)
    .find((c) => c.keywords.some((kw) => haystack.includes(kw.toLowerCase())));

  if (matchedCat) return { name: matchedCat.name, id: matchedCat.id };

  // Fall back to Plaid category array
  if (transaction.category.length > 0 && transaction.category[0]) {
    return { name: transaction.category[0], id: null };
  }

  return { name: flow === "income" ? "Income" : "Expense", id: null };
}

// Legacy resolver used when no DB categories available
function resolveCategory(transaction: BankTransaction): string {
  if (transaction.categoryName) return transaction.categoryName;
  if (transaction.category.length > 0 && transaction.category[0]) {
    return transaction.category[0];
  }
  const haystack = `${transaction.name} ${transaction.merchantName ?? ""}`.toLowerCase();
  const matched = categoryKeywordMap.find((entry) => entry.keywords.some((keyword) => haystack.includes(keyword)));
  if (matched) return matched.category;
  return transaction.flow === "income" ? "Income" : "Expense";
}

function isRecentTransaction(dateValue: string): boolean {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    return false;
  }

  const ageInDays = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
  return ageInDays >= 0 && ageInDays <= 30;
}

function normalizeIncomeCategory(category: string, categories: FinanceCategory[]): string {
  if (categories.length > 0) {
    const matched = categories.find((c) => c.type === "income" && c.name === category);
    return matched ? matched.name : "Other";
  }
  const value = category.trim();
  return incomeCategories.has(value) ? value : "Other";
}

function normalizeExpenseCategory(category: string, categories: FinanceCategory[]): string {
  if (categories.length > 0) {
    const matched = categories.find((c) => c.type === "expense" && c.name === category);
    return matched ? matched.name : "Other";
  }
  const value = category.trim();
  return expenseCategories.has(value) ? value : "Other";
}

function average(numbers: number[]): number {
  if (numbers.length === 0) {
    return 0;
  }

  return numbers.reduce((sum, current) => sum + current, 0) / numbers.length;
}

function standardDeviation(numbers: number[]): number {
  if (numbers.length < 2) {
    return 0;
  }

  const mean = average(numbers);
  const variance = numbers.reduce((sum, value) => sum + (value - mean) ** 2, 0) / numbers.length;
  return Math.sqrt(variance);
}

function detectCadence(avgGapDays: number): RecurringBankEntry["cadence"] | null {
  if (avgGapDays >= 5 && avgGapDays <= 10) return "weekly";
  if (avgGapDays >= 11 && avgGapDays <= 18) return "biweekly";
  if (avgGapDays >= 20 && avgGapDays <= 40) return "monthly";
  if (avgGapDays >= 70 && avgGapDays <= 110) return "quarterly";
  return null;
}

export function categorizeBankTransaction(
  transaction: BankTransaction,
  categories: FinanceCategory[] = [],
): CategorizedBankTransaction {
  const flow = transaction.flow;
  const { name: resolvedCategory, id: resolvedCategoryId } =
    categories.length > 0
      ? resolveCategoryFromDb(transaction, categories)
      : { name: resolveCategory(transaction), id: null };
  return {
    ...transaction,
    resolvedCategory,
    resolvedCategoryId,
    flow,
    merchantKey: normalizeMerchantKey(transaction),
    isTransfer: isTransferTransaction(transaction),
  };
}

export function getCategorizedBankTransactions(
  bankState: BankConnectionState,
  categories: FinanceCategory[] = [],
): CategorizedBankTransaction[] {
  return bankState.recentTransactions
    .map((transaction) => categorizeBankTransaction(transaction, categories))
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function getRecurringBankEntries(transactions: CategorizedBankTransaction[]): RecurringBankEntry[] {
  const grouped = new Map<string, CategorizedBankTransaction[]>();

  for (const transaction of transactions) {
    const key = `${transaction.merchantKey}::${transaction.flow}`;
    const bucket = grouped.get(key) ?? [];
    bucket.push(transaction);
    grouped.set(key, bucket);
  }

  const recurring: RecurringBankEntry[] = [];

  for (const [key, bucket] of grouped.entries()) {
    if (bucket.length < 2) {
      continue;
    }

    const sortedByDate = [...bucket].sort((a, b) => a.date.localeCompare(b.date));
    const amounts = sortedByDate.map((transaction) => transaction.amount);
    const avgAmount = average(amounts);
    if (avgAmount <= 0) {
      continue;
    }

    const amountDeviationRatio = standardDeviation(amounts) / avgAmount;
    if (amountDeviationRatio > 0.35) {
      continue;
    }

    const dateDiffs: number[] = [];
    for (let index = 1; index < sortedByDate.length; index += 1) {
      const previous = new Date(sortedByDate[index - 1].date);
      const current = new Date(sortedByDate[index].date);
      const diffInDays = (current.getTime() - previous.getTime()) / (1000 * 60 * 60 * 24);
      if (diffInDays > 0) {
        dateDiffs.push(diffInDays);
      }
    }

    if (dateDiffs.length === 0) {
      continue;
    }

    const cadence = detectCadence(average(dateDiffs));
    if (!cadence) {
      continue;
    }

    const latest = sortedByDate[sortedByDate.length - 1];
    recurring.push({
      merchantKey: key,
      displayName: latest.merchantName || latest.name,
      resolvedCategory: latest.resolvedCategory,
      flow: latest.flow,
      occurrences: sortedByDate.length,
      averageAmount: avgAmount,
      cadence,
      lastSeenDate: latest.date,
    });
  }

  return recurring.sort((a, b) => b.averageAmount - a.averageAmount);
}

export function getEffectiveFinanceView(
  financeState: FinanceStatePayload,
  bankState: BankConnectionState,
  categories: FinanceCategory[] = [],
): EffectiveFinanceView {
  const categorizedBankTransactions = getCategorizedBankTransactions(bankState, categories);

  const incomeByName = new Map<string, { amount: number; category: string; categoryId: string | undefined }>();
  const expenseByName = new Map<string, { amount: number; category: string; categoryId: string | undefined }>();
  let detectedTransferCount = 0;

  for (const transaction of categorizedBankTransactions) {
    if (!isRecentTransaction(transaction.date)) {
      continue;
    }

    if (transaction.isTransfer) {
      detectedTransferCount++;
      continue;
    }

    const key = transaction.merchantName || transaction.name || (transaction.flow === "income" ? "Bank income" : "Bank expense");

    if (transaction.flow === "income") {
      const current = incomeByName.get(key);
      incomeByName.set(key, {
        amount: (current?.amount ?? 0) + transaction.amount,
        category: current?.category ?? normalizeIncomeCategory(transaction.resolvedCategory, categories),
        categoryId: current?.categoryId ?? (transaction.resolvedCategoryId ?? undefined),
      });
      continue;
    }

    const current = expenseByName.get(key);
    expenseByName.set(key, {
      amount: (current?.amount ?? 0) + transaction.amount,
      category: current?.category ?? normalizeExpenseCategory(transaction.resolvedCategory, categories),
      categoryId: current?.categoryId ?? (transaction.resolvedCategoryId ?? undefined),
    });
  }

  const syncedRevenueItems: FinanceItem[] = [...incomeByName.entries()]
    .sort((a, b) => b[1].amount - a[1].amount)
    .map(([name, value], index) => ({
      id: `bank-income-${index}-${name}`,
      name,
      category: value.category,
      categoryId: value.categoryId,
      amount: value.amount,
      rawAmount: value.amount.toFixed(2),
      frequency: "monthly",
    }));

  const syncedCostItems: FinanceItem[] = [...expenseByName.entries()]
    .sort((a, b) => b[1].amount - a[1].amount)
    .map(([name, value], index) => ({
      id: `bank-expense-${index}-${name}`,
      name,
      category: value.category,
      categoryId: value.categoryId,
      amount: value.amount,
      rawAmount: value.amount.toFixed(2),
      frequency: "monthly",
    }));

  const isUsingSyncedCashflow = bankState.connected && (syncedRevenueItems.length > 0 || syncedCostItems.length > 0);
  const revenues = isUsingSyncedCashflow ? syncedRevenueItems : financeState.revenues;
  const costs = isUsingSyncedCashflow ? syncedCostItems : financeState.costs;
  const totalRevenue = revenues.reduce((sum, item) => sum + item.amount, 0);
  const totalCosts = costs.reduce((sum, item) => sum + item.amount, 0);

  return {
    revenues,
    costs,
    totalRevenue,
    totalCosts,
    monthlySurplus: totalRevenue - totalCosts,
    isUsingSyncedCashflow,
    categorizedBankTransactions,
    recurringBankEntries: getRecurringBankEntries(categorizedBankTransactions),
    detectedTransferCount,
  };
}

export function calculateProjection(
  monthlyRevenue: number,
  monthlyCosts: number,
  settings: InvestmentSettings,
): ProjectionPoint[] {
  const {
    annualReturn,
    years,
    initialAmount,
    dividendYield = 0,
    incomeGrowth = 0,
    expenseGrowth = 0,
  } = settings;

  const monthlyReturnRate = annualReturn / 100 / 12;
  const monthlyDividendRate = dividendYield / 100 / 12;
  const monthlyIncomeGrowthRate = incomeGrowth / 100 / 12;
  const monthlyExpenseGrowthRate = expenseGrowth / 100 / 12;
  const months = years * 12;
  const data: ProjectionPoint[] = [];

  let revenue = monthlyRevenue;
  let costs = monthlyCosts;
  let balance = initialAmount;
  let totalInvested = initialAmount;

  for (let month = 0; month <= months; month += 1) {
    if (month % 12 === 0) {
      data.push({
        year: month / 12,
        balance: Math.round(balance),
        totalInvested: Math.round(totalInvested),
      });
    }

    const monthlyContribution = revenue - costs;
    const monthlyDividends = balance * monthlyDividendRate;

    totalInvested += monthlyContribution;
    balance = balance * (1 + monthlyReturnRate) + monthlyDividends + monthlyContribution;

    revenue *= 1 + monthlyIncomeGrowthRate;
    costs *= 1 + monthlyExpenseGrowthRate;
  }

  return data;
}