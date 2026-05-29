import { z } from "zod";

/**
 * Schema for a granular error detail — used in validation errors to surface per-field failures.
 */
export const ApiErrorDetailSchema = z.object({
  /** Machine-readable error code (e.g., "REQUIRED", "TOO_SHORT") */
  code: z.string(),
  /** Human-readable error message */
  message: z.string(),
  /** Field path for field-level validation errors (e.g., "email", "address.zip") */
  field: z.string().optional(),
});

/** TypeScript type inferred from ApiErrorDetailSchema */
export type ApiErrorDetail = z.infer<typeof ApiErrorDetailSchema>;

/**
 * Schema for a standardised API error response envelope.
 * All API errors from the backend use this shape.
 */
export const ApiErrorSchema = z.object({
  success: z.literal(false),
  error: z.object({
    /** Machine-readable top-level error code (e.g., "NOT_FOUND", "VALIDATION_ERROR") */
    code: z.string(),
    /** Human-readable top-level error message */
    message: z.string(),
    /** Per-field or per-item detail errors (present for validation failures) */
    details: z.array(ApiErrorDetailSchema).optional(),
  }),
});

/** TypeScript type inferred from ApiErrorSchema */
export type ApiError = z.infer<typeof ApiErrorSchema>;

/**
 * Factory function returning a success envelope schema typed to a specific data schema.
 *
 * Usage:
 *   const ProductResponseSchema = ApiSuccessSchema(ProductSchema);
 *   type ProductResponse = z.infer<typeof ProductResponseSchema>;
 *
 * @param dataSchema - Zod schema for the response data payload
 */
export function ApiSuccessSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    success: z.literal(true),
    data: dataSchema,
  });
}

/** TypeScript type for a successful API response with typed data */
export type ApiSuccess<T> = { success: true; data: T };

/** Union of success and error envelopes — the full response type for an API route */
export type ApiResponse<T> = ApiSuccess<T> | ApiError;
