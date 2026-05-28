import { derived, writable } from 'svelte/store';
import { api } from '$lib/requests/api';
import { httpPutFinanceRevenues, httpPutFinanceCosts, httpPutFinanceSettings, httpPostFinanceEntry } from '$lib/requests/finance';
import { bankState, categorizedBankTransactions } from '$lib/stores/banking';

export interface FinanceItem {
  id: string;
  name: string;
  category: string;
  categoryId?: string;
  amount: number;       // normalized to monthly
  rawAmount: string;
  frequency: 'weekly' | 'biweekly' | 'monthly' | 'yearly';
}

export const incomeCategories = [
  'Salary',
  'Freelance',
  'Business',
  'Investments',
  'Rental',
  'Benefits',
  'Other',
] as const;

export const expenseCategories = [
  'Housing',
  'Food',
  'Transport',
  'Utilities',
  'Insurance',
  'Debt',
  'Health',
  'Entertainment',
  'Education',
  'Shopping',
  'Other',
] as const;

export interface InvestmentSettings {
  annualReturn: number;
  years: number;
  initialAmount: number;
  dividendYield: number;
  incomeGrowth: number;
  expenseGrowth: number;
}

export interface ProjectionPoint {
  year: number;
  balance: number;
  totalInvested: number;
}

const defaultInvestmentSettings: InvestmentSettings = {
  annualReturn: 7,
  years: 20,
  initialAmount: 0,
  dividendYield: 2,
  incomeGrowth: 2,
  expenseGrowth: 2,
};

export interface FinanceStatePayload {
  revenues: FinanceItem[];
  costs: FinanceItem[];
  investmentSettings: InvestmentSettings;
}

type BackendFinanceItem = {
  id?: string;
  name?: string;
  categoryId?: string;
  categoryName?: string;
  category?: string;
  amount?: number;
  rawAmount?: string;
  frequency?: FinanceItem['frequency'];
};

type BackendFinanceStatePayload = {
  revenues: BackendFinanceItem[];
  costs: BackendFinanceItem[];
  investmentSettings: InvestmentSettings;
};

type RemoteStore<T> = {
  subscribe: ReturnType<typeof writable<T>>['subscribe'];
  set: (value: T) => void;
  update: (updater: (value: T) => T) => void;
  mutateLocal: (updater: (value: T) => T) => void;
  hydrate: (value: T) => void;
  markReady: () => void;
};

function createRemoteStore<T>(persistFn: (value: T) => Promise<void>, initialValue: T): RemoteStore<T> {
  const store = writable<T>(initialValue);
  let ready = false;
  let suppressSync = false;

  async function persist(value: T) {
    if (!ready || suppressSync) return;

    try {
      await persistFn(value);
    } catch (error) {
      console.error('Failed to persist state', error);
    }
  }

  return {
    subscribe: store.subscribe,
    set(value) {
      store.set(value);
      void persist(value);
    },
    update(updater) {
      let nextValue = initialValue;
      store.update((current) => {
        nextValue = updater(current);
        return nextValue;
      });
      void persist(nextValue);
    },
    mutateLocal(updater) {
      suppressSync = true;
      store.update(updater);
      suppressSync = false;
    },
    hydrate(value) {
      suppressSync = true;
      store.set(value);
      suppressSync = false;
      ready = true;
    },
    markReady() {
      ready = true;
    },
  };
}

function normalizeFinanceItem(item: BackendFinanceItem): FinanceItem {
  const category = item.categoryName ?? item.category ?? 'Uncategorized';
  const parsedAmount = Number(item.amount);
  const normalizedFrequency =
    item.frequency === 'weekly' ||
      item.frequency === 'biweekly' ||
      item.frequency === 'monthly' ||
      item.frequency === 'yearly'
      ? item.frequency
      : 'monthly';

  return {
    id: item.id ?? crypto.randomUUID(),
    name: item.name?.trim() || 'Untitled',
    category: category.trim() || 'Uncategorized',
    categoryId: item.categoryId,
    rawAmount: String(item.rawAmount ?? '').trim(),
    amount: Number.isFinite(parsedAmount) ? parsedAmount : 0,
    frequency: normalizedFrequency,
  };
}

function normalizeInvestmentSettings(settings: InvestmentSettings): InvestmentSettings {
  return { ...defaultInvestmentSettings, ...settings };
}

function toBackendFinanceItem(item: FinanceItem) {
  return {
    id: item.id,
    name: item.name,
    categoryId: item.categoryId,
    categoryName: item.category,
    amount: item.amount,
    rawAmount: item.rawAmount,
    frequency: item.frequency,
  };
}

const revenuesStore = createRemoteStore<FinanceItem[]>(
  (items) => httpPutFinanceRevenues(items.map(toBackendFinanceItem)),
  [],
);
const costsStore = createRemoteStore<FinanceItem[]>(
  (items) => httpPutFinanceCosts(items.map(toBackendFinanceItem)),
  [],
);
const investmentSettingsStore = createRemoteStore<InvestmentSettings>(
  (settings) => httpPutFinanceSettings(settings),
  defaultInvestmentSettings,
);

