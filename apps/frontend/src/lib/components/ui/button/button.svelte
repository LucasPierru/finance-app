<svelte:options runes={true} />

<script lang="ts">
  import type { HTMLButtonAttributes } from "svelte/elements";
  import { cn } from "$lib/utils";
  import { buttonVariants, type ButtonVariant, type ButtonSize } from "./variants";

  let {
    class: className = "",
    variant = "default",
    size = "default",
    type = "button",
    children,
    ...restProps
  }: HTMLButtonAttributes & {
    class?: string;
    variant?: ButtonVariant;
    size?: ButtonSize;
  } = $props();
</script>

<button {type} class={cn(buttonVariants({ variant, size }), className)} {...restProps}>
  {@render children?.()}
</button>
