import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/money/index.ts",
    // Phase 6 sub-path exports (admin domain)
    "src/admin/auth.ts",
    "src/admin/vendors.ts",
    "src/admin/commission-rules.ts",
    "src/admin/payouts.ts",
    "src/admin/settings.ts",
    "src/admin/audit.ts",
    "src/admin/analytics.ts",
    "src/admin/cms.ts",
    // Phase 6 sub-path exports (vendor domain)
    "src/vendor/profile.ts",
    "src/vendor/staff.ts",
    "src/vendor/earnings.ts",
    "src/vendor/dashboard.ts",
  ],
  format: ["esm"],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
});
