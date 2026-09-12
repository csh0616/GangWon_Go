import {
  Mountain,
  Waves,
  Landmark,
  UtensilsCrossed,
  PartyPopper,
  ShoppingBag,
  Activity,
  type LucideIcon,
} from "lucide-react";
import type { CategoryKey } from "@/app/lib/types";
import { cn } from "@/app/lib/cn";

const ICONS: Record<CategoryKey, LucideIcon> = {
  nature_hiking: Mountain,
  onsen_wellness: Waves,
  culture_history: Landmark,
  food_local: UtensilsCrossed,
  festival_event: PartyPopper,
  shopping: ShoppingBag,
  leisure_sports: Activity,
};

export function CategoryIcon({
  category,
  className,
  size = 21,
}: {
  category: CategoryKey;
  className?: string;
  size?: number;
}) {
  const Icon = ICONS[category];
  return <Icon size={size} strokeWidth={1.6} className={cn("text-ink-soft", className)} />;
}
