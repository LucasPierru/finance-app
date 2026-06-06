<svelte:options runes={true} />

<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import { costs, investmentSettings, revenues } from "$lib/stores/finance.js";
  import {
    bankError,
    bankLoading,
    bankState,
    createPlaidLinkToken,
    disconnectBank,
    exchangePublicToken,
    syncBankData,
  } from "$lib/stores/banking";
  import { setTheme, theme, type ThemeName } from "$lib/stores/theme";
  import { Button } from "$lib/components/ui/button";
  import { LoaderCircle } from "lucide-svelte";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import { Select, SelectContent, SelectItem, SelectTrigger } from "$lib/components/ui/select";
  import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "$lib/components/ui/card";
  import { formatDate } from "$lib/utils/date";
  import { formatCurrency } from "$lib/utils/format";

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
    { value: "forest", label: "Forest", description: "Deep green palette inspired by nature." },
    { value: "sunset", label: "Sunset", description: "Warm amber and orange tones." },
    { value: "midnight", label: "Midnight", description: "Rich purple palette for late-night use." },
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
          await syncBankData();
        },
        onExit: (err) => {
          if (err && typeof err === "object") {
            const e = err as Record<string, unknown>;
            bankError.set(
              (typeof e.display_message === "string" && e.display_message) ||
              (typeof e.error_message === "string" && e.error_message) ||
              "Bank connection cancelled"
            );
          }
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

  function handlePlaidCountryChange(v: string) {
    selectedPlaidCountry = v;
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
      <Label class="mb-2 block">Active Theme</Label>
      <div class="w-full md:max-w-sm h-10">
        <Select type="single" value={$theme} onValueChange={(v) => setTheme(v as ThemeName)}>
          <SelectTrigger class="w-full h-full">
            {themeOptions.find((o) => o.value === $theme)?.label ?? $theme}
          </SelectTrigger>
          <SelectContent>
            {#each themeOptions as option}
              <SelectItem value={option.value} label={option.label} />
            {/each}
          </SelectContent>
        </Select>
      </div>
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
        <Label class="mb-2 block">Bank Country</Label>
        <div class="w-full md:max-w-sm h-10">
          <Select type="single" value={selectedPlaidCountry} onValueChange={handlePlaidCountryChange}>
            <SelectTrigger class="w-full h-full">
              {plaidCountryOptions.find((o) => o.value === selectedPlaidCountry)?.label ?? selectedPlaidCountry}
            </SelectTrigger>
            <SelectContent>
              {#each plaidCountryOptions as option}
                <SelectItem value={option.value} label={option.label} />
              {/each}
            </SelectContent>
          </Select>
        </div>
        <p class="mt-2 text-sm text-slate-500">This country is used when opening Plaid Link.</p>
      </div>

      <div class="mb-4">
        <Button onclick={connectWithPlaid} disabled={$bankLoading}>
          {#if $bankLoading}
            <LoaderCircle class="mr-2 h-4 w-4 animate-spin" />
            Connecting...
          {:else}
            {$bankState.connections.length > 0 ? "Add an account" : "Connect Bank"}
          {/if}
        </Button>
      </div>

      {#if $bankError}
        <p class="mt-2 rounded-md border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
          {$bankError}
        </p>
      {/if}

      {#if $bankState.connections.length === 0}
        <p class="mt-2 text-sm text-slate-500">
          {#if $bankLoading}
            Loading...
          {:else}
            Not connected.
          {/if}
        </p>
      {:else}
        {#each $bankState.connections as connection (connection.itemId)}
          <div class="mt-4 rounded-md border border-[#252a3a] p-4">
            <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p class="font-medium text-slate-200">{connection.institutionName ?? "Bank Account"}</p>
                <p class="text-xs text-slate-500">Last sync: {formatDate(connection.lastSyncAt)}</p>
              </div>
              <div class="flex gap-2">
                <Button size="sm" onclick={syncBankData} disabled={$bankLoading}>
                  {#if $bankLoading}
                    <LoaderCircle class="animate-spin" />
                    Syncing...
                  {:else}
                    Sync Now
                  {/if}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onclick={() => disconnectBank(connection.itemId)}
                  disabled={$bankLoading}>Disconnect</Button
                >
              </div>
            </div>

            {#if connection.accounts.length > 0}
              <div class="overflow-x-auto">
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
                    {#each connection.accounts as account (account.accountId)}
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
                          {formatCurrency(account.availableBalance, account.isoCurrencyCode)}
                        </td>
                        <td class="px-4 py-3 text-sm text-slate-200 font-semibold">
                          {formatCurrency(account.currentBalance, account.isoCurrencyCode)}
                        </td>
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
            {:else}
              <p class="text-sm text-slate-500">No accounts synced yet. Click <strong>Sync Now</strong>.</p>
            {/if}
          </div>
        {/each}
      {/if}
    </CardContent>
  </Card>
</div>
