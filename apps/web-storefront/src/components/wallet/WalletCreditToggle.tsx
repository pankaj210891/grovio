/**
 * WalletCreditToggle — hybrid wallet credit selector (WAL-05, D-13)
 *
 * Shows the customer's wallet balance with an "Apply wallet credit" checkbox.
 * When checked, an amount input/slider appears capped at min(balance, orderTotal).
 * Emits the applied amount so the payment step can send walletAppliedMinor to the
 * server — the server then recomputes the authoritative grandTotal (CHK-04, T-05-04).
 *
 * The UI shows the card-charge remainder after wallet credit for customer clarity,
 * but all authoritative amounts come from GET /checkout/summary.
 */


// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatMinor(minor: number): string {
  return `₹${(minor / 100).toFixed(2)}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface WalletCreditToggleProps {
  /** Customer's current wallet balance in minor units */
  balanceMinor: number;
  /** Order total (before wallet) in minor units — used to cap the max credit */
  orderTotalMinor: number;
  /** Currently applied wallet credit amount in minor units */
  appliedMinor: number;
  /** Called when the applied amount changes */
  onAppliedChange: (amount: number) => void;
}

/**
 * Wallet credit toggle with amount input.
 * Caps credit at min(walletBalance, orderTotal) per WAL-05.
 */
export function WalletCreditToggle({
  balanceMinor,
  orderTotalMinor,
  appliedMinor,
  onAppliedChange,
}: WalletCreditToggleProps) {
  const maxCredit = Math.min(balanceMinor, orderTotalMinor);

  // CR-04: derive checked from props (controlled component) so the checkbox
  // stays in sync if the parent resets appliedMinor to 0 (e.g. on wallet refresh).
  const checked = appliedMinor > 0;

  function handleToggle(e: React.ChangeEvent<HTMLInputElement>) {
    // Apply full wallet credit by default when checked (capped at maxCredit)
    onAppliedChange(e.target.checked ? maxCredit : 0);
  }

  function handleAmountChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = parseFloat(e.target.value);
    if (Number.isNaN(raw)) {
      onAppliedChange(0);
      return;
    }
    // Convert from major units (₹) to minor (paise/cents) and clamp
    const minor = Math.round(raw * 100);
    onAppliedChange(Math.max(0, Math.min(minor, maxCredit)));
  }

  const cardChargeMinor = Math.max(0, orderTotalMinor - appliedMinor);

  return (
    <div className="rounded-lg border border-grovio-border bg-grovio-surface-raised p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-grovio-text">Wallet balance</p>
          <p className="text-sm text-grovio-text-muted">{formatMinor(balanceMinor)} available</p>
        </div>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <span className="text-sm text-grovio-text">Apply</span>
          <input
            type="checkbox"
            checked={checked}
            onChange={handleToggle}
            className="w-4 h-4 accent-grovio-primary"
            aria-label="Apply wallet credit"
          />
        </label>
      </div>

      {checked && (
        <div className="mt-4 flex flex-col gap-3">
          {/* Amount input (in major units for user convenience) */}
          <div className="flex items-center gap-3">
            <label htmlFor="wallet-amount" className="text-sm text-grovio-text-muted min-w-max">
              Amount (max {formatMinor(maxCredit)}):
            </label>
            <div className="flex items-center gap-1">
              <span className="text-sm text-grovio-text">₹</span>
              <input
                id="wallet-amount"
                type="number"
                min={0}
                max={maxCredit / 100}
                step={0.01}
                value={(appliedMinor / 100).toFixed(2)}
                onChange={handleAmountChange}
                className="w-24 rounded border border-grovio-border bg-grovio-surface px-2 py-1 text-sm text-grovio-text focus:outline-none focus-visible:ring-1 focus-visible:ring-grovio-primary"
                aria-describedby="wallet-charge-remainder"
              />
            </div>
          </div>

          {/* Card-charge remainder (informational — server is authoritative) */}
          <p
            id="wallet-charge-remainder"
            className="text-xs text-grovio-text-muted"
          >
            Card charge after wallet credit:{' '}
            <span className="font-medium text-grovio-text">{formatMinor(cardChargeMinor)}</span>
            {' '}(final amount confirmed by server)
          </p>
        </div>
      )}
    </div>
  );
}
