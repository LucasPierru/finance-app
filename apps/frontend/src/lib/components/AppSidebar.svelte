<svelte:options runes={true} />

<script lang="ts">
  import { page } from "$app/state";
  import { LayoutDashboard, TrendingUp, LineChart, ArrowLeftRight, Settings, PiggyBank } from "lucide-svelte";
  import { goto } from "$app/navigation";
  import { authState, logout } from "$lib/stores/auth";
  import { Button } from "$lib/components/ui/button";
  import { Label } from "$lib/components/ui/label";
  import { Select } from "$lib/components/ui/select";
  import { setTheme, theme, type ThemeName } from "$lib/stores/theme";

  let { monthlySurplus }: { monthlySurplus: number } = $props();

  function fmt(n: number): string {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(n);
  }

  const navItems = [
    { label: "Overview", path: "/", icon: LayoutDashboard },
    { label: "Budget", path: "/budget", icon: PiggyBank },
    { label: "Projection", path: "/projection", icon: TrendingUp },
    { label: "Transactions", path: "/transactions", icon: ArrowLeftRight },
    { label: "Settings", path: "/settings", icon: Settings },
  ];

  const themeOptions: Array<{ value: ThemeName; label: string }> = [
    { value: "dark", label: "Dark" },
    { value: "light", label: "Light" },
    { value: "ocean", label: "Ocean" },
  ];

  function handleThemeChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    setTheme(target.value as ThemeName);
  }

  async function handleLogout() {
    await logout();
    await goto("/login");
  }
</script>

<nav
  class="fixed inset-x-0 bottom-0 z-40 border-t border-[#252a3a] bg-[#10131b]/95 px-2 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] backdrop-blur-md md:hidden"
  aria-label="Mobile navigation"
>
  <div class="grid grid-cols-5 gap-1">
    {#each navItems as item}
      <a
        href={item.path}
        class="flex flex-col items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium transition-colors
        {page.url.pathname === item.path
          ? 'bg-[#1c2030] text-slate-100 border border-[#252a3a]'
          : 'text-slate-400 hover:bg-[#1c2030] hover:text-slate-100'}"
      >
        <item.icon class="h-4 w-4" />
        <span>{item.label}</span>
      </a>
    {/each}
  </div>
</nav>

<aside
  class="hidden md:sticky md:top-0 md:flex md:h-screen md:w-72 md:shrink-0 md:flex-col md:border-r md:border-[#252a3a] md:bg-[#10131b]"
>
  <div class="flex items-center gap-2.5 border-b border-[#252a3a] px-5 py-4">
    <div class="grid h-8 w-8 place-items-center rounded-lg bg-[#5b8dee]">
      <LineChart class="h-4 w-4 text-white" />
    </div>
    <p class="font-display text-lg font-semibold">WealthFlow</p>
  </div>

  <nav class="space-y-1.5 p-4">
    {#each navItems as item}
      <a
        href={item.path}
        class="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors
        {page.url.pathname === item.path
          ? 'bg-[#1c2030] text-slate-100 border border-[#252a3a]'
          : 'text-slate-400 hover:bg-[#1c2030] hover:text-slate-100'}"
      >
        <item.icon class="h-4 w-4" />
        {item.label}
      </a>
    {/each}
  </nav>

  <div class="mt-auto p-4">
    <div class="mb-3 rounded-xl border border-[#252a3a] bg-[#13161e] p-4">
      <Label for="desktop-theme">Theme</Label>
      <Select id="desktop-theme" class="mt-2" value={$theme} onchange={handleThemeChange}>
        {#each themeOptions as option}
          <option value={option.value}>{option.label}</option>
        {/each}
      </Select>
    </div>

    <div class="rounded-xl border border-[#252a3a] bg-[#13161e] p-4">
      <p class="text-xs uppercase tracking-wider text-slate-500">Monthly Surplus</p>
      <p class="mt-1 font-display text-2xl font-semibold {monthlySurplus >= 0 ? 'text-emerald-400' : 'text-rose-400'}">
        {fmt(monthlySurplus)}
      </p>
      <p class="mt-1 text-xs text-slate-500">Positive cash flow accelerates compounding.</p>
    </div>

    <div class="mt-3 rounded-xl border border-[#252a3a] bg-[#13161e] p-4">
      <p class="text-xs text-slate-500 mb-2">{$authState.user?.email ?? "Signed in"}</p>
      <Button class="w-full" variant="outline" onclick={handleLogout} disabled={$authState.loading}>Sign out</Button>
    </div>
  </div>
</aside>
