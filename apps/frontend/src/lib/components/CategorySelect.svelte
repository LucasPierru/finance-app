<svelte:options runes={true} />

<script lang="ts">
  import type { FinanceCategory } from "@finance-app/shared-types";
  import {
    Select,
    SelectContent,
    SelectItem,
    SelectSeparator,
    SelectTrigger,
  } from "$lib/components/ui/select";

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

<div class={className}>
  <Select
    type="single"
    bind:value
    onValueChange={(v) => onchange?.(v)}
  >
    <SelectTrigger class="w-full h-full text-left {!value ? 'text-muted-foreground' : ''}">
      {displayLabel}
    </SelectTrigger>
    <SelectContent>
      {#each categories as cat, i (cat.id)}
        {#if i > 0}
          <SelectSeparator />
        {/if}
        <SelectItem value={cat.id} label={cat.name} class="font-semibold" />
        {#each cat.subCategories as sub (sub.id)}
          <SelectItem value={sub.id} label={sub.name} class="pl-6" />
        {/each}
      {/each}
    </SelectContent>
  </Select>
</div>
