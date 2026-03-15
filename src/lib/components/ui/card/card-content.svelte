<svelte:options runes={true} />

<script lang="ts">
  import { cn } from "$lib/utils";

  let { class: className = "", children } = $props<{ class?: string; children?: any }>();
</script>

<div class={cn("p-5 pt-0", className)}>
  {@render children?.()}
</div>
