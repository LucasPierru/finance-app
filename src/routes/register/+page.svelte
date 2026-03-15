<svelte:options runes={true} />

<script lang="ts">
  import { goto } from "$app/navigation";
  import { Button } from "$lib/components/ui/button";
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "$lib/components/ui/card";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import { authState, requestRegistrationCode, verifyRegistrationCode } from "$lib/stores/auth";

  let email = $state("");
  let name = $state("");
  let dateOfBirth = $state("");
  let phoneNumber = $state("");
  let code = $state("");
  let codeRequested = $state(false);

  async function handleRequestCode() {
    await requestRegistrationCode({
      email,
      name,
      dateOfBirth,
      phoneNumber,
    });
    codeRequested = true;
  }

  async function handleVerifyCode() {
    await verifyRegistrationCode(
      {
        email,
        name,
        dateOfBirth,
        phoneNumber,
      },
      code,
    );
    await goto("/");
  }
</script>

<div class="min-h-screen flex items-center justify-center px-4 bg-[#0d0f14] text-slate-100">
  <Card class="w-full max-w-lg">
    <CardHeader>
      <CardTitle>Create account</CardTitle>
      <CardDescription>Register with email + code and complete your profile.</CardDescription>
    </CardHeader>
    <CardContent class="space-y-4">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label for="register-name" class="mb-2 block">Full name</Label>
          <Input id="register-name" type="text" bind:value={name} placeholder="Jane Doe" />
        </div>
        <div>
          <Label for="register-dob" class="mb-2 block">Date of birth</Label>
          <Input id="register-dob" type="date" bind:value={dateOfBirth} />
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label for="register-email" class="mb-2 block">Email</Label>
          <Input id="register-email" type="email" bind:value={email} placeholder="you@example.com" />
        </div>
        <div>
          <Label for="register-phone" class="mb-2 block">Phone (optional)</Label>
          <Input id="register-phone" type="tel" bind:value={phoneNumber} placeholder="+1 555 123 4567" />
        </div>
      </div>

      {#if codeRequested}
        <div>
          <Label for="register-code" class="mb-2 block">Verification code</Label>
          <Input id="register-code" type="text" bind:value={code} placeholder="6-digit code" />
        </div>
      {/if}

      {#if $authState.error}
        <p class="rounded-md border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
          {$authState.error}
        </p>
      {/if}

      {#if !codeRequested}
        <Button
          class="w-full"
          onclick={handleRequestCode}
          disabled={!email || !name || !dateOfBirth || $authState.loading}
        >
          {$authState.loading ? "Sending..." : "Send registration code"}
        </Button>
      {:else}
        <Button class="w-full" onclick={handleVerifyCode} disabled={!code || $authState.loading}>
          {$authState.loading ? "Verifying..." : "Verify and create account"}
        </Button>
      {/if}

      <p class="text-sm text-slate-400">
        Already have an account?
        <a href="/login" class="text-slate-200 underline">Sign in</a>
      </p>
    </CardContent>
  </Card>
</div>
