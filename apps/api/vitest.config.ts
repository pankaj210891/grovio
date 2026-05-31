import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    env: {
      DATABASE_URL: "postgresql://test:test@localhost:5432/test",
      REDIS_URL: "redis://localhost:6379",
      JWT_SECRET: "test-jwt-secret-minimum-32-characters-for-vitest",
    },
  },
});
