<svelte:options runes={true} />

<script lang="ts">
  let {
    label,
    value,
    hint,
    valueClass = "",
    labelClass = "",
    hintClass = "",
  }: {
    label: string;
    value: string;
    hint: string;
    valueClass?: string;
    labelClass?: string;
    hintClass?: string;
  } = $props();
</script>

<div class="bg-[#13161e] border border-[#252a3a] rounded-xl p-5 hover:border-[#5b8dee]/40 transition-colors">
  <p class="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2 {labelClass}">{label}</p>
  <p class="font-display text-2xl font-700 mb-1 {valueClass}">{value}</p>
  <p class="text-xs text-slate-500 {hintClass}">{hint}</p>
</div>
