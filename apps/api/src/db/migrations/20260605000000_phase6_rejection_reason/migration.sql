-- Phase 6: Add rejection_reason to return_requests (D-16, VEN-04)
-- When a vendor rejects a return request, the reason is required and stored here.
-- Null for non-rejected return requests.

ALTER TABLE "return_requests" ADD COLUMN IF NOT EXISTS "rejection_reason" text;
