<svelte:options runes={true} />

<script lang="ts">
  import type { FinanceCategory } from "@finance-app/shared-types";
  import { ChevronDown } from "lucide-svelte";

  let {
    categories,
    value = $bindable(""),
    placeholder = "Select category",
    onchange,
    class: className = "",
  }: {
    categories: FinanceCategory[];
    value?: string;
    placeholder?: string;
    onchange?: (value: string) => void;
    class?: string;
  } = $props();

  const displayLabel = $derived.by(() => {
    if (!value) return placeholder;
    for (const cat of categories) {
      if (cat.id === value) return cat.name;
      for (const sub of cat.subCategories) {
        if (sub.id === value) return sub.name;
      }
    }
    return placeholder;
  });
</script>

<div class="relative {className}">
  <select
    bind:value
    onchange={() => onchange?.(value)}
    class="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 bg-[#1c2030] text-slate-100"
  >
    <option value="">{placeholder}</option>
    {#each categories as cat (cat.id)}
      <option value={cat.id} style="font-weight: 600">{cat.name}</option>
      {#each cat.subCategories as sub (sub.id)}
        <option value={sub.id}>&nbsp;&nbsp;&nbsp;&nbsp;{sub.name}</option>
      {/each}
    {/each}
  </select>
  <div class="pointer-events-none flex h-full w-full items-center rounded-md border border-[#252a3a] bg-[#1c2030] px-3 py-2 text-sm">
    <span class="flex-1 truncate {!value ? 'text-slate-500' : 'text-slate-100'}">{displayLabel}</span>
    <ChevronDown class="h-4 w-4 shrink-0 text-slate-400" />
  </div>
</div>
