<svelte:options runes={true} />

<script lang="ts">
  import { Select } from "$lib/components/ui/select";

  interface MonthOption {
    key: string;
    label: string;
  }

  let {
    options,
    value = $bindable<string>(),
    label = "Month",
  }: {
    options: MonthOption[];
    value?: string;
    label?: string;
  } = $props();
</script>

<div class="rounded-xl border border-[#252a3a] bg-[#13161e] p-3">
  <p class="mb-2 text-xs uppercase tracking-wider text-slate-500">{label}</p>
  <Select bind:value class="h-11 text-base">
    {#each options as option (option.key)}
      <option value={option.key}>{option.label}</option>
    {/each}
  </Select>
</div>