export const revenues = revenuesStore;
export const costs = costsStore;
export const investmentSettings = investmentSettingsStore;

let financeStatePromise: Promise<void> | null = null;

export async function fetchFinanceState(): Promise<void> {
  if (financeStatePromise) return financeStatePromise;

  financeStatePromise = (async () => {
    try {
      const state = await api.get<BackendFinanceStatePayload>('/api/finance/state');
      revenuesStore.hydrate(state.revenues.map(normalizeFinanceItem));
      costsStore.hydrate(state.costs.map(normalizeFinanceItem));
      investmentSettingsStore.hydrate(normalizeInvestmentSettings(state.investmentSettings));
    } catch (error) {
      console.error('Failed to load finance state', error);
      revenuesStore.markReady();
      costsStore.markReady();
      investmentSettingsStore.markReady();
    }
  })();

  await financeStatePromise;
}

export function hydrateFinanceState(state: FinanceStatePayload | null | undefined): void {
  if (!state) {
    revenuesStore.markReady();
    costsStore.markReady();
    investmentSettingsStore.markReady();
    return;
  }

  revenuesStore.hydrate(state.revenues.map(normalizeFinanceItem));
  costsStore.hydrate(state.costs.map(normalizeFinanceItem));
  investmentSettingsStore.hydrate(normalizeInvestmentSettings(state.investmentSettings));
  financeStatePromise = Promise.resolve();
}

export const totalRevenue = derived(revenues, ($revenues) =>
  $revenues.reduce((sum, item) => sum + item.amount, 0)
);

export const totalCosts = derived(costs, ($costs) =>
  $costs.reduce((sum, item) => sum + item.amount, 0)
);

export const monthlySurplus = derived(
  [totalRevenue, totalCosts],
  ([$totalRevenue, $totalCosts]) => $totalRevenue - $totalCosts
);

const incomeCategorySet = new Set<string>(incomeCategories);
const expenseCategorySet = new Set<string>(expenseCategories);

function normalizeIncomeCategory(category: string): string {
  const value = category.trim();
  return incomeCategorySet.has(value) ? value : 'Other';
}

function normalizeExpenseCategory(category: string): string {
  const value = category.trim();
  return expenseCategorySet.has(value) ? value : 'Other';
}

function isRecentTransaction(dateValue: string): boolean {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return false;

  const ageInDays = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
  return ageInDays >= 0 && ageInDays <= 30;
}

export const syncedRevenueItems = derived([bankState, categorizedBankTransactions], ([$bankState, $categorizedBankTransactions]): FinanceItem[] => {
  if (!$bankState.connected) return [];

  const incomeByName = new Map<string, { amount: number; category: string }>();

  for (const transaction of $categorizedBankTransactions) {
    if (!isRecentTransaction(transaction.date)) continue;
    if (transaction.flow !== 'income') continue;

    const key = transaction.merchantName || transaction.name || 'Bank income';
    const current = incomeByName.get(key);
    const amount = (current?.amount ?? 0) + Math.abs(transaction.amount);
    const category = normalizeIncomeCategory(transaction.resolvedCategory);
    incomeByName.set(key, {
      amount,
      category: current?.category ?? category,
    });
  }

  return [...incomeByName.entries()]
    .sort((a, b) => b[1].amount - a[1].amount)
    .map(([name, value], index) => ({
      id: `bank-income-${index}-${name}`,
      name,
      category: value.category,
      amount: value.amount,
      rawAmount: value.amount.toFixed(2),
      frequency: 'monthly' as const,
    }));
});

export const syncedCostItems = derived([bankState, categorizedBankTransactions], ([$bankState, $categorizedBankTransactions]): FinanceItem[] => {
  if (!$bankState.connected) return [];

  const expenseByName = new Map<string, { amount: number; category: string }>();

  for (const transaction of $categorizedBankTransactions) {
    if (!isRecentTransaction(transaction.date)) continue;
    if (transaction.flow !== 'expense') continue;

    const key = transaction.merchantName || transaction.name || 'Bank expense';
    const current = expenseByName.get(key);
    const category = normalizeExpenseCategory(transaction.resolvedCategory);
    const amount = (current?.amount ?? 0) + Math.abs(transaction.amount);

    expenseByName.set(key, { amount, category: current?.category ?? category });
  }

  return [...expenseByName.entries()]
    .sort((a, b) => b[1].amount - a[1].amount)
    .map(([name, value], index) => ({
      id: `bank-expense-${index}-${name}`,
      name,
      category: value.category,
      amount: value.amount,
      rawAmount: value.amount.toFixed(2),
      frequency: 'monthly' as const,
    }));
});

export const isUsingSyncedCashflow = derived(
  [bankState, syncedRevenueItems, syncedCostItems],
  ([$bankState, $syncedRevenueItems, $syncedCostItems]) =>
    $bankState.connected && ($syncedRevenueItems.length > 0 || $syncedCostItems.length > 0)
);

