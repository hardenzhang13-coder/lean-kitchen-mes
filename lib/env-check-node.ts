import { REQUIRED_ENV_VARS } from "./env-check";

export function checkRequiredEnvVars(): void {
  const missing: string[] = [];

  for (const [key, description] of Object.entries(REQUIRED_ENV_VARS)) {
    const value = process.env[key];
    if (!value || value.trim().length === 0) {
      missing.push(`${key} (${description})`);
    }
  }

  if (missing.length > 0) {
    console.error("【致命错误】以下环境变量未设置，应用拒绝启动：");
    for (const item of missing) {
      console.error(`  - ${item}`);
    }
    process.exit(1);
  }
}
