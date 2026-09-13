"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * 좌측 리스트 스크롤 위치로 selectedDayIndex를 자동 갱신하고(스크롤 스파이),
 * 역방향(화살표/헤더 클릭)으로 특정 DAY 섹션까지 프로그래밍 스크롤하는 훅.
 *
 * 프로그래밍 스크롤 중에는 스크롤 스파이가 다시 selectedDayIndex를 건드리지 않도록
 * suppressedRef로 막는다 — 안 그러면 "스크롤→선택→스크롤" 이 서로를 밀어내며 떨린다.
 * scrollend 미지원 브라우저(사파리)를 위해 타이머 폴백으로 반드시 해제한다.
 */
export function useDayScrollSpy({
  containerRef,
  dayRefs,
  dayCount,
  enabled,
  onDayChange,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>;
  dayRefs: React.RefObject<(HTMLDivElement | null)[]>;
  dayCount: number;
  enabled: boolean;
  onDayChange: (index: number) => void;
}) {
  const suppressedRef = useRef(false);
  const releaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const root = containerRef.current;
    if (!root) return;

    // 마지막 DAY가 짧으면 상단 기준선에 못 걸려 옵저버가 마지막 DAY를 절대 고르지 못할 수
    // 있다 — 바닥에 닿으면 마지막 DAY로 보정한다. 이 보정과 옵저버 콜백은 같은 스크롤에
    // 대해 서로 다른 타이밍(스크롤 이벤트 vs 옵저버 콜백 큐)으로 각각 비동기 호출되므로,
    // 어느 쪽이 나중에 실행되든 항상 같은 결론에 수렴하도록 옵저버 콜백에도 바닥 체크를
    // 동일하게 넣는다 — 안 그러면 옵저버가 보정 결과를 다시 덮어써버릴 수 있다.
    function isAtBottom() {
      return root
        ? root.scrollTop + root.clientHeight >= root.scrollHeight - 2
        : false;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (suppressedRef.current) return;
        if (isAtBottom()) {
          onDayChange(dayCount - 1);
          return;
        }
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length === 0) return;
        // 여러 DAY가 동시에 기준선에 걸리면 문서 순서상 가장 위(앞)의 것을 택한다
        const topMost = visible.reduce((a, b) =>
          a.boundingClientRect.top <= b.boundingClientRect.top ? a : b
        );
        const idx = dayRefs.current.findIndex((el) => el === topMost.target);
        if (idx >= 0) onDayChange(idx);
      },
      { root, rootMargin: "0px 0px -66% 0px", threshold: 0 }
    );

    const els = dayRefs.current.filter((el): el is HTMLDivElement => el !== null);
    els.forEach((el) => observer.observe(el));

    function handleScroll() {
      if (suppressedRef.current) return;
      if (isAtBottom()) onDayChange(dayCount - 1);
    }
    root.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      observer.disconnect();
      root.removeEventListener("scroll", handleScroll);
    };
  }, [containerRef, dayRefs, dayCount, enabled, onDayChange]);

  const scrollToDay = useCallback(
    (index: number) => {
      const root = containerRef.current;
      const target = dayRefs.current[index];
      if (!root || !target) return;

      suppressedRef.current = true;
      if (releaseTimerRef.current) clearTimeout(releaseTimerRef.current);

      function release() {
        suppressedRef.current = false;
        if (releaseTimerRef.current) {
          clearTimeout(releaseTimerRef.current);
          releaseTimerRef.current = null;
        }
        root?.removeEventListener("scrollend", release);
      }

      root.addEventListener("scrollend", release, { once: true });
      // 사파리는 scrollend 미지원 — 애니메이션이 끝날 시간을 넉넉히 주고 타이머로 폴백 해제
      releaseTimerRef.current = setTimeout(release, 700);

      target.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    [containerRef, dayRefs]
  );

  useEffect(() => {
    return () => {
      if (releaseTimerRef.current) clearTimeout(releaseTimerRef.current);
    };
  }, []);

  return { scrollToDay };
}