export const effectiveRevenues = derived(
  [revenues, syncedRevenueItems, isUsingSyncedCashflow],
  ([$revenues, $syncedRevenueItems, $isUsingSyncedCashflow]) => ($isUsingSyncedCashflow ? $syncedRevenueItems : $revenues)
);

export const effectiveCosts = derived(
  [costs, syncedCostItems, isUsingSyncedCashflow],
  ([$costs, $syncedCostItems, $isUsingSyncedCashflow]) => ($isUsingSyncedCashflow ? $syncedCostItems : $costs)
);

export const effectiveTotalRevenue = derived(effectiveRevenues, ($items) =>
  $items.reduce((sum, item) => sum + item.amount, 0)
);

export const effectiveTotalCosts = derived(effectiveCosts, ($items) =>
  $items.reduce((sum, item) => sum + item.amount, 0)
);

export const effectiveMonthlySurplus = derived(
  [effectiveTotalRevenue, effectiveTotalCosts],
  ([$effectiveTotalRevenue, $effectiveTotalCosts]) => $effectiveTotalRevenue - $effectiveTotalCosts
);

export function toMonthly(amount: number, freq: FinanceItem['frequency']): number {
  if (freq === 'weekly') return (amount * 52) / 12;
  if (freq === 'biweekly') return (amount * 26) / 12;
  if (freq === 'yearly') return amount / 12;
  return amount;
}

export function addRevenue(item: Omit<FinanceItem, 'id'>): void {
  const normalizedRawAmount = String(item.rawAmount ?? '').trim();
  revenues.update((r) => [
    ...r,
    {
      ...item,
      rawAmount: normalizedRawAmount,
      category: item.category.trim() || 'Uncategorized',
      categoryId: item.categoryId,
      id: crypto.randomUUID(),
    },
  ]);
}

export function removeRevenue(id: string): void {
  revenues.update((r) => r.filter((item) => item.id !== id));
}

export function updateRevenue(
  id: string,
  updates: Pick<FinanceItem, 'name' | 'category' | 'rawAmount' | 'frequency'>
): void {
  revenues.update((items) =>
    items.map((item) => {
      if (item.id !== id) return item;

      const normalizedRawAmount = String(updates.rawAmount ?? '').trim();
      const parsedAmount = Number(normalizedRawAmount);
      const monthlyAmount = Number.isFinite(parsedAmount) ? toMonthly(parsedAmount, updates.frequency) : item.amount;

      return {
        ...item,
        name: updates.name.trim() || item.name,
        category: updates.category.trim() || 'Uncategorized',
        rawAmount: normalizedRawAmount || item.rawAmount,
        frequency: updates.frequency,
        amount: monthlyAmount,
      };
    })
  );
}

export async function addCost(item: Omit<FinanceItem, 'id'>): Promise<void> {
  const normalizedRawAmount = String(item.rawAmount ?? '').trim();

  const draftEntry: FinanceItem = {
    ...item,
    rawAmount: normalizedRawAmount,
    category: item.category.trim() || 'Uncategorized',
    id: crypto.randomUUID(),
  };

  const response = await httpPostFinanceEntry<{
    id?: string;
    name?: string;
    categoryId?: string;
    categoryName?: string;
    amount?: number;
    rawAmount?: string;
    frequency?: FinanceItem['frequency'];
    entry?: BackendFinanceItem;
    cost?: BackendFinanceItem;
    item?: BackendFinanceItem;
  }>({
    type: 'expense',
    name: draftEntry.name,
    categoryName: draftEntry.category,
    categoryId: draftEntry.categoryId,
    amount: draftEntry.amount,
    rawAmount: draftEntry.rawAmount,
    frequency: draftEntry.frequency,
  });

  const createdEntry = normalizeFinanceItem(
    response.entry ?? response.cost ?? response.item ?? response ?? draftEntry
  );
  costsStore.mutateLocal((current) => [...current, createdEntry]);
}

export function removeCost(id: string): void {
  costs.update((c) => c.filter((item) => item.id !== id));
}

export function updateCost(
  id: string,
  updates: Pick<FinanceItem, 'name' | 'category' | 'rawAmount' | 'frequency'>
): void {
  costs.update((items) =>
    items.map((item) => {
      if (item.id !== id) return item;

      const normalizedRawAmount = String(updates.rawAmount ?? '').trim();
      const parsedAmount = Number(normalizedRawAmount);
      const monthlyAmount = Number.isFinite(parsedAmount) ? toMonthly(parsedAmount, updates.frequency) : item.amount;

      return {
        ...item,
        name: updates.name.trim() || item.name,
        category: updates.category.trim() || 'Uncategorized',
        rawAmount: normalizedRawAmount || item.rawAmount,
        frequency: updates.frequency,
        amount: monthlyAmount,
      };
    })
  );
}

export function calculateProjection(
  monthlyRevenue: number,
  monthlyCosts: number,
  settings: InvestmentSettings
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

  for (let m = 0; m <= months; m++) {
    if (m % 12 === 0) {
      data.push({
        year: m / 12,
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
