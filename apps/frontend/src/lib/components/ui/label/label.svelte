<svelte:options runes={true} />

<script lang="ts">
  import type { HTMLLabelAttributes } from "svelte/elements";
  import { cn } from "$lib/utils";

  let { class: className = "", children, ...restProps }: HTMLLabelAttributes & { class?: string } = $props();
</script>

<label class={cn("text-xs font-semibold uppercase tracking-wider text-slate-500", className)} {...restProps}>
  {@render children?.()}
</label>
