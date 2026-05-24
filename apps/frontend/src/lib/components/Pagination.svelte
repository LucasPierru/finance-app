<script lang="ts">
  import { Pagination as PaginationPrimitive } from "bits-ui";
  import { page } from "$app/state";
  import { goto } from "$app/navigation";
  import { PaginationPrevious, PaginationNext } from "$lib/components/ui/pagination/index.js";

  let {
    currentPage = 1,
    totalPages = 1,
    paramName = "page",
  }: {
    currentPage?: number;
    totalPages?: number;
    /** URL search param name to update on page change. Defaults to "page". */
    paramName?: string;
  } = $props();

  function navigateTo(p: number) {
    const params = new URLSearchParams(page.url.searchParams);
    params.set(paramName, String(p));
    goto(`?${params}`);
  }
</script>

{#if totalPages > 1}
  <PaginationPrimitive.Root
    count={totalPages}
    perPage={1}
    page={currentPage}
    onPageChange={navigateTo}
    class="flex items-center justify-between border-t border-[#252a3a] px-5 py-3"
  >
    {#snippet children(_)}
      <PaginationPrevious />
      <p class="text-xs text-slate-500">Page {currentPage} / {totalPages}</p>
      <PaginationNext />
    {/snippet}
  </PaginationPrimitive.Root>
{/if}
