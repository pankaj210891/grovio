/// <reference types="@types/google.maps" />
import { useEffect, useRef } from 'react';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';
import { Input } from './ui/Input.js';

/**
 * Structured address produced by Google Places autocomplete selection.
 * Matches the customer_addresses schema columns (PATTERNS.md §customer-addresses).
 */
export interface StructuredAddress {
  street: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  lat: number | null;
  lng: number | null;
  placeId: string;
}

interface PlacesAutocompleteInputProps {
  label?: string;
  /** Current text value of the input (controlled) */
  value: string;
  /** Called on every keystroke — updates parent's displayed value */
  onChange: (v: string) => void;
  /** Called when the user selects a place from the dropdown */
  onAddressSelect: (address: StructuredAddress) => void;
  /** Optional error message for inline display */
  error?: string | undefined;
  /** Input disabled state */
  disabled?: boolean;
  /** Input id override */
  id?: string;
}

/**
 * Google Places autocomplete input for structured address entry (AUTH-06).
 *
 * When VITE_GOOGLE_MAPS_API_KEY is set:
 *   - Loads the Maps JS API via @googlemaps/js-api-loader importLibrary API
 *     (avoids duplicate script loads — Pitfall 4 in RESEARCH.md)
 *   - Attaches a google.maps.places.Autocomplete instance to the input ref
 *   - On `place_changed` parses address_components into a StructuredAddress
 *   - Cleans up listeners in useEffect return (clearInstanceListeners — Pitfall 4)
 *
 * When VITE_GOOGLE_MAPS_API_KEY is absent:
 *   - Falls back to a plain labeled Input component with a console warning
 *   - The form remains usable for manual address entry (graceful degradation)
 */
export function PlacesAutocompleteInput({
  label = 'Street address',
  value,
  onChange,
  onAddressSelect,
  error,
  disabled = false,
  id,
}: PlacesAutocompleteInputProps) {
  const apiKey = import.meta.env['VITE_GOOGLE_MAPS_API_KEY'] as
    | string
    | undefined;

  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  // Stable refs for callbacks — always calls the latest version regardless of when
  // the Autocomplete was initialised. Solves the stale-closure problem (CR-05).
  const onAddressSelectRef = useRef(onAddressSelect);
  const onChangeRef = useRef(onChange);
  useEffect(() => { onAddressSelectRef.current = onAddressSelect; }, [onAddressSelect]);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  useEffect(() => {
    if (!apiKey) {
      console.warn(
        '[PlacesAutocompleteInput] VITE_GOOGLE_MAPS_API_KEY is not set. ' +
          'Falling back to manual address input. Set the env var to enable ' +
          'Google Places autocomplete (AUTH-06).',
      );
      return;
    }

    // Configure the Maps JS API key before loading any library.
    // setOptions() is a no-op if the key was already set with the same value
    // (the loader deduplicates script injection — Pitfall 4 guard).
    setOptions({ key: apiKey, v: 'weekly' });

    let destroyed = false;

    // importLibrary('places') starts loading the script if not yet loaded,
    // then resolves the places library namespace.
    importLibrary('places')
      .then((placesLib) => {
        if (destroyed || !inputRef.current) return;

        const ac = new placesLib.Autocomplete(inputRef.current, {
          types: ['address'],
          fields: ['address_components', 'geometry', 'place_id'],
        });

        autocompleteRef.current = ac;

        ac.addListener('place_changed', () => {
          const place = autocompleteRef.current?.getPlace();
          if (!place) return;

          const structured = parseAddressComponents(place);
          // Update the visible text with the formatted street portion
          onChangeRef.current(structured.street);
          onAddressSelectRef.current(structured);
        });
      })
      .catch((err: unknown) => {
        if (!destroyed) {
          console.error('[PlacesAutocompleteInput] Failed to load Maps JS API:', err);
        }
      });

    return () => {
      destroyed = true;
      // Clean up listeners to prevent stacking on remount (RESEARCH.md Pitfall 4)
      if (autocompleteRef.current) {
        google?.maps?.event?.clearInstanceListeners(autocompleteRef.current);
        autocompleteRef.current = null;
      }
    };
    // apiKey is stable at runtime (build-time env var); onChange/onAddressSelect
    // are kept out of the dep array intentionally — they are callbacks whose
    // identity may change on every render but the Autocomplete instance must
    // only be created once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  // Fallback: render plain Input when no API key is configured
  if (!apiKey) {
    return (
      <Input
        label={label}
        id={id ?? 'places-street'}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        error={error}
        disabled={disabled}
        placeholder="Start typing your street address…"
      />
    );
  }

  // Render an input that the Autocomplete widget will attach to.
  // We use a raw input (not the shared Input component) so we can attach
  // the ref that Autocomplete needs while still applying the same CSS classes.
  const inputId = id ?? 'places-street';
  const borderClass = error ? 'border-grovio-error' : 'border-grovio-border';
  const baseClass =
    'block w-full rounded-md border bg-grovio-surface-raised text-grovio-text text-sm h-10 px-3 focus:outline-none focus:ring-2 focus:ring-grovio-primary transition-colors duration-150';

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label
          htmlFor={inputId}
          className="text-sm font-medium text-grovio-text"
        >
          {label}
        </label>
      )}
      <input
        ref={inputRef}
        id={inputId}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder="Start typing your street address…"
        autoComplete="off"
        className={`${baseClass} ${borderClass}`}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? `${inputId}-error` : undefined}
      />
      {error && (
        <p
          id={`${inputId}-error`}
          className="text-sm text-grovio-error"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract a StructuredAddress from a Google Places result.
 * Handles missing components gracefully — fields that cannot be resolved
 * default to empty strings.
 */
function parseAddressComponents(
  place: google.maps.places.PlaceResult,
): StructuredAddress {
  const components = place.address_components ?? [];

  function getComponent(types: string[]): string {
    const c = components.find((comp: google.maps.GeocoderAddressComponent) =>
      types.some((t) => comp.types.includes(t)),
    );
    return c?.long_name ?? '';
  }

  function getShortComponent(types: string[]): string {
    const c = components.find((comp: google.maps.GeocoderAddressComponent) =>
      types.some((t) => comp.types.includes(t)),
    );
    return c?.short_name ?? '';
  }

  // street_number + route = "123 Main St"
  const streetNumber = getComponent(['street_number']);
  const route = getComponent(['route']);
  const street = [streetNumber, route].filter(Boolean).join(' ');

  const city =
    getComponent(['locality']) ||
    getComponent(['postal_town']) ||
    getComponent(['sublocality_level_1']);

  const state =
    getComponent(['administrative_area_level_1']) ||
    getShortComponent(['administrative_area_level_1']);

  const pincode = getComponent(['postal_code']);
  const country = getComponent(['country']);

  const lat = place.geometry?.location?.lat() ?? null;
  const lng = place.geometry?.location?.lng() ?? null;
  const placeId = place.place_id ?? '';

  return { street, city, state, pincode, country, lat, lng, placeId };
}
