# GANGWON GO — ERD & 시퀀스 다이어그램

> PRD(`GANGWON_GO_PRD.md`)와 `API_CONTRACT.md`를 근거로 백엔드팀이 바로 참고할 수 있게 정리한
> 다이어그램입니다. 필드명·엔드포인트는 두 문서의 최신 확정 내용과 100% 일치합니다. 실제 구현 중
> 스키마가 바뀌면 **이 문서가 아니라 PRD 4장/API_CONTRACT.md를 먼저 갱신**하고, 이 문서는 그 뒤에
> 맞춰 갱신하세요(다이어그램은 파생 문서 — source of truth 아님).

---

## 1. ERD (데이터 모델, PRD 4장 기준)

```mermaid
erDiagram
    USERS ||--o{ ITINERARIES : "user_id"
    ITINERARIES ||--o{ ALERTS : "itinerary_id"
    POIS ||--o{ ALERTS : "previous_poi_id"
    POIS ||--o{ ALERTS : "proposed_poi_id"

    USERS {
        uuid id PK "Supabase auth.uid() 그대로 사용"
        timestamp created_at
        string preferred_lang
        string auth_provider "google 고정 (3.9절)"
    }

    ITINERARIES {
        uuid id PK
        uuid user_id FK
        string_array region_codes "항상 1개 값만 (3.5절 - 시군 단일선택)"
        date start_date
        date end_date
        int companions
        string relationship "enum: couple/family_with_kids/friends/solo/group"
        string status "draft/active/completed/cancelled"
        jsonb itinerary_json "코스 전체 (스탑 배열, 내레이션)"
        jsonb preference_weights "7개 카테고리 가중치, LLM 결과 저장"
    }

    POIS {
        uuid id PK
        string region_code
        string name
        string category
        float lat
        float lng
        string_array tags "7개 카테고리 마스터 목록 키만 사용"
        date event_start_date "festival_event만 값 있음, 나머진 NULL"
        date event_end_date "festival_event만 값 있음, 나머진 NULL"
        timestamp synced_at
        boolean adult_only "신규(1주차) - family_with_kids 필터용, tags[]로 표현 불가해 별도 컬럼"
    }

    CARE_FACILITIES {
        uuid id PK
        string region_code
        string name
        string category "hospital/pharmacy 등"
        string phone "실제 서비스키 동기화 전까지 119 외 NULL"
        float lat
        float lng
    }

    ALERTS {
        uuid id PK
        uuid itinerary_id FK
        string trigger_type "weather/traffic/festival"
        string condition "rain 등"
        timestamp triggered_at
        string status "proposed/confirmed/dismissed"
        int day
        uuid previous_poi_id FK
        uuid proposed_poi_id FK
        timestamp responded_at "NULL = 미응답(3분 타임아웃 포함), 값 있음 = 사용자가 실제 응답"
    }
```

**`itinerary_json` 스냅샷 정책 (확정)**: `itineraries.itinerary_json` 안에는 스탑마다 `poi_id`가
들어있지만, 이건 DB 레벨 FK가 아니라 JSONB 안의 값입니다(스키마 검증으로 강제 안 됨). **코스가
완성된 시점의 스냅샷을 그대로 유지하며, 표시할 때 `pois`와 다시 조인해서 최신값으로 갱신하지
않습니다.** 이유:

- 데모 여행 기간이 2~4일로 짧아 그 사이 `pois`의 이름/카테고리/좌표가 실제로 바뀔 확률이 낮음
- `pois`의 필드 자체가 "지금 영업 중인지" 같은 실시간성 정보가 아니라 애초에 자주 안 바뀌는 값들임
- 매니징/수동 편집(3.5절)이 어차피 "결정 순간엔 최신 `pois`로 스코어링 → 결과를 다시 스냅샷으로
  저장"하는 구조라, 코스가 바뀔 때마다 자연스럽게 최신 정보로 갱신됨 — 매번 조인할 필요가 없음
- 표시 시점 조인 방식은 `pois`에서 그 POI가 삭제/변경됐을 때 저장된 코스 화면이 깨지는 새로운
  실패 케이스를 만들 뿐, 3주 일정에 득보다 실이 큼

여행 케어 안내(`GET /api/care`)는 애초에 저장하지 않고 매번 새로 조회하므로 이 스냅샷 문제 자체가
없습니다 — 스냅샷 정책은 순수하게 `itinerary_json`(코스)에만 해당합니다. 나중에 정말 심각한 정정
(오타, 실제 폐업 등)이 필요한 극단적 경우는 자동 갱신 로직 없이 관리자가 해당 코스만 수동으로
재생성하는 걸로 충분합니다 — 이걸 위한 자동화는 만들지 않습니다.

---

## 2. 시퀀스 다이어그램

