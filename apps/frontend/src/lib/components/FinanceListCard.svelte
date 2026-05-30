<svelte:options runes={true} />

<script lang="ts">
  import {
    revenues,
    costs,
    totalRevenue,
    totalCosts,
    incomeCategories,
    expenseCategories,
    removeRevenue,
    removeCost,
    updateRevenue,
    updateCost,
    type FinanceItem,
  } from "$lib/stores/finance.js";
  import { Button } from "$lib/components/ui/button";
  import { formatCurrency } from "$lib/utils/format";
  import { Input } from "$lib/components/ui/input";
  import { Select } from "$lib/components/ui/select";

  type Variant = "income" | "expense";

  let { variant }: { variant: Variant } = $props();

  const items = $derived(variant === "income" ? $revenues : $costs);
  const total = $derived(variant === "income" ? $totalRevenue : $totalCosts);

  const copyByVariant: Record<Variant, { emptyMessage: string; amountClass: string; totalLabel: string }> = {
    income: {
      emptyMessage: "No income sources yet. Add one above.",
      amountClass: "text-emerald-400",
      totalLabel: "Total Monthly Revenue",
    },
    expense: {
      emptyMessage: "No expenses yet. Add one above.",
      amountClass: "text-rose-400",
      totalLabel: "Total Monthly Costs",
    },
  };

  const copy = $derived(copyByVariant[variant]);
  const categoryOptions = $derived(variant === "income" ? incomeCategories : expenseCategories);

  let editingId = $state<string | null>(null);
  let editName = $state("");
  let editRawAmount = $state("");
  let editFrequency = $state<FinanceItem["frequency"]>("monthly");
  let editCategory = $state<string>("Other");

  function handleRemove(id: string) {
    if (variant === "income") {
      removeRevenue(id);
      return;
    }

    removeCost(id);
  }

  function startEditing(item: FinanceItem) {
    editingId = item.id;
    editName = item.name;
    editRawAmount = item.rawAmount;
    editFrequency = item.frequency;
    editCategory = item.category;
  }

  function cancelEditing() {
    editingId = null;
    editName = "";
    editRawAmount = "";
    editFrequency = "monthly";
    editCategory = "Other";
  }

  function saveEditing(id: string) {
    const normalizedName = editName.trim();
    const normalizedRawAmount = String(editRawAmount ?? "").trim();
    if (!normalizedName || !normalizedRawAmount) return;

    const updates = {
      name: normalizedName,
      rawAmount: normalizedRawAmount,
      frequency: editFrequency,
      category: editCategory,
    };

    if (variant === "income") {
      updateRevenue(id, updates);
    } else {
      updateCost(id, updates);
    }

    cancelEditing();
  }
</script>

<div class="bg-[#13161e] border border-[#252a3a] rounded-xl overflow-hidden">
  {#if items.length === 0}
    <div class="py-16 text-center">
      <div class="text-5xl mb-3 opacity-20">◎</div>
      <p class="text-slate-500 text-sm">{copy.emptyMessage}</p>
    </div>
  {:else}
    {#each items as item (item.id)}
      <div
        class="flex items-center justify-between px-5 py-4 border-b border-[#1c2030] last:border-none hover:bg-[#1c2030] transition-colors"
      >
        {#if editingId === item.id}
          <div class="w-full grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
            <Input bind:value={editName} class="md:col-span-3 h-10" />
            <Input bind:value={editRawAmount} type="number" class="md:col-span-2 h-10" />
            <Select bind:value={editFrequency} class="md:col-span-2 h-10">
              <option value="monthly">Monthly</option>
              <option value="weekly">Weekly</option>
              {#if variant === "income"}
                <option value="biweekly">Every 2 weeks</option>
              {/if}
              <option value="yearly">Yearly</option>
            </Select>
            <Select bind:value={editCategory} class="md:col-span-2 h-10">
              {#each categoryOptions as option}
                <option value={option}>{option}</option>
              {/each}
            </Select>
            <div class="md:col-span-3 flex items-center gap-2 md:justify-end">
              <Button size="sm" onclick={() => saveEditing(item.id)}>Save</Button>
              <Button size="sm" variant="ghost" onclick={cancelEditing}>Cancel</Button>
            </div>
          </div>
        {:else}
          <div>
            <p class="text-sm font-medium text-slate-200">{item.name}</p>
            <p class="text-xs text-slate-500 mt-0.5">${item.rawAmount} · {item.frequency} · {item.category}</p>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-base font-display font-700 {copy.amountClass}"
              >{formatCurrency(item.amount)}<span class="text-xs font-normal text-slate-500">/mo</span></span
            >
            <Button size="sm" variant="ghost" onclick={() => startEditing(item)}>Edit</Button>
            <Button size="icon" variant="outline" onclick={() => handleRemove(item.id)} aria-label="Delete entry"
              >✕</Button
            >
          </div>
        {/if}
      </div>
    {/each}
    <div class="flex justify-between items-center px-5 py-4 bg-[#1c2030]">
      <span class="text-sm font-semibold text-slate-400">{copy.totalLabel}</span>
      <span class="font-display text-lg font-700 {copy.amountClass}">{formatCurrency(total)}</span>
    </div>
  {/if}
</div>
