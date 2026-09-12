"use client";

import { useTranslations } from "next-intl";
import { Chip } from "@/components/ui/Chip";
import type { Relationship } from "@/app/lib/types";

const OPTIONS: Relationship[] = ["couple", "family_with_kids", "friends", "solo", "group"];

export function RelationshipPicker({
  value,
  onChange,
}: {
  value: Relationship | null;
  onChange: (v: Relationship) => void;
}) {
  const t = useTranslations("relationships");

  return (
    <div className="flex flex-wrap gap-2">
      {OPTIONS.map((option) => (
        <Chip key={option} selected={value === option} onClick={() => onChange(option)}>
          {t(option)}
        </Chip>
      ))}
    </div>
  );
}
