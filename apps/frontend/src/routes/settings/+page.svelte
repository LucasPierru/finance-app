<svelte:options runes={true} />

<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import { costs, investmentSettings, revenues } from "$lib/stores/finance.js";
  import {
    bankError,
    bankHasSyncedData,
    bankIsSynced,
    bankLoading,
    bankState,
    createPlaidLinkToken,
    disconnectBank,
    exchangePublicToken,
    syncBankData,
  } from "$lib/stores/banking";
  import { setTheme, theme, type ThemeName } from "$lib/stores/theme";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import { Select } from "$lib/components/ui/select";
  import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "$lib/components/ui/card";

  const defaultSettings = {
    annualReturn: 7,
    years: 20,
    initialAmount: 0,
    dividendYield: 2,
    incomeGrowth: 2,
    expenseGrowth: 2,
  };

  function updateSettings() {
    investmentSettings.update((s) => ({ ...s }));
  }

  function resetProjectionSettings() {
    investmentSettings.set(defaultSettings);
  }

  function clearIncomeEntries() {
    revenues.set([]);
  }

  function clearExpenseEntries() {
    costs.set([]);
  }

  const themeOptions: Array<{ value: ThemeName; label: string; description: string }> = [
    { value: "dark", label: "Dark", description: "Current default with deep contrast." },
    { value: "light", label: "Light", description: "Bright workspace for daylight usage." },
    { value: "ocean", label: "Ocean", description: "Blue-green palette with softer contrast." },
  ];

  const plaidCountryOptions: Array<{ value: string; label: string }> = [
    { value: "US", label: "United States" },
    { value: "CA", label: "Canada" },
    { value: "GB", label: "United Kingdom" },
    { value: "FR", label: "France" },
    { value: "ES", label: "Spain" },
    { value: "IE", label: "Ireland" },
    { value: "NL", label: "Netherlands" },
    { value: "DE", label: "Germany" },
  ];

  let selectedPlaidCountry = $state("US");

  function handleThemeChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    setTheme(target.value as ThemeName);
  }

  function fmtCurrency(value: number | null, currencyCode: string | null): string {
    if (value === null) return "-";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currencyCode ?? "USD",
      maximumFractionDigits: 2,
    }).format(value);
  }

  function fmtDate(value: string | null): string {
    if (!value) return "Never";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "Never";
    return parsed.toLocaleString();
  }

  async function ensurePlaidScriptLoaded(): Promise<boolean> {
    if (typeof window === "undefined") return false;
    if (window.Plaid) return true;

    await new Promise<void>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>('script[data-plaid="true"]');
      if (existing) {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", () => reject(new Error("Plaid script failed to load")), {
          once: true,
        });
        return;
      }

      const script = document.createElement("script");
      script.src = "https://cdn.plaid.com/link/v2/stable/link-initialize.js";
      script.async = true;
      script.dataset.plaid = "true";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Plaid script failed to load"));
      document.body.appendChild(script);
    });

    return Boolean(window.Plaid);
  }

  async function connectWithPlaid() {
    try {
      const linkToken = await createPlaidLinkToken(selectedPlaidCountry);
      const ready = await ensurePlaidScriptLoaded();
      if (!ready || !window.Plaid) {
        throw new Error("Plaid Link is not available");
      }

      const handler = window.Plaid.create({
        token: linkToken,
        onSuccess: async (publicToken, metadata) => {
          const institutionName =
            typeof metadata === "object" && metadata && "institution" in metadata
              ? ((metadata as { institution?: { name?: string } }).institution?.name ?? null)
              : null;

          await exchangePublicToken(publicToken, institutionName);
        },
      });

      handler.open();
    } catch (error) {
      console.error("Plaid connect failed", error);
    }
  }

  onMount(() => {
    const savedCountry = localStorage.getItem("plaid_country");
    if (savedCountry && plaidCountryOptions.some((option) => option.value === savedCountry)) {
      selectedPlaidCountry = savedCountry;
    }

    if (page.data.initialBankState) {
      bankState.set(page.data.initialBankState);
    }
  });

  function handlePlaidCountryChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    selectedPlaidCountry = target.value;
    localStorage.setItem("plaid_country", selectedPlaidCountry);
  }
</script>

