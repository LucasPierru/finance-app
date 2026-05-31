<svelte:options runes={true} />

<script lang="ts">
  import { page as pageState } from "$app/state";
  import { goto } from "$app/navigation";
  import { Button } from "$lib/components/ui/button";
  import { ChevronLeft, ChevronRight } from "lucide-svelte";

  let {
    currentPage = 1,
    totalPages = 1,
    onchange,
    class: className = "",
  }: {
    currentPage?: number;
    totalPages?: number;
    onchange?: (page: number) => void;
    class?: string;
  } = $props();

  function navigate(p: number) {
    if (p < 1 || p > totalPages) return;
    if (onchange) {
      onchange(p);
    } else {
      const params = new URLSearchParams(pageState.url.searchParams);
      params.set("page", String(p));
      goto(`?${params}`);
    }
  }
</script>

{#if totalPages > 1}
  <div class="flex items-center justify-center gap-6 border-t border-[#252a3a] px-5 py-2 md:justify-between {className}">
    <Button
      variant="ghost"
      class="h-12 gap-1.5 px-6"
      onclick={() => navigate(currentPage - 1)}
      disabled={currentPage <= 1}
    >
      <ChevronLeft class="size-4" />
      <span class="hidden sm:inline">Previous</span>
    </Button>

    <div class="flex h-12 items-center text-sm text-slate-500">Page {currentPage} / {totalPages}</div>

    <Button
      variant="ghost"
      class="h-12 gap-1.5 px-6"
      onclick={() => navigate(currentPage + 1)}
      disabled={currentPage >= totalPages}
    >
      <span class="hidden sm:inline">Next</span>
      <ChevronRight class="size-4" />
    </Button>
  </div>
{/if}
