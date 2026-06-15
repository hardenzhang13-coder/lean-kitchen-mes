import type { Config } from "jest";
import nextJest from "next/jest.js";

// 必须在任何测试模块加载前设置，否则 env-check 会抛异常或 process.exit(1)
process.env.SESSION_SECRET = "test-secret-for-jest-only-do-not-use-in-production";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";

const createJestConfig = nextJest({
  dir: "./",
});

const config: Config = {
  coverageProvider: "v8",
  testEnvironment: "node",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  testMatch: ["**/__tests__/**/*.test.ts", "**/__tests__/**/*.test.tsx"],
  transformIgnorePatterns: ["node_modules/(?!(jose)/)"],
  modulePathIgnorePatterns: ["<rootDir>/.next/"],
  collectCoverageFrom: [
    "app/**/*.{ts,tsx}",
    "lib/**/*.{ts,tsx}",
    "types/**/*.{ts,tsx}",
    "!**/*.d.ts",
    "!**/node_modules/**",
    "!**/__tests__/**",
    "!**/.next/**",
  ],
};

export default createJestConfig(config);
