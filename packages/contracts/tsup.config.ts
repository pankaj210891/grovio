import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/money/index.ts"],
  format: ["esm"],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
});
