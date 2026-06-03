import { defineConfig } from "vitest/config";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const drizzleMock = path.join(__dirname, "__mocks__/drizzle-orm/index.js");

export default defineConfig({
  resolve: {
    alias: [
      { find: "drizzle-orm/pg-core", replacement: drizzleMock },
      { find: "drizzle-orm/node-postgres", replacement: drizzleMock },
      { find: "drizzle-orm", replacement: drizzleMock },
    ],
  },
  test: {
    environment: "node",
    env: {
      DATABASE_URL: "postgresql://test:test@localhost:5432/test",
      REDIS_URL: "redis://localhost:6379",
      JWT_SECRET: "test-jwt-secret-minimum-32-characters-for-vitest",
    },
  },
});
