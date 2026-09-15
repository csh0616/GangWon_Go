import {
  Mountain,
  Waves,
  Landmark,
  UtensilsCrossed,
  PartyPopper,
  ShoppingBag,
  Activity,
  MapPin,
  type LucideIcon,
} from "lucide-react";
import type { CategoryKey } from "@/app/lib/types";
import { isKnownCategory } from "@/app/lib/categoryLabels";
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
  // 마스터 키 7개만 온다는 계약이 깨진 전례가 있어(API_CONTRACT.md §1 상자) string으로 받고,
  // 모르는 값은 아이콘을 비우는 대신 일반 위치 표시 아이콘으로 대체한다 — undefined 컴포넌트를
  // 그대로 렌더링하면("Element type is invalid") 화면 전체가 죽는다.
  category: string;
  className?: string;
  size?: number;
}) {
  const Icon = isKnownCategory(category) ? ICONS[category] : MapPin;
  return <Icon size={size} strokeWidth={1.6} className={cn("text-ink-soft", className)} />;
}
