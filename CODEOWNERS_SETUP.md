# CODEOWNERS + 브랜치 보호 설정 안내 (승현님이 GitHub 웹에서 직접 하는 부분)

이 파일 자체는 레포에 커밋하는 게 아니라, 설정 방법을 정리해둔 안내문입니다.
아래 두 단계만 하시면 "PRD.md/API_CONTRACT.md는 승현님 승인 없이 못 고친다"가 실제로 강제돼요.

## 1단계: `.github/CODEOWNERS` 파일을 레포에 추가

저장소 루트에 `.github/CODEOWNERS` 파일을 만들고 아래 내용을 넣으세요 (GitHub 아이디로 교체):

```
docs/GANGWON_GO_PRD.md   @csh0616
docs/API_CONTRACT.md     @csh0616
```

## 2단계: 브랜치 보호 규칙 설정 (GitHub 웹)

1. 저장소 → Settings → Branches
2. "Add branch protection rule" → Branch name pattern: `main` (또는 기본 브랜치명)
3. 아래 옵션 체크:
   - "Require a pull request before merging"
   - "Require review from Code Owners"
4. Save

이렇게 해두면, `docs/GANGWON_GO_PRD.md`나 `docs/API_CONTRACT.md`를 건드리는 PR은 승현님(@csh0616)의
승인 없이는 `main`에 머지가 안 돼요. 다른 파일(코드, TEST_PLAN.md, HANDOFF_LOG.md 등)은 이 규칙과
무관하게 평소처럼 자유롭게 머지됩니다.
