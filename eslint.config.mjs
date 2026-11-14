import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // 过渡阶段：遗留代码中存在 any 与 effect 中 setState 问题，先全局降级为 warn
      "@typescript-eslint/no-explicit-any": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
    },
  },
  // 关键路径（API 路由与服务端工具）启用更严格规则，防止新增 any 与未使用变量
  {
    files: ["app/api/**/*.ts", "lib/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  // 交互视觉基线 v1：迁移期先告警，试点验收后改为 error。
  // 业务页面使用 AppDialogContent 的语义尺寸，并避免新增 9–11px 字号。
  {
    files: ["app/**/*.tsx"],
    ignores: ["app/components/ui/**/*.tsx", "app/ui-kit/**/*.tsx"],
    rules: {
      "no-restricted-syntax": [
        "warn",
        {
          selector:
            "JSXOpeningElement[name.name='DialogContent'] > JSXAttribute[name.name='className'] > Literal[value=/max-w-/]",
          message:
            "请使用 AppDialogContent 的 compact/form/wide/workbench 语义尺寸，不在业务页面声明弹窗像素宽度。",
        },
        {
          selector:
            "JSXAttribute[name.name='className'] > Literal[value=/(?:text-\\[9px\\]|text-\\[10px\\]|text-\\[11px\\])/]",
          message:
            "交互视觉基线 v1 要求正文与辅助信息不小于 12px，请使用 text-xs。",
        },
      ],
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "prisma/scripts/**",
    "prisma/migrations/**",
  ]),
]);

export default eslintConfig;
