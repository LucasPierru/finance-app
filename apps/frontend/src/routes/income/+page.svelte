<svelte:options runes={true} />

<script lang="ts">
  import SectionHeader from "$lib/components/SectionHeader.svelte";
  import EntryFormCard from "$lib/components/EntryFormCard.svelte";
  import FinanceListCard from "$lib/components/FinanceListCard.svelte";
</script>

<div class="py-10">
  <div class="animate-fade-up">
    <SectionHeader title="Income Sources" subtitle="Track all your revenue streams" />

    <EntryFormCard variant="income" />

    <FinanceListCard variant="income" />
  </div>
</div>
