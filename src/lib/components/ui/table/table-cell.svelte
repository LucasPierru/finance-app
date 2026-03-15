<svelte:options runes={true} />

<script lang="ts">
  import { cn } from "$lib/utils";

  let { class: className = "", children } = $props<{ class?: string; children?: any }>();
</script>

<td class={cn("p-4 align-middle", className)}>
  {@render children?.()}
</td>
