<svelte:options runes={true} />

<script lang="ts">
  import { onMount } from "svelte";
  import { Trash2 } from "lucide-svelte";
  import * as Dialog from "$lib/components/ui/dialog";
  import * as Drawer from "$lib/components/ui/drawer";
  import { Button } from "$lib/components/ui/button";

  let {
    open = $bindable(false),
    title = "Delete",
    description,
    onconfirm,
    loading = false,
  }: {
    open: boolean;
    title?: string;
    description?: string;
    onconfirm: () => Promise<void> | void;
    loading?: boolean;
  } = $props();

  let isMobile = $state(false);
  onMount(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    isMobile = mq.matches;
    const fn = (e: MediaQueryListEvent) => (isMobile = e.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  });

  async function handleConfirm() {
    await onconfirm();
    open = false;
  }
</script>

{#if isMobile}
  <Drawer.Root bind:open>
    <Drawer.Content>
      <Drawer.Header class="text-left">
        <div class="flex items-center gap-3">
          <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-500/10">
            <Trash2 class="h-5 w-5 text-rose-400" />
          </div>
          <div>
            <Drawer.Title>{title}</Drawer.Title>
            {#if description}
              <Drawer.Description>{description}</Drawer.Description>
            {:else}
              <Drawer.Description>This action cannot be undone.</Drawer.Description>
            {/if}
          </div>
        </div>
      </Drawer.Header>
      <Drawer.Footer>
        <Button variant="destructive" onclick={handleConfirm} disabled={loading}>
          {loading ? "Deleting…" : "Delete"}
        </Button>
        <Button variant="outline" onclick={() => (open = false)} disabled={loading}>Cancel</Button>
      </Drawer.Footer>
    </Drawer.Content>
  </Drawer.Root>
{:else}
  <Dialog.Root bind:open>
    <Dialog.Content class="max-w-sm" showCloseButton={false}>
      <div class="flex flex-col items-center gap-4 pt-2 text-center">
        <div class="flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/10">
          <Trash2 class="h-6 w-6 text-rose-400" />
        </div>

        <div class="space-y-1.5">
          <h2 class="text-base font-semibold text-slate-100">{title}</h2>
          {#if description}
            <p class="text-sm text-slate-400">{description}</p>
          {:else}
            <p class="text-sm text-slate-400">This action cannot be undone.</p>
          {/if}
        </div>

        <div class="flex w-full gap-3 pt-1">
          <Button variant="outline" class="flex-1" onclick={() => (open = false)} disabled={loading}>
            Cancel
          </Button>
          <Button variant="destructive" class="flex-1" onclick={handleConfirm} disabled={loading}>
            {loading ? "Deleting…" : "Delete"}
          </Button>
        </div>
      </div>
    </Dialog.Content>
  </Dialog.Root>
{/if}
