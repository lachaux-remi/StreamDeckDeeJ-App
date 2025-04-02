import eslint from "@eslint/js";
import tsParser from "@typescript-eslint/parser";
import prettierPlugin from "eslint-plugin-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefreshPlugin from "react-refresh";
import tsEslint from "typescript-eslint";

export default tsEslint.config(eslint.configs.recommended, ...tsEslint.configs.recommended, {
  files: ["**/*.ts", "**/*.json"],
  ignores: ["**/dist/**", "**/dist-electron/**", "**/release/**"],
  languageOptions: {
    parser: tsParser
  },
  plugins: {
    reactHooks: reactHooks,
    reactRefresh: reactRefreshPlugin,
    prettier: prettierPlugin
  },
  rules: {
    curly: "error",
    "no-console": [
      "error",
      {
        allow: ["warn", "error"]
      }
    ],
    "no-debugger": "error",
    "prettier/prettier": [
      "error",
      {
        endOfLine: "auto"
      }
    ]
  }
});
