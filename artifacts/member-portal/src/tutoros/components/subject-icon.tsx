import { cn } from "@/lib/utils";
import {
  Atom,
  BookOpen,
  Calculator,
  Code2,
  Landmark,
  Languages,
  Sigma,
} from "lucide-react";
import type { Subject } from "../data/curriculum";

const iconMap = {
  math: Sigma,
  science: Atom,
  english: BookOpen,
  history: Landmark,
  computing: Code2,
  "test-prep": Calculator,
  languages: Languages,
} as const;

export function SubjectIcon({
  subject,
  className,
  size = "md",
}: {
  subject: Pick<Subject, "icon" | "color">;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const Icon = iconMap[subject.icon];
  const sizeClass =
    size === "sm" ? "h-9 w-9 rounded-lg" : size === "lg" ? "h-14 w-14 rounded-2xl" : "h-11 w-11 rounded-xl";
  const iconSize = size === "sm" ? "h-4 w-4" : size === "lg" ? "h-7 w-7" : "h-5 w-5";

  return (
    <div
      className={cn(
        "inline-flex shrink-0 items-center justify-center text-white shadow-sm",
        sizeClass,
        className,
      )}
      style={{ backgroundColor: subject.color }}
      aria-hidden
    >
      <Icon className={iconSize} strokeWidth={2.25} />
    </div>
  );
}
