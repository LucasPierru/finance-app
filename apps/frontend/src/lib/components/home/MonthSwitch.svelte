<svelte:options runes={true} />

<script lang="ts">
  import { Select, SelectContent, SelectItem, SelectTrigger } from "$lib/components/ui/select";

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

  const displayLabel = $derived(options.find((o) => o.key === value)?.label ?? "");
</script>

<div class="rounded-xl border border-[#252a3a] bg-[#13161e] p-3">
  <p class="mb-2 text-xs uppercase tracking-wider text-slate-500">{label}</p>
  <div class="h-11">
    <Select type="single" bind:value>
      <SelectTrigger class="w-full h-full text-base">
        {displayLabel}
      </SelectTrigger>
      <SelectContent>
        {#each options as option (option.key)}
          <SelectItem value={option.key} label={option.label} />
        {/each}
      </SelectContent>
    </Select>
  </div>
</div>
