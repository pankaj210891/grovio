/**
 * Onboarding Checklist — expandable sidebar widget (Plan 11-03, T9).
 *
 * 5 steps:
 *   1. Complete store profile
 *   2. Add first product
 *   3. Configure payout info
 *   4. Publish store
 *   5. Complete identity verification (if required by admin)
 *
 * Renders in Sidebar footer. Hidden once all 5 steps complete.
 * Collapses to a compact progress bar when sidebarCollapsed.
 *
 * Backend: GET /vendor/onboarding-status → { steps: OnboardingStep[] }
 *          PATCH /vendor/onboarding/request-approval → triggers admin review
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { NavLink } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/apiClient.js';
import { useUiStore } from '../../stores/uiStore.js';

// ── Types ─────────────────────────────────────────────────────────────────────

interface OnboardingStep {
  id: string;
  label: string;
  completed: boolean;
  route?: string; // deep-link to complete the step
  ctaLabel?: string;
}

interface OnboardingStatusResponse {
  success: boolean;
  data: { steps: OnboardingStep[] };
}

// ── Default steps (shown while loading, replaced by server data) ─────────────

const DEFAULT_STEPS: OnboardingStep[] = [
  { id: 'store_profile', label: 'Complete store profile', completed: false, route: '/store-profile', ctaLabel: 'Set up profile' },
  { id: 'first_product', label: 'Add your first product', completed: false, route: '/products/new', ctaLabel: 'Add product' },
  { id: 'payout_info', label: 'Configure payout info', completed: false, route: '/store-profile', ctaLabel: 'Add bank details' },
  { id: 'publish_store', label: 'Publish your store', completed: false, ctaLabel: 'Request approval' },
  { id: 'kyc', label: 'Complete identity verification', completed: false, ctaLabel: 'Verify identity' },
];

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  collapsed: boolean;
}

export function OnboardingChecklist({ collapsed }: Props) {
  const [expanded, setExpanded] = useState(true);
  const { addToast } = useUiStore();
  const queryClient = useQueryClient();

  const { data: steps } = useQuery<OnboardingStep[]>({
    queryKey: ['vendorOnboardingStatus'],
    queryFn: async () => {
      const res = await apiClient.get<OnboardingStatusResponse>('/vendor/onboarding-status');
      return res.data.steps;
    },
    staleTime: 5 * 60 * 1000,
  });

  const requestApprovalMutation = useMutation({
    mutationFn: () => apiClient.patch('/vendor/onboarding/request-approval', {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['vendorOnboardingStatus'] });
      addToast({ id: Date.now().toString(), message: 'Approval request submitted.', variant: 'success' });
    },
    onError: () => {
      addToast({ id: Date.now().toString(), message: 'Could not submit request.', variant: 'error' });
    },
  });

  const activeSteps = steps ?? DEFAULT_STEPS;
  const completedCount = activeSteps.filter((s) => s.completed).length;
  const total = activeSteps.length;
  const allDone = completedCount === total;
  const progressPct = Math.round((completedCount / total) * 100);

  // Hide when all steps are done
  if (allDone) return null;

  // Collapsed mode: compact progress bar only
  if (collapsed) {
    return (
      <div className="border-t border-grovio-border px-3 py-2" title={`Setup: ${completedCount}/${total} done`}>
        <div className="h-1.5 rounded-full bg-grovio-border overflow-hidden">
          <div
            className="h-1.5 rounded-full bg-grovio-primary transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <p className="mt-1 text-center text-[10px] text-grovio-text-muted">
          {completedCount}/{total}
        </p>
      </div>
    );
  }

  return (
    <div className="border-t border-grovio-border">
      {/* Header row */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-2.5 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-grovio-text">Setup Guide</span>
          <span className="rounded-full bg-grovio-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-grovio-primary">
            {completedCount}/{total}
          </span>
        </div>
        <motion.span
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-grovio-text-muted"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
          </svg>
        </motion.span>
      </button>

      {/* Progress bar */}
      <div className="mx-4 h-1 rounded-full bg-grovio-border overflow-hidden">
        <motion.div
          className="h-1 rounded-full bg-grovio-primary"
          initial={{ width: 0 }}
          animate={{ width: `${progressPct}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>

      {/* Steps list */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.ul
            key="steps"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden px-4 pt-2 pb-3 space-y-1.5"
          >
            {activeSteps.map((step) => (
              <li key={step.id} className="flex items-start gap-2">
                {/* Checkmark / incomplete circle */}
                <span
                  className={[
                    'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px]',
                    step.completed
                      ? 'bg-green-500 text-white'
                      : 'border border-grovio-border text-grovio-text-muted',
                  ].join(' ')}
                >
                  {step.completed ? '✓' : ''}
                </span>

                <div className="flex-1 min-w-0">
                  <p
                    className={[
                      'text-xs font-medium leading-tight',
                      step.completed
                        ? 'text-grovio-text-muted line-through'
                        : 'text-grovio-text',
                    ].join(' ')}
                  >
                    {step.label}
                  </p>

                  {!step.completed && step.ctaLabel && (
                    step.id === 'publish_store' ? (
                      <button
                        type="button"
                        disabled={requestApprovalMutation.isPending}
                        onClick={() => requestApprovalMutation.mutate()}
                        className="mt-0.5 text-[11px] font-medium text-grovio-primary hover:underline disabled:opacity-50"
                      >
                        {requestApprovalMutation.isPending ? 'Submitting…' : step.ctaLabel}
                      </button>
                    ) : step.route ? (
                      <NavLink
                        to={step.route}
                        className="mt-0.5 block text-[11px] font-medium text-grovio-primary hover:underline"
                      >
                        {step.ctaLabel}
                      </NavLink>
                    ) : (
                      <span className="mt-0.5 text-[11px] text-grovio-text-muted">
                        {step.ctaLabel}
                      </span>
                    )
                  )}
                </div>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
