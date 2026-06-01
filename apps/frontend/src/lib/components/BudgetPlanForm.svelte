<svelte:options runes={true} />

<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Select, SelectContent, SelectItem, SelectTrigger } from "$lib/components/ui/select";
  import { httpPostBudgetPlan, httpPutBudgetPlan } from "$lib/requests/budget";
  import { untrack } from "svelte";
  import { Plus, Trash2 } from "lucide-svelte";
  import type { BudgetPlan, FinanceCategory } from "@finance-app/shared-types";
  import CategorySelect from "$lib/components/CategorySelect.svelte";
  import { toMonthly } from "$lib/utils/budget";

  type Period = "weekly" | "biweekly" | "monthly" | "yearly";
  type Flow = "income" | "expense";

  interface ItemDraft {
    key: number;
    flow: Flow;
    /** Raw category or subcategory ID shown in the <select>. Resolved on submit. */
    selectValue: string;
    amount: string;
    period: Period;
  }

  let {
    categories,
    editPlan = undefined,
    hideActions = false,
    submitFn = $bindable<(() => Promise<void>) | undefined>(undefined),
    isSubmitting = $bindable(false),
    oncreated,
    onupdated,
    oncancel,
  }: {
    categories: FinanceCategory[];
    editPlan?: BudgetPlan;
    hideActions?: boolean;
    submitFn?: (() => Promise<void>) | undefined;
    isSubmitting?: boolean;
    oncreated?: (plan: BudgetPlan) => void;
    onupdated?: (plan: BudgetPlan) => void;
    oncancel?: () => void;
  } = $props();

  const incomeCategories = $derived(categories.filter((c) => c.type === "income"));
  const expenseCategories = $derived(categories.filter((c) => c.type === "expense"));

  const isEditing = $derived(editPlan !== undefined);

  /** Encode an existing item's IDs into the flat select value. */
  function toSelectValue(categoryId: string | null, subCategoryId: string | null): string {
    return subCategoryId ?? categoryId ?? "";
  }

  /**
   * Given the raw select value, resolve the parent categoryId and optional subCategoryId
   * by searching through the appropriate category list.
   */
  function resolveIds(
    selectValue: string,
    flow: Flow,
  ): { categoryId: string | null; subCategoryId: string | null } {
    if (!selectValue) return { categoryId: null, subCategoryId: null };
    const cats = flow === "income" ? incomeCategories : expenseCategories;
    for (const cat of cats) {
      if (cat.subCategories.some((s) => s.id === selectValue)) {
        return { categoryId: cat.id, subCategoryId: selectValue };
      }
    }
    return { categoryId: selectValue, subCategoryId: null };
  }

  let planName = $state(untrack(() => editPlan?.name ?? ""));
  let nextKey = $state(untrack(() => (editPlan ? editPlan.items.length : 1)));
  let items = $state<ItemDraft[]>(
    untrack(() =>
      editPlan && editPlan.items.length > 0
        ? editPlan.items.map((item, i) => ({
            key: i,
            flow: item.flow ?? "expense",
            selectValue: toSelectValue(item.categoryId, item.subCategoryId),
            amount: String(item.amount),
            period: item.period as Period,
          }))
        : [{ key: 0, flow: "expense" as Flow, selectValue: "", amount: "", period: "monthly" as Period }],
    ),
  );
  let error = $state<string | null>(null);
  let submitting = $state(false);

  $effect(() => {
    submitFn = handleSubmit;
    isSubmitting = submitting;
  });

  const incomeItems = $derived(items.filter((i) => i.flow === "income"));
  const expenseItems = $derived(items.filter((i) => i.flow === "expense"));

  const budgetMonthlyIncome = $derived(
    incomeItems.reduce((sum, i) => {
      const amt = Number(i.amount);
      return sum + (Number.isFinite(amt) && amt > 0 ? toMonthly(amt, i.period) : 0);
    }, 0),
  );
  const budgetMonthlyExpenses = $derived(
    expenseItems.reduce((sum, i) => {
      const amt = Number(i.amount);
      return sum + (Number.isFinite(amt) && amt > 0 ? toMonthly(amt, i.period) : 0);
    }, 0),
  );
  const budgetNet = $derived(budgetMonthlyIncome - budgetMonthlyExpenses);

  function addItem(flow: Flow) {
    items = [...items, { key: nextKey, flow, selectValue: "", amount: "", period: "monthly" }];
    nextKey += 1;
  }

  function removeItem(key: number) {
    if (items.length <= 1) return;
    items = items.filter((item) => item.key !== key);
  }

  async function handleSubmit() {
    error = null;
    if (!planName.trim()) {
      error = "Budget name is required.";
      return;
    }

    const validItems = items.filter((item) => {
      const amt = Number(item.amount);
      return Number.isFinite(amt) && amt > 0;
    });

    if (validItems.length === 0) {
      error = "Add at least one item with a valid amount.";
      return;
    }

    const planBody = {
      name: planName.trim(),
      items: validItems.map((item) => {
        const { categoryId, subCategoryId } = resolveIds(item.selectValue, item.flow);
        return {
          categoryId,
          subCategoryId,
          amount: Number(item.amount),
          period: item.period,
          flow: item.flow,
        };
      }),
    };

    submitting = true;
    try {
      if (isEditing && editPlan) {
        const plan = await httpPutBudgetPlan(editPlan.id, planBody);
        onupdated?.(plan);
      } else {
        const plan = await httpPostBudgetPlan(planBody);
        oncreated?.(plan);
      }
    } catch (e: unknown) {
      error = e instanceof Error ? e.message : isEditing ? "Failed to update budget." : "Failed to create budget.";
    } finally {
      submitting = false;
    }
  }
