<svelte:options runes={true} />

<script lang="ts">
  import { Plus } from "lucide-svelte";

  let {
    onclick,
    href,
    ariaLabel = "Add",
  }: {
    onclick?: () => void;
    href?: string;
    ariaLabel?: string;
  } = $props();
</script>

{#if href}
  <a
    {href}
    class="fixed bottom-28 right-4 z-[45] flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-opacity hover:opacity-90 md:hidden"
    aria-label={ariaLabel}
  >
    <Plus class="h-6 w-6" />
  </a>
{:else}
  <button
    {onclick}
    class="fixed bottom-28 right-4 z-[45] flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-opacity hover:opacity-90 md:hidden"
    aria-label={ariaLabel}
  >
    <Plus class="h-6 w-6" />
  </button>
{/if}
