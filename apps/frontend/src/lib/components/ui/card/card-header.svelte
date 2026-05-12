<svelte:options runes={true} />

<script lang="ts">
  import { cn } from "$lib/utils";

  let { class: className = "", children } = $props<{ class?: string; children?: any }>();
</script>

<div class={cn("flex flex-col space-y-1.5 p-5", className)}>
  {@render children?.()}
</div>
