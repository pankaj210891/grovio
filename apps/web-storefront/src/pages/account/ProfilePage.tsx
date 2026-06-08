import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageTransition } from '../../components/layout/PageTransition.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import { Skeleton } from '../../components/ui/Skeleton.js';
import { apiClient, ApiError } from '../../lib/api-client.js';
import { useUiStore } from '../../store/ui-store.js';
import { Bell } from 'lucide-react';

interface NotificationPreferences {
  order_updates: boolean; // always true, non-editable
  price_drops: boolean;
  promotions: boolean;
}

/**
 * Response shape from GET /account/profile and PATCH /account/profile.
 */
interface CustomerProfileData {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ProfileResponse {
  success: boolean;
  data: CustomerProfileData;
}

/**
 * Account profile page — AUTH-05
 *
 * GET /account/profile → editable name + phone fields (email read-only).
 * PATCH /account/profile on "Save Changes".
 * Loading shows a form Skeleton (aria-busy).
 * Saving disables fields + shows button spinner "Please wait…".
 * On success: toast "Profile updated."
 * Field errors are inline (no toast for validation errors).
 */
export default function ProfilePage() {
  const qc = useQueryClient();
  const addToast = useUiStore((s) => s.addToast);

  // ── Fetch current profile ────────────────────────────────────────────────
  const {
    data: profile,
    isLoading,
    isError,
  } = useQuery<CustomerProfileData>({
    queryKey: ['account', 'profile'],
    queryFn: async () => {
      const res = await apiClient.get<ProfileResponse>('/account/profile');
      return res.data;
    },
  });

  // ── Local form state ─────────────────────────────────────────────────────
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState<{ name?: string; general?: string }>({});
  const [notifPrefs, setNotifPrefs] = useState<NotificationPreferences>({
    order_updates: true,
    price_drops: true,
    promotions: false,
  });

  // Populate form fields once profile data arrives
  useEffect(() => {
    if (profile) {
      setName(profile.name);
      setPhone(profile.phone ?? '');
    }
  }, [profile]);

  // ── Notification preferences query ─────────────────────────────────────────
  const { data: notifData } = useQuery<NotificationPreferences>({
    queryKey: ['account', 'notifications', 'preferences'],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: NotificationPreferences }>(
        '/account/notifications/preferences',
      );
      return res.data;
    },
  });

  // Sync notif prefs when loaded
  useEffect(() => {
    if (notifData) setNotifPrefs(notifData);
  }, [notifData]);

  // ── Notification preferences mutation ──────────────────────────────────────
  const notifMutation = useMutation({
    mutationFn: (prefs: Partial<NotificationPreferences>) =>
      apiClient.patch('/account/notifications/preferences', prefs),
    onSuccess: () => {
      addToast({ id: crypto.randomUUID(), message: 'Notification preferences saved.', variant: 'success' });
    },
  });

  // ── Save mutation ─────────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: (body: { name: string; phone?: string | undefined }) =>
      apiClient.patch<ProfileResponse>('/account/profile', body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['account', 'profile'] });
      // Invalidate session so Header picks up name changes
      void qc.invalidateQueries({ queryKey: ['session'] });
      addToast({
        id: crypto.randomUUID(),
        message: 'Profile updated.',
        variant: 'success',
      });
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError) {
        setErrors({
          general:
            "We're having trouble connecting. Check your connection and try again.",
        });
      }
    },
  });

  function validate() {
    const next: typeof errors = {};
    if (!name.trim()) next.name = 'Name is required.';
    return next;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fieldErrors = validate();
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    const body: { name: string; phone?: string } = { name: name.trim() };
    const trimmedPhone = phone.trim();
    if (trimmedPhone) body.phone = trimmedPhone;
    saveMutation.mutate(body);
  }

  return (
    <PageTransition>
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-xl font-semibold text-grovio-text mb-8">
          My Profile
        </h1>

        {isLoading && (
          <div aria-busy="true" aria-label="Loading profile…" className="max-w-md flex flex-col gap-5">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-10 w-32" />
          </div>
        )}

        {isError && (
          <p className="text-sm text-grovio-error" role="alert">
            We&apos;re having trouble loading your profile. Please refresh and try again.
          </p>
        )}

        {!isLoading && !isError && profile && (
          <form
            onSubmit={handleSubmit}
            noValidate
            className="max-w-md flex flex-col gap-5"
          >
            {/* Email is read-only — separate verification flow required to change it */}
            <Input
              label="Email address"
              id="profile-email"
              type="email"
              value={profile.email}
              disabled
              readOnly
              aria-readonly="true"
              className="opacity-70 cursor-not-allowed"
            />

            <Input
              label="Full name"
              id="profile-name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={errors.name}
              disabled={saveMutation.isPending}
            />

            <Input
              label="Phone number"
              id="profile-phone"
              type="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={saveMutation.isPending}
            />

            {errors.general && (
              <p className="text-sm text-grovio-error" role="alert">
                {errors.general}
              </p>
            )}

            <Button
              type="submit"
              variant="primary"
              loading={saveMutation.isPending}
              className="w-full sm:w-auto"
            >
              {saveMutation.isPending ? 'Please wait…' : 'Save Changes'}
            </Button>
          </form>
        )}

        {/* Notification Preferences section */}
        {!isLoading && !isError && profile && (
          <section aria-labelledby="notif-prefs-heading" className="mt-12 max-w-md">
            <div className="flex items-center gap-2 mb-5">
              <Bell className="h-5 w-5 text-grovio-primary" aria-hidden="true" />
              <h2 id="notif-prefs-heading" className="text-base font-semibold text-grovio-text">
                Notification Preferences
              </h2>
            </div>

            <div className="space-y-4 rounded-xl border border-grovio-border bg-grovio-surface p-5">
              {/* Order updates — always on */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-grovio-text">Order Updates</p>
                  <p className="text-xs text-grovio-text-muted">Shipping, delivery, and order status changes</p>
                </div>
                <span className="text-xs font-medium text-grovio-text-muted bg-grovio-border px-2 py-0.5 rounded-full" aria-label="Always on">
                  Always On
                </span>
              </div>

              {/* Price drops */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-grovio-text">Price Drops</p>
                  <p className="text-xs text-grovio-text-muted">When wishlisted items go on sale</p>
                </div>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    checked={notifPrefs.price_drops}
                    onChange={(e) => {
                      const updated = { ...notifPrefs, price_drops: e.target.checked };
                      setNotifPrefs(updated);
                      notifMutation.mutate({ price_drops: e.target.checked });
                    }}
                    className="sr-only peer"
                    aria-label="Enable price drop notifications"
                  />
                  <div className="h-5 w-9 rounded-full bg-grovio-border peer-checked:bg-grovio-primary transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-4" />
                </label>
              </div>

              {/* Promotions */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-grovio-text">Promotions</p>
                  <p className="text-xs text-grovio-text-muted">Special offers, discounts, and sales events</p>
                </div>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    checked={notifPrefs.promotions}
                    onChange={(e) => {
                      const updated = { ...notifPrefs, promotions: e.target.checked };
                      setNotifPrefs(updated);
                      notifMutation.mutate({ promotions: e.target.checked });
                    }}
                    className="sr-only peer"
                    aria-label="Enable promotion notifications"
                  />
                  <div className="h-5 w-9 rounded-full bg-grovio-border peer-checked:bg-grovio-primary transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-4" />
                </label>
              </div>
            </div>
          </section>
        )}
      </div>
    </PageTransition>
  );
}
