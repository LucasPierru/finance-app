import { Router, type Request } from "express";
import { getAuthenticatedUser } from "@middleware/auth";
import { createBudget, deleteBudget, getBudgets, updateBudget } from "@repositories/budget";
import { createBudgetPlan, deleteBudgetPlan, getBudgetPlans, setFavoriteBudgetPlan, updateBudgetPlan } from "@repositories/budget-plan";
import type { Budget, BudgetPlan, CreateBudgetBody, CreateBudgetPlanBody, UpdateBudgetBody, UpdateBudgetPlanBody } from "@lib/types";
import { AppError } from "@lib/errors";

export const budgetRouter = Router();

budgetRouter.get("/", async (req, res, next) => {
  try {
    const { userId } = getAuthenticatedUser(req);
    const budgets = await getBudgets(userId);
    res.json(budgets);
  } catch (error) {
    next(error);
  }
});

budgetRouter.post("/", async (req: Request<Record<string, string>, object, CreateBudgetBody>, res, next) => {
  try {
    const { userId } = getAuthenticatedUser(req);
    const { name, amount, period, categoryId } = req.body;

    if (!name || typeof name !== "string" || !name.trim()) {
      throw new AppError(400, "Budget name is required");
    }

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      throw new AppError(400, "Amount must be a positive number");
    }

    if (period !== "weekly" && period !== "monthly" && period !== "yearly") {
      throw new AppError(400, "Period must be weekly, monthly, or yearly");
    }

    const budget = await createBudget(
      userId,
      name.trim(),
      parsedAmount,
      period,
      categoryId ?? null,
    );

    res.status(201).json(budget);
  } catch (error) {
    next(error);
  }
});

budgetRouter.put("/:id", async (req: Request<{ id: string }, object, UpdateBudgetBody>, res, next) => {
  try {
    const { userId } = getAuthenticatedUser(req);
    const { id } = req.params;
    const { name, amount, period, categoryId } = req.body;

    const fields: Parameters<typeof updateBudget>[2] = {};

    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) {
        throw new AppError(400, "Budget name must be a non-empty string");
      }
      fields.name = name.trim();
    }

    if (amount !== undefined) {
      const parsedAmount = Number(amount);
      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        throw new AppError(400, "Amount must be a positive number");
      }
      fields.amount = parsedAmount;
    }

    if (period !== undefined) {
      if (period !== "weekly" && period !== "monthly" && period !== "yearly") {
        throw new AppError(400, "Period must be weekly, monthly, or yearly");
      }
      fields.period = period;
    }

    if (Object.prototype.hasOwnProperty.call(req.body, "categoryId")) {
      fields.categoryId = categoryId ?? null;
    }

    const budget = await updateBudget(userId, id, fields);
    res.json(budget);
  } catch (error) {
    next(error);
  }
});

budgetRouter.delete("/:id", async (req: Request<{ id: string }>, res, next) => {
  try {
    const { userId } = getAuthenticatedUser(req);
    await deleteBudget(userId, req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// ── Budget Plans ──────────────────────────────────────────────────────────────

budgetRouter.get("/plans", async (req, res, next) => {
  try {
    const { userId } = getAuthenticatedUser(req);
    const plans = await getBudgetPlans(userId);
    res.json(plans);
  } catch (error) {
    next(error);
  }
});

budgetRouter.post(
  "/plans",
  async (req: Request<Record<string, string>, object, CreateBudgetPlanBody>, res, next) => {
    try {
      const { userId } = getAuthenticatedUser(req);
      const { name, items } = req.body;

      if (!name || typeof name !== "string" || !name.trim()) {
        throw new AppError(400, "Budget plan name is required");
      }

      if (!Array.isArray(items) || items.length === 0) {
        throw new AppError(400, "At least one item is required");
      }

      const validatedItems = items.map((item, i) => {
        const amount = Number(item.amount);
        if (!Number.isFinite(amount) || amount <= 0) {
          throw new AppError(400, `Item ${i + 1}: amount must be a positive number`);
        }
        const period = item.period;
        if (period !== "weekly" && period !== "biweekly" && period !== "monthly" && period !== "yearly") {
          throw new AppError(400, `Item ${i + 1}: period must be weekly, biweekly, monthly, or yearly`);
        }
        const flow: "income" | "expense" = item.flow === "income" ? "income" : "expense";
        return {
          categoryId: item.categoryId ?? null,
          subCategoryId: item.subCategoryId ?? null,
          amount,
          period,
          flow,
        };
      });

      const plan = await createBudgetPlan(userId, name.trim(), validatedItems);
      res.status(201).json(plan);
    } catch (error) {
      next(error);
    }
  },
);

budgetRouter.put(
  "/plans/:id",
  async (req: Request<{ id: string }, object, UpdateBudgetPlanBody>, res, next) => {
    try {
      const { userId } = getAuthenticatedUser(req);
      const { id } = req.params;
      const { name, items } = req.body;

      if (!name || typeof name !== "string" || !name.trim()) {
        throw new AppError(400, "Budget plan name is required");
      }

      if (!Array.isArray(items) || items.length === 0) {
        throw new AppError(400, "At least one item is required");
      }

      const validatedItems = items.map((item, i) => {
        const amount = Number(item.amount);
        if (!Number.isFinite(amount) || amount <= 0) {
          throw new AppError(400, `Item ${i + 1}: amount must be a positive number`);
        }
        const period = item.period;
        if (period !== "weekly" && period !== "biweekly" && period !== "monthly" && period !== "yearly") {
          throw new AppError(400, `Item ${i + 1}: period must be weekly, biweekly, monthly, or yearly`);
        }
        const flow: "income" | "expense" = item.flow === "income" ? "income" : "expense";
        return { categoryId: item.categoryId ?? null, subCategoryId: item.subCategoryId ?? null, amount, period, flow };
      });

      const plan = await updateBudgetPlan(userId, id, name.trim(), validatedItems);
      res.json(plan);
    } catch (error) {
      next(error);
    }
  },
);

budgetRouter.put("/plans/:id/favorite", async (req: Request<{ id: string }>, res, next) => {
  try {
    const { userId } = getAuthenticatedUser(req);
    await setFavoriteBudgetPlan(userId, req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

budgetRouter.delete("/plans/:id", async (req: Request<{ id: string }>, res, next) => {
  try {
    const { userId } = getAuthenticatedUser(req);
    await deleteBudgetPlan(userId, req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});
