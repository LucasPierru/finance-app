<svelte:options runes={true} />

<script lang="ts">
  import { goto } from "$app/navigation";
  import { Button } from "$lib/components/ui/button";
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "$lib/components/ui/card";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import { authState, requestLoginCode, verifyLoginCode } from "$lib/stores/auth";

  let email = $state("");
  let code = $state("");
  let codeRequested = $state(false);

  async function handleRequestCode() {
    await requestLoginCode(email);
    codeRequested = true;
  }

  async function handleVerifyCode() {
    await verifyLoginCode(email, code);
    await goto("/");
  }
</script>

<div class="min-h-screen flex items-center justify-center px-4 bg-[#0d0f14] text-slate-100">
  <Card class="w-full max-w-md">
    <CardHeader>
      <CardTitle>Log in</CardTitle>
      <CardDescription>Use your email and verification code to sign in.</CardDescription>
    </CardHeader>
    <CardContent class="space-y-4">
      <div>
        <Label for="login-email" class="mb-2 block">Email</Label>
        <Input id="login-email" type="email" bind:value={email} placeholder="you@example.com" />
      </div>

      {#if codeRequested}
        <div>
          <Label for="login-code" class="mb-2 block">Verification code</Label>
          <Input id="login-code" type="text" bind:value={code} placeholder="6-digit code" />
        </div>
      {/if}

      {#if $authState.error}
        <p class="rounded-md border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
          {$authState.error}
        </p>
      {/if}

      <div class="flex gap-2">
        {#if !codeRequested}
          <Button class="w-full" onclick={handleRequestCode} disabled={!email || $authState.loading}>
            {$authState.loading ? "Sending..." : "Send code"}
          </Button>
        {:else}
          <Button class="w-full" onclick={handleVerifyCode} disabled={!code || $authState.loading}>
            {$authState.loading ? "Verifying..." : "Verify and sign in"}
          </Button>
        {/if}
      </div>

      <p class="text-sm text-slate-400">
        No account yet?
        <a href="/register" class="text-slate-200 underline">Create one</a>
      </p>
    </CardContent>
  </Card>
</div>
