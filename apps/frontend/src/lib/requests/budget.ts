import { api } from './api';
import type { BudgetPlan, CreateBudgetPlanBody, UpdateBudgetPlanBody } from '@finance-app/shared-types';

export const httpGetBudgetPlans = (headers?: HeadersInit): Promise<BudgetPlan[] | null> =>
  api.get<BudgetPlan[]>('/api/budget/plans', { headers }).catch(() => null);

export const httpPostBudgetPlan = (body: CreateBudgetPlanBody): Promise<BudgetPlan> =>
  api.post('/api/budget/plans', body);

export const httpPutBudgetPlan = (id: string, body: UpdateBudgetPlanBody): Promise<BudgetPlan> =>
  api.put(`/api/budget/plans/${id}`, body);

export const httpDeleteBudgetPlan = (id: string): Promise<void> =>
  api.delete(`/api/budget/plans/${id}`);
