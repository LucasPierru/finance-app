import { Router, type Request } from "express";
import { Products } from "plaid";
import { assertPlaidConfigured, normalizePlaidCountryCode, plaidClient } from "@lib/plaid";
import { getAuthenticatedUser } from "@middleware/auth";
import type { BankAccount, BankTransaction, StoredBankState } from "@lib/types";
import type { CreateLinkTokenBody, CreateManualTransactionBody, ExchangePublicTokenBody, TransactionFilters, UpdateTransactionBody } from "@finance-app/shared-types";
import {
  clearStoredBankState,
  createManualTransaction,
  deleteTransaction,
  getBankConnectionState,
  getPagedTransactions,
  getTransactionSummary,
  getStoredBankStates,
  updateTransactionOverride,
  bulkUpdateTransactionsByMerchant,
  upsertStoredBankState,
} from "@repositories/plaid";

const plaidRouter = Router();

function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function isPastMonth(month: string | undefined): boolean {
  return typeof month === "string" && /^\d{4}-\d{2}$/.test(month) && month < currentMonthKey();
}

function mapAccount(account: any): BankAccount {
  return {
    accountId: account.account_id,
    name: account.name,
    officialName: account.official_name,
    mask: account.mask,
    type: account.type,
    subtype: account.subtype,
    currentBalance: account.balances.current,
    availableBalance: account.balances.available,
    isoCurrencyCode: account.balances.iso_currency_code,
  };
}

function mapTransaction(transaction: any): BankTransaction {
  // Plaid sign convention: negative = credit/income, positive = debit/expense
  const plaidAmount: number = transaction.amount;
  return {
    transactionId: transaction.transaction_id,
    accountId: transaction.account_id,
    date: transaction.date,
    name: transaction.name,
    merchantName: transaction.merchant_name,
    amount: Math.abs(plaidAmount),
    isoCurrencyCode: transaction.iso_currency_code,
    category: transaction.category ?? [],
    pending: transaction.pending,
    flow: plaidAmount < 0 ? 'income' : 'expense',
    personalFinanceCategory: transaction.personal_finance_category?.primary ?? null,
    personalFinanceCategoryDetailed: transaction.personal_finance_category?.detailed ?? null,
    categoryId: null,
    categoryName: null,
    subCategoryId: null,
    subCategoryName: null,
    isInternal: false,
  };
}

function upsertTransactions(existing: BankTransaction[], updates: BankTransaction[]): BankTransaction[] {
  const byId = new Map(existing.map((transaction) => [transaction.transactionId, transaction]));

  for (const transaction of updates) {
    byId.set(transaction.transactionId, transaction);
  }

  return [...byId.values()].sort((a, b) => b.date.localeCompare(a.date));
}

function removeTransactions(existing: BankTransaction[], removedIds: string[]): BankTransaction[] {
  const removedSet = new Set(removedIds);
  return existing.filter((transaction) => !removedSet.has(transaction.transactionId));
}

async function fetchTransactions(accessToken: string): Promise<{ cursor: string | null; transactions: BankTransaction[] }> {
  let cursor: string | null = null;
  let hasMore = true;
  let transactions: BankTransaction[] = [];

  while (hasMore) {
    const syncResponse = await plaidClient.transactionsSync({
      access_token: accessToken,
      cursor: cursor ?? undefined,
      count: 100,
      options: { include_personal_finance_category: true },
    });

    transactions = transactions.concat(syncResponse.data.added.map(mapTransaction));
    cursor = syncResponse.data.next_cursor;
    hasMore = syncResponse.data.has_more;
  }

  return { cursor, transactions };
}

async function syncTransactionsForState(
  state: StoredBankState,
): Promise<{ nextState: StoredBankState; removedTransactionIds: string[] }> {
  let cursor = state.cursor;
  let hasMore = true;
  let nextTransactions = state.transactions;
  const removedTransactionIds: string[] = [];

  while (hasMore) {
    const response = await plaidClient.transactionsSync({
      access_token: state.accessToken,
      cursor: cursor ?? undefined,
      count: 100,
      options: { include_personal_finance_category: true },
    });

    const added = response.data.added.map(mapTransaction);
    const modified = response.data.modified.map(mapTransaction);
    const removed = response.data.removed.map((entry) => entry.transaction_id);
    removedTransactionIds.push(...removed);

    nextTransactions = upsertTransactions(nextTransactions, [...added, ...modified]);
    nextTransactions = removeTransactions(nextTransactions, removed);

    cursor = response.data.next_cursor;
    hasMore = response.data.has_more;
  }

  const accountsResponse = await plaidClient.accountsBalanceGet({
    access_token: state.accessToken,
  });

  return {
    removedTransactionIds,
    nextState: {
      ...state,
      cursor,
      accounts: accountsResponse.data.accounts.map(mapAccount),
      transactions: nextTransactions,
      lastSyncAt: new Date().toISOString(),
    },
  };
}

