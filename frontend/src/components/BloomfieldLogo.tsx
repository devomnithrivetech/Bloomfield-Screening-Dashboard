import { cn } from "@/lib/utils";

interface BloomfieldLogoProps {
  className?: string;
  height?: number;
}

export function BloomfieldLogo({ className, height = 28 }: BloomfieldLogoProps) {
  return (
    <img
      src="/bloomfield-logo.svg"
      alt="Bloomfield Capital"
      style={{ height }}
      className={cn("w-auto select-none", className)}
      draggable={false}
    />
  );
}
