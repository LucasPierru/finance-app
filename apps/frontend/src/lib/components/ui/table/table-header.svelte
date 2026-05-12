<svelte:options runes={true} />

<script lang="ts">
  import { cn } from "$lib/utils";

  let { class: className = "", children } = $props<{ class?: string; children?: any }>();
</script>

<thead class={cn("[&_tr]:border-b", className)}>
  {@render children?.()}
</thead>
