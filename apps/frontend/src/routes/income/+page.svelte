<svelte:options runes={true} />

<script lang="ts">
  import EntryFormCard from "$lib/components/EntryFormCard.svelte";
  import FinanceListCard from "$lib/components/FinanceListCard.svelte";
</script>

<div class="animate-fade-up">
  <EntryFormCard variant="income" />

  <FinanceListCard variant="income" />
</div>
