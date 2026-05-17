<script lang="ts">
  import { page } from "$app/state";
  import { onMount } from "svelte";
  import EntryFormCard from "$lib/components/EntryFormCard.svelte";
  import FinanceListCard from "$lib/components/FinanceListCard.svelte";
  import { hydrateFinanceState } from "$lib/stores/finance";

  onMount(() => {
    hydrateFinanceState(page.data.initialFinanceState);
  });
</script>

<div class="animate-fade-up">
  <EntryFormCard variant="expense" />
  <FinanceListCard variant="expense" />
</div>
