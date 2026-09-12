"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { PhoneCall, MapPin } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Chip } from "@/components/ui/Chip";
import { CareFacilityCard } from "@/components/care/CareFacilityCard";
import { CarePermissionModal } from "@/components/care/CarePermissionModal";
import { getCare } from "@/app/lib/api";
import { haversineKm } from "@/app/lib/geo";
import { OPEN_REGION_CODES } from "@/app/lib/regions";
import type { CareFacility, OpenRegionCode } from "@/app/lib/types";

type LocationState = "unknown" | "denied" | { lat: number; lng: number };

export default function CarePage() {
  const t = useTranslations("care");
  const tr = useTranslations("regions");
  const tcat = useTranslations("care.categories");

  const [region, setRegion] = useState<OpenRegionCode>("pyeongchang");
  const [facilities, setFacilities] = useState<CareFacility[] | null>(null);
  const [location, setLocation] = useState<LocationState>("unknown");
  const [permissionOpen, setPermissionOpen] = useState(false);

  useEffect(() => {
    getCare(region).then((res) => setFacilities(res.data ?? []));
  }, [region]);

  function requestLocation() {
    setPermissionOpen(false);
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocation("denied");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setLocation("denied"),
      { timeout: 8000 }
    );
  }

  const hasLocation = typeof location === "object";
  const sorted = [...(facilities ?? [])].sort((a, b) => {
    if (!hasLocation) return 0;
    return (
      haversineKm(location.lat, location.lng, a.lat, a.lng) -
      haversineKm(location.lat, location.lng, b.lat, b.lng)
    );
  });

  return (
    <div className="flex min-h-dvh flex-col">
      <Header showCareLink={false} />
      <div className="mx-auto w-full max-w-2xl flex-grow px-5 pb-24 md:px-0">
        <h1 className="pt-2 text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          {hasLocation ? t("subtitleWithLocation") : t("subtitleNoLocation", { region: tr(region) })}
        </p>
        <p className="mt-1 text-xs text-faint">{t("loginNote")}</p>

        <div className="mt-4 flex flex-wrap gap-2">
          {OPEN_REGION_CODES.map((code) => (
            <Chip key={code} selected={region === code} onClick={() => setRegion(code)}>
              {tr(code)}
            </Chip>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between rounded-2xl bg-bg-subtler px-4 py-3">
          <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-soft">
            <MapPin size={14} className="text-muted" strokeWidth={1.6} />
            {hasLocation ? t("sortNear") : t("noLocationNote", { region: tr(region) })}
          </span>
          {!hasLocation && (
            <button
              type="button"
              onClick={() => setPermissionOpen(true)}
              className="shrink-0 rounded-full bg-brand px-3.5 py-2 text-[12px] font-bold text-white"
            >
              {t("allowLocation")}
            </button>
          )}
        </div>

        <div className="mt-5">
          <a
            href="tel:119"
            className="flex items-center gap-3 rounded-2xl bg-danger-bg px-4 py-3.5"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-danger text-white">
              <PhoneCall size={16} strokeWidth={1.8} />
            </span>
            <span className="flex-grow">
              <p className="text-[14.5px] font-bold text-danger">{t("emergencyTitle")}</p>
              <p className="text-[12px] font-medium text-danger">{t("emergencySubtitle")}</p>
            </span>
            <span className="shrink-0 text-[11.5px] font-bold text-danger">{t("nationwide")}</span>
          </a>
        </div>

        <div className="divide-y divide-bg-subtle">
          {sorted.map((facility, i) => (
            <CareFacilityCard
              key={`${facility.name_ko}-${i}`}
              facility={facility}
              distanceKm={hasLocation ? haversineKm(location.lat, location.lng, facility.lat, facility.lng) : null}
              categoryLabel={tcat(facility.category)}
            />
          ))}
        </div>

        <p className="mt-5 text-[11.5px] leading-relaxed text-faint">{t("nameFootnote")}</p>
      </div>

      <a
        href="tel:119"
        className="fixed inset-x-5 bottom-5 z-20 flex h-14 items-center justify-center gap-2 rounded-2xl bg-danger text-[15px] font-bold text-white shadow-lg md:inset-x-auto md:right-8 md:w-64"
      >
        <PhoneCall size={16} strokeWidth={1.8} />
        {t("sos")}
      </a>

      <CarePermissionModal
        open={permissionOpen}
        onClose={() => setPermissionOpen(false)}
        onAllow={requestLocation}
      />
    </div>
  );
}
