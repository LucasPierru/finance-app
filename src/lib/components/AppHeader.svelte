<svelte:options runes={true} />

<script lang="ts">
  import { page } from "$app/state";

  const navItems = [
    { label: "overview", path: "/" },
    { label: "income", path: "/income" },
    { label: "expenses", path: "/expenses" },
    { label: "projection", path: "/projection" },
  ];
</script>

<header class="sticky top-0 z-50 border-b border-[#252a3a] bg-[#0d0f14]/90 backdrop-blur-md">
  <div class="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between">
    <div class="flex items-center gap-2.5">
      <div class="w-7 h-7 rounded-lg bg-[#5b8dee] flex items-center justify-center">
        <svg class="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      </div>
      <span class="font-display font-700 text-base tracking-tight text-slate-100">WealthFlow</span>
    </div>

    <nav class="flex gap-1">
      {#each navItems as item}
        <a
          href={item.path}
          class="px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all capitalize
            {page.url.pathname === item.path
            ? 'bg-[#1c2030] text-slate-100 border border-[#252a3a]'
            : 'text-slate-500 hover:text-slate-300 hover:bg-[#13161e]'}"
        >
          {item.label}
        </a>
      {/each}
    </nav>
  </div>
</header>
