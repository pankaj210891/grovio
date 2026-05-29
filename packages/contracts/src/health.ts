import { z } from "zod";

/**
 * Zod schema for a health-check API response.
 * Used by backend health route and consumers that assert service liveness.
 */
export const HealthCheckResponseSchema = z.object({
  /** Service health status */
  status: z.enum(["ok", "degraded", "error"]),
  /** Application version string (semver) */
  version: z.string(),
  /** ISO-8601 UTC timestamp of the health check */
  timestamp: z.string().datetime(),
});

/** TypeScript type inferred from HealthCheckResponseSchema */
export type HealthCheckResponse = z.infer<typeof HealthCheckResponseSchema>;
