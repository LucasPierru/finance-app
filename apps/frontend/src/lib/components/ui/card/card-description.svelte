<svelte:options runes={true} />

<script lang="ts">
  import { cn } from "$lib/utils";

  let { class: className = "", children } = $props<{ class?: string; children?: any }>();
</script>

<p class={cn("text-sm text-slate-500", className)}>
  {@render children?.()}
</p>
