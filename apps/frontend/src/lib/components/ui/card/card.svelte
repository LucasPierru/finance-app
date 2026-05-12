<svelte:options runes={true} />

<script lang="ts">
  import { cn } from "$lib/utils";

  let { class: className = "", children } = $props<{ class?: string; children?: any }>();
</script>

<div class={cn("rounded-xl border border-[#252a3a] bg-[#13161e] text-slate-100 shadow-sm", className)}>
  {@render children?.()}
</div>
