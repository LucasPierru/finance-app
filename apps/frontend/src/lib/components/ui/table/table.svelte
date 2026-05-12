<svelte:options runes={true} />

<script lang="ts">
  import { cn } from "$lib/utils";

  let { class: className = "", children } = $props<{ class?: string; children?: any }>();
</script>

<div class="relative w-full overflow-auto">
  <table class={cn("w-full caption-bottom text-sm", className)}>
    {@render children?.()}
  </table>
</div>
