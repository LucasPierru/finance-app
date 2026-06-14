import { Router, type Request } from "express";
import { getAuthenticatedUser } from "@middleware/auth";
import { AppError } from "@lib/errors";
import type { CreateManualTransactionBody, TransactionFilters, UpdateTransactionBody } from "@finance-app/shared-types";
import {
  bulkUpdateTransactionsByMerchant,
  createManualTransaction,
  deleteTransaction,
  getPagedTransactions,
  getTransactionSummary,
  updateTransactionOverride,
} from "@repositories/plaid";

const transactionsRouter = Router();

function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function isPastMonth(month: string | undefined): boolean {
  return typeof month === "string" && /^\d{4}-\d{2}$/.test(month) && month < currentMonthKey();
}

transactionsRouter.get(
  "/summary",
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

transactionsRouter.get(
  "/",
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

transactionsRouter.post(
  "/",
  async (req: Request<Record<string, string>, object, CreateManualTransactionBody>, res, next) => {
    try {
      const { userId } = getAuthenticatedUser(req);
      const { name, date, amount, flow, categoryId, subCategoryId } = req.body ?? {};

      const trimmedName = String(name ?? "").trim();
      if (!trimmedName) throw new AppError(400, "name is required");

      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
        throw new AppError(400, "date must be YYYY-MM-DD");
      }

      const parsedAmount = parseFloat(String(amount ?? ""));
      if (Number.isNaN(parsedAmount) || parsedAmount < 0) {
        throw new AppError(400, "amount must be a non-negative number");
      }

      if (flow !== "income" && flow !== "expense") {
        throw new AppError(400, "flow must be 'income' or 'expense'");
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

transactionsRouter.patch(
  "/:id",
  async (req: Request<{ id: string }, object, UpdateTransactionBody>, res, next) => {
    try {
      const { userId } = getAuthenticatedUser(req);
      const { id } = req.params;
      const { categoryId, subCategoryId, flow, applyToSimilar, isInternal } = req.body;

      if (flow !== undefined && flow !== "income" && flow !== "expense") {
        throw new AppError(400, "flow must be 'income' or 'expense'");
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

transactionsRouter.delete("/:id", async (req: Request<{ id: string }>, res, next) => {
  try {
    const { userId } = getAuthenticatedUser(req);
    const { id } = req.params;
    await deleteTransaction(userId, id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export { transactionsRouter };
