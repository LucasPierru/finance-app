<svelte:options runes={true} />

<script lang="ts">
  import type { HTMLSelectAttributes } from "svelte/elements";
  import { cn } from "$lib/utils";

  let {
    class: className = "",
    value = $bindable(),
    children,
    ...restProps
  }: HTMLSelectAttributes & {
    class?: string;
    value?: HTMLSelectAttributes["value"];
  } = $props();
</script>

<select
  bind:value
  class={cn(
    "flex h-10 w-full rounded-md border border-[#252a3a] bg-[#1c2030] px-3 py-2 text-sm text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5b8dee] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d0f14] disabled:cursor-not-allowed disabled:opacity-50",
    className,
  )}
  {...restProps}
>
  {@render children?.()}
</select>
