<svelte:options runes={true} />

<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Select } from "$lib/components/ui/select";
  import { apiRequest } from "$lib/api/client";
  import { untrack } from "svelte";
  import type { BudgetPlan, FinanceCategory } from "@finance-app/shared-types";

  type Period = "weekly" | "monthly" | "yearly";

  interface ItemDraft {
    key: number;
    categoryId: string;
    amount: string;
    period: Period;
  }

  let {
    expenseCategories,
    editPlan = undefined,
    oncreated,
    onupdated,
    oncancel,
  }: {
    expenseCategories: FinanceCategory[];
    editPlan?: BudgetPlan;
    oncreated?: (plan: BudgetPlan) => void;
    onupdated?: (plan: BudgetPlan) => void;
    oncancel?: () => void;
  } = $props();

  const isEditing = $derived(editPlan !== undefined);

  let planName = $state(untrack(() => editPlan?.name ?? ""));
  let nextKey = $state(untrack(() => (editPlan ? editPlan.items.length : 1)));
  let items = $state<ItemDraft[]>(
    untrack(() =>
      editPlan && editPlan.items.length > 0
        ? editPlan.items.map((item, i) => ({
            key: i,
            categoryId: item.categoryId ?? "",
            amount: String(item.amount),
            period: item.period as Period,
          }))
        : [{ key: 0, categoryId: "", amount: "", period: "monthly" }],
    ),
  );
  let error = $state<string | null>(null);
  let submitting = $state(false);

  function addItem() {
    items = [...items, { key: nextKey, categoryId: "", amount: "", period: "monthly" }];
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

    const body = JSON.stringify({
      name: planName.trim(),
      items: validItems.map((item) => ({
        categoryId: item.categoryId || null,
        amount: Number(item.amount),
        period: item.period,
      })),
    });

    submitting = true;
    try {
      if (isEditing && editPlan) {
        const plan = await apiRequest<BudgetPlan>(`/api/budget/plans/${editPlan.id}`, {
          method: "PUT",
          body,
        });
        onupdated?.(plan);
      } else {
        const plan = await apiRequest<BudgetPlan>("/api/budget/plans", {
          method: "POST",
          body,
        });
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
    <Input id="plan-name" bind:value={planName} placeholder="e.g. Monthly Budget" class="h-10" />
  </div>

  <!-- Item rows -->
  <div class="space-y-3">
    <p class="text-sm font-medium text-slate-300">Category limits</p>
    {#each items as item (item.key)}
      <div class="flex items-center gap-2">
        <Select bind:value={item.categoryId} class="h-9 min-w-0 flex-[2]">
          <option value="">No category</option>
          {#each expenseCategories as cat (cat.id)}
            <option value={cat.id}>{cat.name}</option>
          {/each}
        </Select>
        <Input bind:value={item.amount} type="number" min="0" placeholder="Amount" class="h-9 min-w-[80px] flex-1" />
        <Select bind:value={item.period} class="h-9 min-w-[90px] flex-1">
          <option value="monthly">/ mo</option>
          <option value="weekly">/ wk</option>
          <option value="yearly">/ yr</option>
        </Select>
        {#if items.length > 1}
          <button
            onclick={() => removeItem(item.key)}
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-700 text-slate-500 transition-colors hover:border-rose-800 hover:text-rose-400"
            aria-label="Remove item"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-3.5 w-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        {:else}
          <div class="h-9 w-9 shrink-0"></div>
        {/if}
      </div>
    {/each}

    <button
      onclick={addItem}
      class="flex items-center gap-1.5 text-sm text-slate-400 transition-colors hover:text-slate-200"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-4 w-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <path d="M12 5v14M5 12h14" />
      </svg>
      Add category
    </button>
  </div>

  {#if error}
    <p class="text-sm text-rose-400">{error}</p>
  {/if}

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
</div>
