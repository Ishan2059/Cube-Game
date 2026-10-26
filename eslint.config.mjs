import { FlatCompat } from "@eslint/eslintrc";
import { fileURLToPath } from "node:url";
import path from "node:path";

const compat = new FlatCompat({ baseDirectory: path.dirname(fileURLToPath(import.meta.url)) });
const config = [
  { ignores: [".next/**", "node_modules/**", "legacy/**", "docs/**", ".qa/**", "test-results/**", "next-env.d.ts"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  { files: ["**/*.cjs"], rules: { "@typescript-eslint/no-require-imports": "off" } },
];
export default config;
