<svelte:options runes={true} />

<script lang="ts">
  let {
    title,
    subtitle,
  }: {
    title: string;
    subtitle: string;
  } = $props();
</script>

<div class="mb-8">
  <h1 class="font-display text-3xl font-700 tracking-tight text-slate-100 mb-1">{title}</h1>
  <p class="text-slate-500 text-sm">{subtitle}</p>
</div>