</script>

<div class="space-y-5">
  <!-- Budget name -->
  <div class="space-y-1.5">
    <label for="plan-name" class="text-sm font-medium text-slate-300">Budget name</label>
    <Input id="plan-name" bind:value={planName} placeholder="e.g. Monthly Budget" />
  </div>

  <!-- Income items -->
  <div class="space-y-2">
    <div class="flex items-center gap-2">
      <span class="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
      <p class="text-sm font-medium text-slate-300">Income</p>
    </div>

    {#each incomeItems as item (item.key)}
      <div class="rounded-lg border border-[#252a3a] p-2.5 space-y-2 md:border-0 md:p-0 md:space-y-0 md:flex md:items-center md:gap-2">
        <CategorySelect
          categories={incomeCategories}
          bind:value={item.selectValue}
          placeholder="No category"
          class="w-full md:flex-[2] md:min-w-0"
        />
        <div class="flex items-center gap-2">
          <Input bind:value={item.amount} type="number" min="0" placeholder="Amount" class="flex-1 min-w-0 md:min-w-[80px] md:flex-1" />
          <div class="w-28 shrink-0 md:w-20 md:shrink-0">
            <Select type="single" bind:value={item.period}>
              <SelectTrigger class="w-full h-full">
                {{ monthly: "/ mo", biweekly: "/ 2wk", weekly: "/ wk", yearly: "/ yr" }[item.period]}
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly" label="/ mo" />
                <SelectItem value="biweekly" label="/ 2wk" />
                <SelectItem value="weekly" label="/ wk" />
                <SelectItem value="yearly" label="/ yr" />
              </SelectContent>
            </Select>
          </div>
          <Button
            onclick={() => removeItem(item.key)}
            variant="ghost"
            size="icon-sm"
            class="shrink-0 text-rose-500 hover:text-rose-300 hover:bg-rose-950/40"
            aria-label="Remove item"
          >
            <Trash2 class="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    {/each}

    <Button
      onclick={() => addItem("income")}
      variant="ghost"
      size="sm"
      class="text-emerald-500 hover:text-emerald-300 hover:bg-emerald-950/30 px-2"
    >
      <Plus class="h-4 w-4" />
      Add income
    </Button>
  </div>

  <!-- Divider -->
  <div class="border-t border-[#252a3a]"></div>

  <!-- Expense items -->
  <div class="space-y-2">
    <div class="flex items-center gap-2">
      <span class="h-1.5 w-1.5 rounded-full bg-rose-400"></span>
      <p class="text-sm font-medium text-slate-300">Expenses</p>
    </div>

    {#each expenseItems as item (item.key)}
      <div class="rounded-lg border border-[#252a3a] p-2.5 space-y-2 md:border-0 md:p-0 md:space-y-0 md:flex md:items-center md:gap-2">
        <CategorySelect
          categories={expenseCategories}
          bind:value={item.selectValue}
          placeholder="No category"
          class="w-full md:flex-[2] md:min-w-0"
        />
        <div class="flex items-center gap-2">
          <Input bind:value={item.amount} type="number" min="0" placeholder="Amount" class="flex-1 min-w-0 md:min-w-[80px] md:flex-1" />
          <div class="w-28 shrink-0 md:w-20 md:shrink-0">
            <Select type="single" bind:value={item.period}>
              <SelectTrigger class="w-full h-full">
                {{ monthly: "/ mo", biweekly: "/ 2wk", weekly: "/ wk", yearly: "/ yr" }[item.period]}
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly" label="/ mo" />
                <SelectItem value="biweekly" label="/ 2wk" />
                <SelectItem value="weekly" label="/ wk" />
                <SelectItem value="yearly" label="/ yr" />
              </SelectContent>
            </Select>
          </div>
          <Button
            onclick={() => removeItem(item.key)}
            variant="ghost"
            size="icon-sm"
            class="shrink-0 text-rose-500 hover:text-rose-300 hover:bg-rose-950/40"
            aria-label="Remove item"
          >
            <Trash2 class="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    {/each}

    <Button
      onclick={() => addItem("expense")}
      variant="ghost"
      size="sm"
      class="text-slate-400 hover:text-slate-200 px-2"
    >
      <Plus class="h-4 w-4" />
      Add expense
    </Button>
  </div>

  <!-- Net summary -->
  {#if budgetMonthlyIncome > 0 || budgetMonthlyExpenses > 0}
    <div class="flex items-center justify-between rounded-lg border border-[#252a3a] bg-[#0d0f14] px-4 py-2.5 text-sm">
      <span class="text-slate-500">Monthly net</span>
      <span class="font-semibold {budgetNet >= 0 ? 'text-emerald-400' : 'text-rose-400'}">
        {budgetNet >= 0 ? "+" : ""}{budgetNet.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })} / mo
      </span>
    </div>
  {/if}

  {#if error}
    <p class="text-sm text-rose-400">{error}</p>
  {/if}

  {#if !hideActions}
    <div class="flex gap-3 pt-1">
      <Button onclick={handleSubmit} disabled={submitting} class="h-10 flex-1">
        {#if submitting}
          {isEditing ? "Saving…" : "Creating…"}
        {:else}
          {isEditing ? "Save changes" : "Create budget"}
        {/if}
      </Button>
      {#if oncancel}
        <Button onclick={oncancel} variant="outline" class="h-10 px-5">Cancel</Button>
      {/if}
    </div>
  {/if}
</div>
