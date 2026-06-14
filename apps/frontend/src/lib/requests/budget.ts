import { api } from './api';
import type { BudgetPlan, CreateBudgetPlanBody, UpdateBudgetPlanBody } from '@finance-app/shared-types';

export const httpGetBudgetPlans = (headers?: HeadersInit): Promise<BudgetPlan[] | null> =>
  api.get<BudgetPlan[]>('/v1/budget/plans', { headers }).catch(() => null);

export const httpPostBudgetPlan = (body: CreateBudgetPlanBody): Promise<BudgetPlan> =>
  api.post('/v1/budget/plans', body);

export const httpPutBudgetPlan = (id: string, body: UpdateBudgetPlanBody): Promise<BudgetPlan> =>
  api.put(`/v1/budget/plans/${id}`, body);

export const httpPutBudgetPlanFavorite = (id: string): Promise<void> =>
  api.put(`/v1/budget/plans/${id}/favorite`, {});

export const httpDeleteBudgetPlan = (id: string): Promise<void> =>
  api.delete(`/v1/budget/plans/${id}`);
