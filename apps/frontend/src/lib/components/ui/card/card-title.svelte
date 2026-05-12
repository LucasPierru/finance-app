<svelte:options runes={true} />

<script lang="ts">
  import { cn } from "$lib/utils";

  let { class: className = "", children } = $props<{ class?: string; children?: any }>();
</script>

<h3 class={cn("font-display text-base font-semibold leading-none tracking-tight", className)}>
  {@render children?.()}
</h3>
