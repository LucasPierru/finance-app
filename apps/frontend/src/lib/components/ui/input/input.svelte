<svelte:options runes={true} />

<script lang="ts">
  import type { HTMLInputAttributes } from "svelte/elements";
  import { cn } from "$lib/utils";

  let {
    class: className = "",
    value = $bindable(),
    type = "text",
    ...restProps
  }: HTMLInputAttributes & {
    class?: string;
    value?: HTMLInputAttributes["value"];
  } = $props();
</script>

<input
  {type}
  bind:value
  class={cn(
    "flex h-9 w-full rounded-lg border border-[#252a3a] bg-[#1c2030] px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5b8dee] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d0f14] disabled:cursor-not-allowed disabled:opacity-50",
    className,
  )}
  {...restProps}
/>