plaidRouter.get("/state", async (req, res, next) => {
  try {
    const payload = await getBankConnectionState(getAuthenticatedUser(req).userId);
    res.json(payload);
  } catch (error) {
    next(error);
  }
});

plaidRouter.get(
  "/transactions/summary",
  async (
    req: Request<Record<string, string>, object, object, Record<string, string>>,
    res,
    next,
  ) => {
    try {
      const userId = getAuthenticatedUser(req).userId;
      const { month, previousMonth, flow, search, minAmount, maxAmount, categoryId, subCategoryId } = req.query;

      const filters: TransactionFilters = {};
      if (month && /^\d{4}-\d{2}$/.test(month)) filters.month = month;
      if (flow === "income" || flow === "expense") filters.flow = flow;
      if (search) filters.search = search.trim().slice(0, 200);
      if (minAmount) {
        const n = parseFloat(minAmount);
        if (!Number.isNaN(n) && n >= 0) filters.minAmount = n;
      }
      if (maxAmount) {
        const n = parseFloat(maxAmount);
        if (!Number.isNaN(n) && n >= 0) filters.maxAmount = n;
      }
      if (categoryId) filters.categoryId = categoryId;
      if (subCategoryId) filters.subCategoryId = subCategoryId;

      if (previousMonth && /^\d{4}-\d{2}$/.test(previousMonth)) {
        const [current, previous] = await Promise.all([
          getTransactionSummary(userId, filters),
          getTransactionSummary(userId, { ...filters, month: previousMonth }),
        ]);
        res.json({ current, previous });
      } else {
        if (isPastMonth(month)) res.set("Cache-Control", "private, max-age=3600");
        const result = await getTransactionSummary(userId, filters);
        res.json(result);
      }
    } catch (error) {
      next(error);
    }
  },
);

plaidRouter.get(
  "/transactions",
  async (
    req: Request<Record<string, string>, object, object, Record<string, string>>,
    res,
    next,
  ) => {
    try {
      const userId = getAuthenticatedUser(req).userId;
      const { month, flow, search, minAmount, maxAmount, categoryId, subCategoryId, page: pageStr, pageSize: pageSizeStr, sortBy: sortByRaw, sortDir: sortDirRaw } = req.query;

      const page = Math.max(1, parseInt(pageStr ?? "1", 10) || 1);
      const pageSize = Math.min(100, Math.max(1, parseInt(pageSizeStr ?? "20", 10) || 20));

      const filters: TransactionFilters = {};
      if (month && /^\d{4}-\d{2}$/.test(month)) filters.month = month;
      if (flow === "income" || flow === "expense") filters.flow = flow;
      if (search) filters.search = search.trim().slice(0, 200);
      if (minAmount) {
        const n = parseFloat(minAmount);
        if (!Number.isNaN(n) && n >= 0) filters.minAmount = n;
      }
      if (maxAmount) {
        const n = parseFloat(maxAmount);
        if (!Number.isNaN(n) && n >= 0) filters.maxAmount = n;
      }
      if (categoryId) filters.categoryId = categoryId;
      if (subCategoryId) filters.subCategoryId = subCategoryId;
      if (sortByRaw === "date" || sortByRaw === "name" || sortByRaw === "amount") filters.sortBy = sortByRaw;
      if (sortDirRaw === "asc" || sortDirRaw === "desc") filters.sortDir = sortDirRaw;

      if (isPastMonth(month)) res.set("Cache-Control", "private, max-age=3600");
      const result = await getPagedTransactions(userId, filters, page, pageSize);
      res.json(result);
    } catch (error) {
      next(error);
    }
  },
);

plaidRouter.post(
  "/transactions",
  async (req: Request<Record<string, string>, object, CreateManualTransactionBody>, res, next) => {
    try {
      const { userId } = getAuthenticatedUser(req);
      const { name, date, amount, flow, categoryId, subCategoryId } = req.body ?? {};

      const trimmedName = String(name ?? "").trim();
      if (!trimmedName) { res.status(400).json({ message: "name is required" }); return; }

      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
        res.status(400).json({ message: "date must be YYYY-MM-DD" }); return;
      }

      const parsedAmount = parseFloat(String(amount ?? ""));
      if (Number.isNaN(parsedAmount) || parsedAmount < 0) {
        res.status(400).json({ message: "amount must be a non-negative number" }); return;
      }

      if (flow !== "income" && flow !== "expense") {
        res.status(400).json({ message: "flow must be 'income' or 'expense'" }); return;
      }

      const tx = await createManualTransaction(userId, {
        name: trimmedName,
        date: String(date),
        amount: parsedAmount,
        flow,
        categoryId: categoryId ?? null,
        subCategoryId: subCategoryId ?? null,
      });
      res.status(201).json(tx);
    } catch (error) {
      next(error);
    }
  },
);

