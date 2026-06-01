import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageTransition } from '../../components/layout/PageTransition.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import { Skeleton } from '../../components/ui/Skeleton.js';
import { apiClient, ApiError } from '../../lib/api-client.js';
import { useUiStore } from '../../store/ui-store.js';

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

  // Populate form fields once profile data arrives
  useEffect(() => {
    if (profile) {
      setName(profile.name);
      setPhone(profile.phone ?? '');
    }
  }, [profile]);

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
      </div>
    </PageTransition>
  );
}
