<svelte:options runes={true} />

<script lang="ts">
  interface TabItem {
    id: string;
    label: string;
  }

  let {
    tabs,
    activeTab = $bindable<string>(),
  }: {
    tabs: TabItem[];
    activeTab?: string;
  } = $props();
</script>

<div class="sticky top-0 z-20 mb-4 border-b border-[#252a3a] bg-[#0d0f14] py-3 backdrop-blur">
  <div class="grid grid-cols-3 gap-2">
    {#each tabs as tab (tab.id)}
      <button
        type="button"
        class="rounded-lg border px-4 py-2 text-sm font-semibold transition-all {activeTab === tab.id
          ? 'border-[#5b8dee] bg-[#5b8dee]/20 text-[#5b8dee]'
          : 'border-[#252a3a] bg-[#13161e]/50 text-slate-400 hover:text-slate-300'}"
        onclick={() => {
          activeTab = tab.id;
        }}
      >
        {tab.label}
      </button>
    {/each}
  </div>
</div>
