# GANGWON GO — Claude Code 공통 규칙

이 저장소에서 Claude Code 세션을 시작하면 이 파일이 자동으로 컨텍스트에 로드됩니다.
아래 규칙은 모든 팀(프론트/백엔드/QA)에게 공통으로 적용됩니다.

## 0. 먼저 읽을 문서

세션 시작 시 아래 문서를 이 순서로 읽으세요.

1. `docs/GANGWON_GO_PRD.md` — 기획·범위·마일스톤 (source of truth)
2. `docs/API_CONTRACT.md` — 프론트·백엔드 API 계약
3. `docs/ERD_SEQUENCE.md` — 데이터 모델 + 시퀀스 다이어그램 (참고용, PRD/API_CONTRACT에서 파생)
4. `docs/TEST_PLAN.md` — QA 테스트케이스, 리허설 스크립트
5. `docs/HANDOFF_LOG.md` — 팀 간 인수인계 로그 (가장 최근 항목까지 확인)

## 1. 문서 write 권한 (다중 리더, 단일 라이터 원칙 — PRD 10장)

**`docs/GANGWON_GO_PRD.md`와 `docs/API_CONTRACT.md`는 이 세션에서 절대 직접 수정하지 마세요.**
이 두 파일은 PM(승현)의 claude.ai Cowork 세션에서만 반영됩니다. GitHub 브랜치 보호 규칙(CODEOWNERS)으로도
막혀 있어서, 이 파일을 고친 PR은 PM 승인 없이 머지되지 않습니다.

- 변경이 필요하다고 판단되면, 대신 `docs/HANDOFF_LOG.md` 맨 아래에 아래 형식으로 **append**하세요:

  ```
  ## [YYYY-MM-DD HH:MM] 팀명
  - 변경: (무엇을 했는지)
  - 블로커: (막힌 것, 없으면 "없음")
  - 다음 액션: (다음 세션이 할 일)
  ```

- `docs/TEST_PLAN.md`는 QA팀이 직접 제안(수정)할 수 있습니다. 다만 최종 반영 여부는 PM이 확인합니다.
- 작업을 마칠 때마다 `docs/HANDOFF_LOG.md`에 기록하고 커밋·푸시하세요. 이게 PM 세션이 진행 상황을
  확인하는 유일한 통로입니다.

## 2. 담당 디렉토리 (PRD 7장)

| 담당 | 디렉토리 |
|---|---|
| 프론트 UI/UX | `/app`, `/components` |
| 백엔드 + 매니징 에이전트 + 데이터 동기화 | `/server`, `/agent`, `/scripts/sync` |
| QA | `/tests` |

세션 시작 시 "PRD 기준으로 진행해줘, 담당 디렉토리는 OO야"라고 명시적으로 프롬프트하세요.
담당 디렉토리 밖의 파일(특히 다른 팀 디렉토리와 `docs/GANGWON_GO_PRD.md`/`docs/API_CONTRACT.md`)은
건드리지 마세요.

## 3. git 규칙

- 팀별 feature 브랜치 사용: `feat/frontend-*`, `feat/backend-*`, `feat/qa-*`
- `docs/API_CONTRACT.md` 변경 제안은 반드시 해당 백엔드 PR과 같은 커밋에 묶을 것 (실제 반영은 PM이 함)
- 새 npm 패키지 추가 시 `package.json` diff를 커밋 메시지에 명시
- 환경변수는 `.env.example`에만 키 이름 기록, 실제 값은 절대 커밋하지 않음

## 4. 기타

- 이 PRD와 상충하는 구현은 임의로 진행하지 말고, `docs/HANDOFF_LOG.md`에 블로커로 남기고 PM 확인을 기다릴 것
- 저장소: https://github.com/csh0616/GangWon_Go.git (모노레포 1개, 여러 저장소로 쪼개지 않음)