### 2.1 코스 생성 (게스트, 로그인 불필요) — `POST /api/itineraries/generate`

```mermaid
sequenceDiagram
    actor U as 사용자
    participant FE as 프론트
    participant BE as 백엔드
    participant LLM as Claude API
    participant DB as Supabase (pois)

    U->>FE: 시군 선택 + 날짜/인원/관계(필수) + 자유텍스트(선택) 입력
    FE->>BE: POST /generate {region_codes:[1개], start_date, end_date,<br/>companions, relationship, free_text, lang}

    alt free_text 있음
        BE->>LLM: free_text + 카테고리 마스터 목록(7키) 스키마 전달 (tool use)
        alt LLM 성공
            LLM-->>BE: {weights(7키), activity_level}
        else LLM 실패/스키마 검증 실패 (1회 재시도 후에도 실패)
            LLM-->>BE: 실패
            BE->>BE: weights 전부 0, activity_level="medium"으로 대체 (에러 아님, 로그만 기록)
        end
    else free_text 없음
        BE->>BE: weights 전부 0, activity_level="medium"
    end

    BE->>DB: region_code + relationship 필터로 pois 조회
    alt 해당 region_code에 pois 0건
        DB-->>BE: 0건
        BE-->>FE: 400 {error:{code:"NO_POI_DATA"}}
        FE-->>U: "이 지역은 아직 준비 중입니다" 안내 + 다른 지역 선택 유도
    else pois 있음
        DB-->>BE: pois 목록
        BE->>BE: tags[]-weights 매칭 스코어링<br/>festival_event는 event_start/end_date 겹치는 것만 우선<br/>activity_level로 하루 스탑 수 결정(low 2-3/medium 3-4/high 4-5)<br/>일자별 클러스터링 → 2-opt(Haversine 거리) 순서 최적화
        opt 내레이션 (선택)
            BE->>LLM: 완성된 코스 → en/zh 내레이션 요청 (구조화 출력)
            LLM-->>BE: narration (실패 시 null, 코스 자체는 실패 아님)
        end
        BE-->>FE: 200 {itinerary_json, preference_weights, generated_at}
        FE-->>U: 코스 표시 (3초 이내, 저장 전까지는 클라이언트 메모리에만 존재)
    end
```

참고: PRD 3.5절, API_CONTRACT.md §1

---

### 2.2 게스트 → 로그인 저장 (재시도 흐름 포함) — `POST /api/itineraries`

```mermaid
sequenceDiagram
    actor U as 사용자
    participant FE as 프론트
    participant Auth as Supabase Auth (Google OAuth 팝업)
    participant BE as 백엔드
    participant DB as Supabase (users/itineraries)

    U->>FE: "코스 저장" 클릭 (게스트 상태, 코스는 클라이언트 메모리에만 존재)
    FE->>Auth: Google 로그인 팝업 오픈

    alt 로그인 성공
        Auth-->>FE: 세션 토큰
        FE->>BE: POST /itineraries {itinerary_json, preference_weights,<br/>region_codes, start_date, end_date, companions, relationship}<br/>Authorization: Bearer <token>
        BE->>BE: 토큰 검증 → auth.uid() 추출
        BE->>DB: public.users upsert (없으면 생성, 있으면 유지)
        BE->>DB: itineraries insert (status: active)
        DB-->>BE: 생성 완료
        BE-->>FE: 201 {itinerary_id, status:"active", user_id}
        FE-->>U: "저장됨" 표시 (3초 이내) — 이 시점부터 매니징 감시 대상
    else 로그인 실패/취소/거부
        Auth-->>FE: 실패
        FE-->>U: 에러 메시지 + "다시 시도" 버튼 표시 (자동 재시도 아님)<br/>게스트 코스 데이터는 화면에서 사라지지 않음
        U->>FE: "다시 시도" 클릭
        FE->>Auth: Google 로그인 팝업 재오픈 (위 흐름 반복)
    end
```

참고: PRD 3.9절, API_CONTRACT.md §2

---

### 2.3 실시간 매니징 — 2단계 확인 흐름 (조건 감시 cron + 데모 강제 트리거, 3분 타임아웃 포함)

