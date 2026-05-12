<script lang="ts">
  import { page } from "$app/state";
  import { onMount } from "svelte";
  import SectionHeader from "$lib/components/SectionHeader.svelte";
  import EntryFormCard from "$lib/components/EntryFormCard.svelte";
  import FinanceListCard from "$lib/components/FinanceListCard.svelte";
  import { hydrateFinanceState } from "$lib/stores/finance";

  onMount(() => {
    hydrateFinanceState(page.data.initialFinanceState);
  });
</script>

<div class="py-10">
  <div class="animate-fade-up">
    <SectionHeader title="Expenses" subtitle="Know exactly where your money goes" />
    <EntryFormCard variant="expense" />
    <FinanceListCard variant="expense" />
  </div>
</div>
