import { cn } from "@/lib/utils";

// Class names for the Soft Blob auth screens. Kept out of auth-ui.tsx
// (a client module) so server pages like /welcome can use them too.

const pill =
  "flex h-[52px] w-full items-center justify-center rounded-full font-heading text-[15px] font-semibold transition-colors disabled:opacity-50";

export const authButton = {
  dark: cn(pill, "bg-primary text-primary-foreground hover:bg-primary-hover"),
  lilac: cn(pill, "bg-[#b9b8f2] text-[#17171c] hover:bg-[#c7c6f5]"),
  outline: cn(pill, "border-[1.5px] border-foreground text-foreground hover:bg-muted"),
};

export const authLink = "font-semibold text-foreground hover:underline";