```mermaid
sequenceDiagram
    actor U as 사용자
    participant FE as 프론트
    participant Cron as 조건 감시 에이전트 (5~10분 주기)
    participant Ext as 기상청/카카오모빌리티 API
    participant BE as 백엔드
    participant DB as Supabase (alerts/itineraries)
    participant RT as Supabase Realtime

    par 실제 운영 경로 (자동)
        Cron->>DB: status='active' AND 오늘이 여행기간 내인 itineraries 스캔
        Cron->>Ext: 날씨 확인 / 인접 스탑 구간 이동시간(duration) 조회
        Cron->>Cron: 대상 스탑 확정<br/>(rain: 첫 야외 스탑 / traffic: 구간 1시간 초과 시 그 뒤쪽 스탑)
    and 데모 전용 경로 (강제 트리거 버튼)
        FE->>BE: POST /alerts/trigger {itinerary_id, trigger_type, condition,<br/>day, target_poi_id} — 리허설마다 동일 스탑 겨냥, 결정론적
    end

    BE->>DB: 같은 itinerary_id+day+previous_poi_id로 status='proposed'인 row 있는지 확인
    alt 이미 존재 (중복)
        DB-->>BE: 기존 row 있음
        BE-->>FE: 기존 alert_id 반환 (재-push 없음)
    else 신규
        BE->>BE: preference_weights에 상황별 조정 적용(rain: 야외 카테고리 0)<br/>또는 traffic: 이전 스탑 기준 15분 이내 후보로 재선정<br/>→ 상위 1개 후보 계산
        BE->>DB: alerts insert (status: proposed, previous_poi_id, proposed_poi_id)
        DB-->>RT: insert 이벤트
        RT-->>FE: push {alert_id, message, proposed_stop, status:"proposed"}
        FE-->>U: 확인 모달 표시 ("비가 옵니다, [스탑] 대신 [대체]로 변경할까요?", 3초 이내)

        alt 사용자 Yes
            U->>FE: Yes 클릭
            FE->>BE: POST /alerts/:id/respond {response:"yes"}
            BE->>DB: itinerary_json에 실제 반영 + 해당 날짜만 2-opt 재정렬<br/>alerts.status → confirmed, responded_at 기록
            BE-->>FE: 200 {status:"confirmed", updated_stop}
            FE-->>U: 교체된 스탑만 강조 반영 (3초 이내, 전체 재렌더링 아님)
        else 사용자 No
            U->>FE: No 클릭
            FE->>BE: POST /alerts/:id/respond {response:"no"}
            BE->>DB: alerts.status → dismissed, responded_at 기록
            BE-->>FE: 200 {status:"dismissed"}
            FE-->>U: itinerary_json 변경 없음
        else 3분 무응답
            Cron->>DB: status='proposed' AND 생성된 지 3분 초과인 alerts 자동 dismissed 처리<br/>(responded_at은 NULL로 남김 — 실제 No와 구분)
            FE-->>U: 모달 자동 닫힘 (별도 API 호출 불필요)
        end
    end
```

참고: PRD 3.5절/3.6절/11.5절, API_CONTRACT.md §3

---

### 2.4 코스 부분 수정 (사용자 직접) — `POST /api/itineraries/regenerate-stop` + `PATCH /api/itineraries/:id`

```mermaid
sequenceDiagram
    actor U as 사용자
    participant FE as 프론트
    participant BE as 백엔드
    participant LLM as Claude API
    participant DB as Supabase (pois/itineraries)

    U->>FE: 저장된 코스에서 스탑 선택 → "이 장소 바꾸기" 클릭
    U->>FE: (선택) 텍스트박스에 원하는 조건 입력, 또는 비우고 "다시 추천"

    FE->>BE: POST /regenerate-stop {itinerary_id, day, target_poi_id,<br/>reason:"user_request", free_text}

    alt free_text 있음
        BE->>LLM: free_text만 2.1과 동일 스키마로 파싱 (이 스탑 전용 가중치)
        LLM-->>BE: weights(7키), activity_level
    else free_text 없음 ("다시 추천")
        BE->>DB: itineraries.preference_weights 조회 (원래 코스 생성 때 값 재사용)
    end

    BE->>DB: 같은 날짜·같은 시군, 이미 쓰인 POI 제외 + relationship 필터 재적용
    BE->>BE: 위 가중치로 재스코어링 → 상위 최대 3개 후보 추출
    BE-->>FE: 200 {candidates: [...]} (itinerary_json 아직 미반영)
    FE-->>U: 후보 최대 3개 제시 (3초 이내)

    U->>FE: 후보 중 하나 선택
    FE->>BE: PATCH /itineraries/:id {day, new_poi_id}
    BE->>DB: itinerary_json 반영 + 해당 날짜만 2-opt 재정렬
    DB-->>BE: 갱신 완료
    BE-->>FE: 200 {itinerary_json(전체), day_reordered:true}
    FE-->>U: 확정 반영 (3초 이내)
```

참고: PRD 2.1절/3.5절, API_CONTRACT.md §3

---

## 3. 이 문서를 만들며 새로 발견해 확정한 것

- §1의 "itinerary_json 스냅샷 vs pois 최신값" 문제는 이 문서를 만들다가 새로 눈에 띄어, 스냅샷
  유지(표시 시점 재조인 안 함)로 확정했습니다 — 근거는 §1 하단 참고.
