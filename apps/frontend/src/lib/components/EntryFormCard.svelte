<script lang="ts">
  import { onMount } from "svelte";
  import { addRevenue, addCost, toMonthly, type FinanceItem } from "$lib/stores/finance.js";
  import { api } from "$lib/requests/api";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Select } from "$lib/components/ui/select";

  interface Category {
    id: string;
    name: string;
    type: string;
  }

  type Variant = "income" | "expense";
  type Frequency = FinanceItem["frequency"];

  let { variant }: { variant: Variant } = $props();

  let name = $state("");
  let amount = $state("");
  let frequency = $state<Frequency>("monthly");
  let categoryId = $state<string>("");
  let categories = $state<Category[]>([]);

  const categoryOptions = $derived(categories.filter((c) => c.type === variant));

  const selectedCategory = $derived(categories.find((c) => c.id === categoryId));

  onMount(async () => {
    try {
      const data = await api.get<Category[]>('/api/finance/categories');
      categories = data;
      const filtered = data.filter((c) => c.type === variant);
      if (filtered.length > 0) categoryId = filtered[0].id;
    } catch (e) {
      console.error("Failed to load categories", e);
    }
  });

  const copyByVariant: Record<Variant, { title: string; namePlaceholder: string; showBiweekly: boolean }> = {
    income: {
      title: "Add Income Source",
      namePlaceholder: "Name (e.g. Salary)",
      showBiweekly: true,
    },
    expense: {
      title: "Add Expense",
      namePlaceholder: "Name (e.g. Rent)",
      showBiweekly: false,
    },
  };

  const copy = $derived(copyByVariant[variant]);

  async function handleSubmit() {
    const normalizedName = name.trim();
    const normalizedRawAmount = String(amount ?? "").trim();
    if (!normalizedName || !normalizedRawAmount) return;

    const monthly = toMonthly(Number(normalizedRawAmount), frequency);
    const categoryName = selectedCategory?.name ?? "";

    if (variant === "income") {
      addRevenue({
        name: normalizedName,
        amount: monthly,
        rawAmount: normalizedRawAmount,
        frequency,
        category: categoryName,
        categoryId,
      });
    } else {
      await addCost({
        name: normalizedName,
        amount: monthly,
        rawAmount: normalizedRawAmount,
        frequency,
        category: categoryName,
        categoryId,
      });
    }

    name = "";
    amount = "";
    if (categoryOptions.length > 0) categoryId = categoryOptions[0].id;
  }
</script>

<div class="bg-[#13161e] border border-[#252a3a] rounded-xl p-5 mb-5">
  <h3 class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">{copy.title}</h3>
  <div class="flex flex-wrap gap-3">
    <Input
      bind:value={name}
      placeholder={copy.namePlaceholder}
      onkeydown={(e) => e.key === "Enter" && handleSubmit()}
      class="h-11 flex-[2] min-w-[140px]"
    />
    <Input
      bind:value={amount}
      type="number"
      placeholder="Amount"
      onkeydown={(e) => e.key === "Enter" && handleSubmit()}
      class="h-11 flex-1 min-w-[100px]"
    />
    <Select bind:value={frequency} class="h-11 flex-1 min-w-[110px]">
      <option value="monthly">Monthly</option>
      <option value="weekly">Weekly</option>
      {#if copy.showBiweekly}
        <option value="biweekly">Every 2 weeks</option>
      {/if}
      <option value="yearly">Yearly</option>
    </Select>
    <Select bind:value={categoryId} class="h-11 flex-1 min-w-[130px]">
      {#each categoryOptions as option}
        <option value={option.id}>{option.name}</option>
      {/each}
    </Select>
    <Button onclick={handleSubmit} class="h-11 px-5">+ Add</Button>
  </div>
</div>