<div class="animate-fade-up">
  <Card class="mb-5">
    <CardHeader>
      <CardTitle>Theme</CardTitle>
      <CardDescription>Pick a visual style for the entire app UI.</CardDescription>
    </CardHeader>
    <CardContent>
      <Label for="theme-select" class="mb-2 block">Active Theme</Label>
      <Select id="theme-select" class="w-full md:max-w-sm" value={$theme} onchange={handleThemeChange}>
        {#each themeOptions as option}
          <option value={option.value}>{option.label}</option>
        {/each}
      </Select>
      <p class="mt-2 text-sm text-slate-500">
        {themeOptions.find((option) => option.value === $theme)?.description}
      </p>
    </CardContent>
  </Card>

  <Card class="mb-5">
    <CardHeader>
      <CardTitle>Projection Preferences</CardTitle>
      <CardDescription>These values are stored locally and used across dashboard and projection charts.</CardDescription
      >
    </CardHeader>
    <CardContent>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label class="block">
          <Label class="mb-2 block">Annual Return %</Label>
          <Input
            type="number"
            bind:value={$investmentSettings.annualReturn}
            min="0"
            max="50"
            step="0.1"
            onchange={updateSettings}
          />
        </label>

        <label class="block">
          <Label class="mb-2 block">Time Horizon (Years)</Label>
          <Input type="number" bind:value={$investmentSettings.years} min="1" max="60" onchange={updateSettings} />
        </label>

        <label class="block">
          <Label class="mb-2 block">Starting Amount</Label>
          <Input type="number" bind:value={$investmentSettings.initialAmount} min="0" onchange={updateSettings} />
        </label>

        <label class="block">
          <Label class="mb-2 block">Dividend Yield %</Label>
          <Input
            type="number"
            bind:value={$investmentSettings.dividendYield}
            min="0"
            max="20"
            step="0.1"
            onchange={updateSettings}
          />
        </label>

        <label class="block">
          <Label class="mb-2 block">Income Growth %</Label>
          <Input
            type="number"
            bind:value={$investmentSettings.incomeGrowth}
            min="-10"
            max="30"
            step="0.1"
            onchange={updateSettings}
          />
        </label>

        <label class="block">
          <Label class="mb-2 block">Expense Growth %</Label>
          <Input
            type="number"
            bind:value={$investmentSettings.expenseGrowth}
            min="-10"
            max="30"
            step="0.1"
            onchange={updateSettings}
          />
        </label>
      </div>

      <div class="mt-4 flex flex-wrap gap-2">
        <Button variant="secondary" onclick={updateSettings}>Save Changes</Button>
        <Button variant="outline" onclick={resetProjectionSettings}>Reset Projection Defaults</Button>
      </div>
    </CardContent>
  </Card>

  <Card>
    <CardHeader>
      <CardTitle>Data Actions</CardTitle>
      <CardDescription>Use these controls to clear local demo data quickly.</CardDescription>
    </CardHeader>
    <CardContent>
      <div class="flex flex-wrap gap-2">
        <Button variant="outline" onclick={clearIncomeEntries}>Clear All Income</Button>
        <Button variant="outline" onclick={clearExpenseEntries}>Clear All Expenses</Button>
      </div>
    </CardContent>
  </Card>

  <Card class="mt-5">
    <CardHeader>
      <CardTitle>Bank Connection (Plaid)</CardTitle>
      <CardDescription>Connect your bank to import real accounts and recent transactions.</CardDescription>
    </CardHeader>
    <CardContent>
      <div class="mb-4">
        <Label for="plaid-country-select" class="mb-2 block">Bank Country</Label>
        <Select
          id="plaid-country-select"
          class="w-full md:max-w-sm"
          value={selectedPlaidCountry}
          onchange={handlePlaidCountryChange}
        >
          {#each plaidCountryOptions as option}
            <option value={option.value}>{option.label}</option>
          {/each}
        </Select>
        <p class="mt-2 text-sm text-slate-500">This country is used when opening Plaid Link.</p>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        {#if !$bankState.connected}
          <Button onclick={connectWithPlaid} disabled={$bankLoading}>Connect Bank</Button>
        {:else}
          <Button onclick={syncBankData} disabled={$bankLoading}>Sync Now</Button>
          <Button variant="outline" onclick={disconnectBank} disabled={$bankLoading}>Disconnect</Button>
        {/if}
      </div>

      <p class="mt-3 text-sm text-slate-500">
        Status:
        {#if $bankLoading}
          Loading...
        {:else if $bankIsSynced}
          Connected{$bankState.institutionName ? ` (${$bankState.institutionName})` : ""}. Last sync: {fmtDate(
            $bankState.lastSyncAt,
          )}.
        {:else if $bankState.connected}
          Connected. Waiting for first sync...
        {:else}
          Not connected.
        {/if}
      </p>

      {#if $bankError}
        <p class="mt-2 rounded-md border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
          {$bankError}
        </p>
      {/if}

      {#if $bankHasSyncedData}
        <div class="mt-4 overflow-x-auto">
          <table class="min-w-[680px] w-full border border-[#252a3a] rounded-md overflow-hidden">
            <thead class="bg-[#1c2030] border-b border-[#252a3a]">
              <tr>
                <th class="px-4 py-3 text-left text-xs uppercase tracking-wide text-slate-500">Account</th>
                <th class="px-4 py-3 text-left text-xs uppercase tracking-wide text-slate-500">Type</th>
                <th class="px-4 py-3 text-left text-xs uppercase tracking-wide text-slate-500">Mask</th>
                <th class="px-4 py-3 text-left text-xs uppercase tracking-wide text-slate-500">Available</th>
                <th class="px-4 py-3 text-left text-xs uppercase tracking-wide text-slate-500">Current</th>
              </tr>
            </thead>
            <tbody>
              {#each $bankState.accounts as account (account.accountId)}
                <tr class="border-b border-[#252a3a] last:border-none hover:bg-[#1c2030]">
                  <td class="px-4 py-3 text-sm text-slate-200">
                    <div class="font-medium">{account.name}</div>
                    {#if account.officialName}
                      <div class="text-xs text-slate-500">{account.officialName}</div>
                    {/if}
                  </td>
                  <td class="px-4 py-3 text-sm text-slate-400">{account.type} / {account.subtype ?? "-"}</td>
                  <td class="px-4 py-3 text-sm text-slate-400">{account.mask ?? "-"}</td>
                  <td class="px-4 py-3 text-sm text-slate-300">
                    {fmtCurrency(account.availableBalance, account.isoCurrencyCode)}
                  </td>
                  <td class="px-4 py-3 text-sm text-slate-200 font-semibold">
                    {fmtCurrency(account.currentBalance, account.isoCurrencyCode)}
                  </td>
                </tr>
              {/each}

              {#if $bankState.accounts.length === 0}
                <tr>
                  <td colspan="5" class="px-4 py-6 text-center text-sm text-slate-500">No accounts synced yet.</td>
                </tr>
              {/if}
            </tbody>
          </table>
        </div>
      {:else if $bankState.connected}
        <p class="mt-4 text-sm text-slate-500">
          Bank data will appear once sync completes. You can also click <strong>Sync Now</strong>.
        </p>
      {/if}
    </CardContent>
  </Card>
</div>
