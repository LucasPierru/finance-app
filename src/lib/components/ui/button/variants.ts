import { cva, type VariantProps } from "class-variance-authority";

export const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5b8dee] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d0f14] disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-[#5b8dee] text-white hover:bg-[#4a7ce0]",
        secondary: "bg-[#1c2030] text-slate-100 hover:bg-[#2a3044]",
        ghost: "text-slate-300 hover:bg-[#1c2030] hover:text-slate-100",
        outline: "border border-[#252a3a] text-slate-200 hover:bg-[#1c2030]"
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-11 px-6",
        icon: "h-10 w-10"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);

export type ButtonVariant = VariantProps<typeof buttonVariants>["variant"];
export type ButtonSize = VariantProps<typeof buttonVariants>["size"];