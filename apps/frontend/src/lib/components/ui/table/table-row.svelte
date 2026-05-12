<svelte:options runes={true} />

<script lang="ts">
  import { cn } from "$lib/utils";

  let { class: className = "", children } = $props<{ class?: string; children?: any }>();
</script>

<tr class={cn("border-b border-[#1c2030] transition-colors", className)}>
  {@render children?.()}
</tr>