plaidRouter.patch(
  "/transactions/:id",
  async (req: Request<{ id: string }, object, UpdateTransactionBody>, res, next) => {
    try {
      const { userId } = getAuthenticatedUser(req);
      const { id } = req.params;
      const { categoryId, subCategoryId, flow, applyToSimilar, isInternal } = req.body;

      if (flow !== undefined && flow !== "income" && flow !== "expense") {
        res.status(400).json({ message: "flow must be 'income' or 'expense'" });
        return;
      }

      if (applyToSimilar) {
        await bulkUpdateTransactionsByMerchant(userId, id, categoryId, flow, isInternal, subCategoryId);
      }

      const updated = await updateTransactionOverride(userId, id, categoryId, flow, isInternal, subCategoryId);
      res.json(updated);
    } catch (error) {
      next(error);
    }
  },
);

plaidRouter.delete("/transactions/:id", async (req: Request<{ id: string }>, res, next) => {
  try {
    const { userId } = getAuthenticatedUser(req);
    const { id } = req.params;
    await deleteTransaction(userId, id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

plaidRouter.post("/link-token", async (req: Request<Record<string, string>, object, CreateLinkTokenBody>, res, next) => {
  try {
    assertPlaidConfigured();
    const { countryCode: bodyCountryCode } = req.body ?? {};
    const countryCode = normalizePlaidCountryCode(bodyCountryCode);
    const response = await plaidClient.linkTokenCreate({
      user: {
        client_user_id: getAuthenticatedUser(req).userId,
      },
      client_name: "WealthFlow",
      language: "en",
      country_codes: [countryCode],
      products: [Products.Transactions],
    });

    res.json({ linkToken: response.data.link_token });
  } catch (error) {
    next(error);
  }
});

plaidRouter.post("/exchange-public-token", async (req: Request<Record<string, string>, object, ExchangePublicTokenBody>, res, next) => {
  try {
    assertPlaidConfigured();
    const { publicToken: bodyPublicToken, institutionName: bodyInstitutionName } = req.body ?? {};

    const publicToken = String(bodyPublicToken ?? "").trim();
    const institutionName = bodyInstitutionName ? String(bodyInstitutionName) : null;

    if (!publicToken) {
      res.status(400).json({ message: "publicToken is required" });
      return;
    }

    const exchangeResponse = await plaidClient.itemPublicTokenExchange({
      public_token: publicToken,
    });

    const [{ cursor, transactions }, accountsResponse] = await Promise.all([
      fetchTransactions(exchangeResponse.data.access_token),
      plaidClient.accountsBalanceGet({ access_token: exchangeResponse.data.access_token }),
    ]);

    let state: StoredBankState = {
      accessToken: exchangeResponse.data.access_token,
      itemId: exchangeResponse.data.item_id,
      institutionName,
      cursor,
      lastSyncAt: new Date().toISOString(),
      accounts: accountsResponse.data.accounts.map(mapAccount),
      transactions,
    };

    // Plaid delivers only recent transactions in the initial transactionsSync call.
    // Historical data arrives in the very next cursor-based call, so we do one
    // additional sync pass immediately to capture it.
    const { nextState, removedTransactionIds } = await syncTransactionsForState(state);
    state = nextState;

    await upsertStoredBankState(getAuthenticatedUser(req).userId, state, {
      removedTransactionIds,
      pruneMissingAccounts: true,
      pruneMissingTransactions: true,
    });

    const connectionState = await getBankConnectionState(getAuthenticatedUser(req).userId);
    res.json(connectionState);
  } catch (error) {
    next(error);
  }
});

plaidRouter.post("/sync", async (req, res, next) => {
  try {
    assertPlaidConfigured();
    const { userId } = getAuthenticatedUser(req);
    const states = await getStoredBankStates(userId);

    if (states.length === 0) {
      res.status(400).json({ message: "No bank account connected" });
      return;
    }

    for (const state of states) {
      try {
        const { nextState, removedTransactionIds } = await syncTransactionsForState(state);
        await upsertStoredBankState(userId, nextState, {
          removedTransactionIds,
          pruneMissingAccounts: true,
        });
      } catch (err: any) {
        const plaidError = err?.response?.data;
        if (plaidError?.error_type) {
          console.error(`Plaid sync skipped for item ${state.itemId}: [${plaidError.error_type}/${plaidError.error_code}] ${plaidError.error_message}`);
          continue;
        }
        throw err;
      }
    }

    const connectionState = await getBankConnectionState(userId);
    res.json(connectionState);
  } catch (error) {
    next(error);
  }
});

plaidRouter.delete("/connection", async (req: Request<Record<string, string>, object, object, Record<string, string>>, res, next) => {
  try {
    const { userId } = getAuthenticatedUser(req);
    const itemId = req.query.itemId?.trim() || undefined;
    await clearStoredBankState(userId, itemId);
    res.json({ connected: false });
  } catch (error) {
    next(error);
  }
});

export { plaidRouter };