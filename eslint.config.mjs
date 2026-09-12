import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // 프론트 담당 디렉토리(/app, /components) 밖은 다른 팀 소관 — 여기서 린트하지 않음 (CLAUDE.md 2장)
    "server/**",
    "agent/**",
    "scripts/**",
    "tests/**",
  ]),
]);

export default eslintConfig;
