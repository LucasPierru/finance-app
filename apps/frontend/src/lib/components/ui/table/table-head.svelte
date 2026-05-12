<svelte:options runes={true} />

<script lang="ts">
  import { cn } from "$lib/utils";

  let { class: className = "", children } = $props<{ class?: string; children?: any }>();
</script>

<th
  class={cn(
    "h-12 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wider text-slate-500",
    className,
  )}
>
  {@render children?.()}
</th>
