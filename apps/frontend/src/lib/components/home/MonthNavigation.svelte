<svelte:options runes={true} />

<script lang="ts">
  import { ChevronLeft, ChevronRight } from "lucide-svelte";
  import { Button } from "$lib/components/ui/button";
  import { Card } from "../ui/card";
  import { page } from "$app/state";
  import { goto } from "$app/navigation";

  let {
    value = $bindable<string>(),
    onchange,
  }: {
    value?: string;
    onchange?: (month: string) => void;
  } = $props();

  // When used without props, fall back to reading from / writing to the URL.
  const effectiveValue = $derived.by(() => {
    if (value !== undefined) return value;
    const fromUrl = page.url.searchParams.get("month");
    if (fromUrl) return fromUrl;
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  });

  function parseMonthKey(key: string): { year: number; month: number } | null {
    const match = /^(\d{4})-(\d{2})$/.exec(key);
    if (!match) return null;
    return { year: parseInt(match[1], 10), month: parseInt(match[2], 10) };
  }

  function formatMonthKey(year: number, month: number): string {
    return `${year}-${String(month).padStart(2, "0")}`;
  }

  function formatMonthLabel(year: number, month: number): string {
    const date = new Date(year, month - 1, 1);
    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }

  const currentMonthObj = $derived.by(() => {
    return parseMonthKey(effectiveValue) ?? { year: new Date().getFullYear(), month: new Date().getMonth() + 1 };
  });

  function navigate(next: string) {
    if (onchange) {
      onchange(next);
    } else if (value !== undefined) {
      value = next;
    } else {
      const params = new URLSearchParams(page.url.searchParams);
      params.set("month", next);
      params.delete("page");
      goto(`?${params}`);
    }
  }

  const monthLabel = $derived(formatMonthLabel(currentMonthObj.year, currentMonthObj.month));

  function previousMonth() {
    let { year, month } = currentMonthObj;
    month -= 1;
    if (month === 0) {
      month = 12;
      year -= 1;
    }
    navigate(formatMonthKey(year, month));
  }

  function nextMonth() {
    let { year, month } = currentMonthObj;
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;

    // Don't allow going beyond current month
    if (year === currentYear && month === currentMonth) return;

    month += 1;
    if (month === 13) {
      month = 1;
      year += 1;
    }

    // Cap at current month
    if (year > currentYear || (year === currentYear && month > currentMonth)) {
      month = currentMonth;
      year = currentYear;
    }

    navigate(formatMonthKey(year, month));
  }

  const isAtCurrentMonth = $derived.by(() => {
    const today = new Date();
    return currentMonthObj.year === today.getFullYear() && currentMonthObj.month === today.getMonth() + 1;
  });

  const isAtYearStart = $derived.by(() => {
    // Allow going back multiple years (e.g., 24 months)
    const today = new Date();
    const minDate = new Date(today.getFullYear() - 2, 0, 1);
    return (
      currentMonthObj.year < minDate.getFullYear() ||
      (currentMonthObj.year === minDate.getFullYear() && currentMonthObj.month <= minDate.getMonth() + 1)
    );
  });
</script>

<Card class="flex items-center justify-between gap-3 grow w-full">
  <Button
    variant="ghost"
    size="sm"
    class="h-10 w-10 p-0"
    onclick={previousMonth}
    disabled={isAtYearStart}
    aria-label="Previous month"
  >
    <ChevronLeft class="w-4 h-4" />
  </Button>

  <div class="flex-1 text-center">
    <p class="text-sm font-semibold text-slate-100">{monthLabel}</p>
  </div>

  <Button
    variant="ghost"
    size="sm"
    class="h-10 w-10 p-0"
    onclick={nextMonth}
    disabled={isAtCurrentMonth}
    aria-label="Next month"
  >
    <ChevronRight class="w-4 h-4" />
  </Button>
</Card>
