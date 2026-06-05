---
phase: 11
plan: 01
status: issues_found
depth: standard
files_reviewed: 39
files_reviewed_list:
  - packages/ui/src/lib/utils.ts
  - packages/ui/src/components/ui/button.tsx
  - packages/ui/src/components/ui/input.tsx
  - packages/ui/src/components/ui/textarea.tsx
  - packages/ui/src/components/ui/label.tsx
  - packages/ui/src/components/ui/badge.tsx
  - packages/ui/src/components/ui/card.tsx
  - packages/ui/src/components/ui/separator.tsx
  - packages/ui/src/components/ui/skeleton.tsx
  - packages/ui/src/components/ui/avatar.tsx
  - packages/ui/src/components/ui/progress.tsx
  - packages/ui/src/components/ui/switch.tsx
  - packages/ui/src/components/ui/checkbox.tsx
  - packages/ui/src/components/ui/radio-group.tsx
  - packages/ui/src/components/ui/tabs.tsx
  - packages/ui/src/components/ui/select.tsx
  - packages/ui/src/components/ui/dropdown-menu.tsx
  - packages/ui/src/components/ui/dialog.tsx
  - packages/ui/src/components/ui/alert-dialog.tsx
  - packages/ui/src/components/ui/sheet.tsx
  - packages/ui/src/components/ui/popover.tsx
  - packages/ui/src/components/ui/tooltip.tsx
  - packages/ui/src/components/ui/scroll-area.tsx
  - packages/ui/src/components/ui/accordion.tsx
  - packages/ui/src/components/ui/collapsible.tsx
  - packages/ui/src/components/ui/table.tsx
  - packages/ui/src/components/ui/toggle.tsx
  - packages/ui/src/components/ui/toggle-group.tsx
  - packages/ui/src/components/ui/aspect-ratio.tsx
  - packages/ui/src/components/ui/hover-card.tsx
  - packages/ui/src/components/ui/context-menu.tsx
  - packages/ui/src/components/ui/alert.tsx
  - packages/ui/src/components/ui/command.tsx
  - packages/ui/src/components/ui/navigation-menu.tsx
  - packages/ui/src/components/ui/toast.tsx
  - packages/ui/components.json
  - packages/ui/package.json
  - packages/ui/src/tokens/tokens.css
  - packages/ui/src/index.ts
findings:
  critical: 3
  warning: 9
  info: 6
  total: 18
reviewed_at: 2026-06-05T00:00:00Z
---

# Phase 11: Code Review Report

**Reviewed:** 2026-06-05
**Depth:** standard
**Files Reviewed:** 39
**Status:** issues_found

## Summary

This phase installed 34 Shadcn UI components (new-york style) backed by Radix UI in `packages/ui`, added custom design tokens (OKLCH palette), and wired everything to a shared barrel export. The foundation is largely sound — the token system, CSS variable strategy, and Tailwind v4 `@theme inline` approach are all correct.

Three critical defects were found: a broken barrel export (`tokens/index.js` is referenced but that path will not exist after build — the TypeScript source compiles to `dist/`, not `src/`), a package.json `exports` field for CSS that uses the wrong key (`"style"` is not a Node.js condition), and a `Progress` indicator formula that produces a visible rendering glitch when `value` is `null`. Nine warnings cover type-safety holes, accessibility gaps, and a React 19 / `forwardRef` deprecation across the entire component set. Six info items cover minor quality issues.

---

## Critical Issues

### CR-01: `tokens` export path will fail at runtime after build

**File:** `packages/ui/src/index.ts:2-3`

**Issue:** `index.ts` imports from `"./tokens/index.js"`. The `package.json` build script compiles `src/index.ts` via `tsup` into `dist/`. After build the barrel at `dist/index.js` will `import { tokens } from "./tokens/index.js"` — but `tsup` copies/transpiles only what it is told to bundle. By default `tsup` will inline the tokens module, however the `tokens.css` sibling is not included in the build output and the `./tokens` export entry in `package.json` (see CR-02) is broken independently. More directly: if a consumer imports `@grovio/ui` the `tokens` JS object resolves fine, but the intent expressed in the file header ("all three web apps import this file automatically") implies apps also need the CSS file. The CSS export path in `package.json` is broken (CR-02 below), meaning the tokens CSS will silently not load.

Coupled defect: `src/index.ts` does `export { tokens }` alongside `export type { Tokens }` — the JS value export works, but any tree-shaker that resolves the CSS side-channel via the package `exports` map will fail (CR-02). Fix CR-02 first; then verify `tsup` includes the token module in the bundle.

**Fix:** Ensure the `tokens` JS object is bundled (it will be, by default with tsup), and fix the CSS export map entry per CR-02 so CSS consumers can also resolve the tokens stylesheet.

---

### CR-02: Broken `"./tokens"` export condition in `package.json`

**File:** `packages/ui/package.json:11-13`

**Issue:**
```json
"./tokens": {
  "style": "./src/tokens/tokens.css"
}
```
`"style"` is not a recognised Node.js `exports` condition. The valid condition for CSS in a package exports map is `"default"` (or a bundler-specific condition such as `"import"` or a custom condition understood by the specific bundler). With `"style"` as the sole condition, Node.js module resolution will find no matching condition and throw `ERR_PACKAGE_PATH_NOT_EXPORTED` (or the bundler equivalent) when an app tries to `import '@grovio/ui/tokens'` to load the stylesheet.

Additionally, the CSS file is under `src/` — for published packages the CSS should either be shipped as-is in `dist/` or the path should point to a root-relative location explicitly included in the package. Currently `tsup` does not copy CSS files to `dist/` unless configured to do so, so the path `./src/tokens/tokens.css` only works in the monorepo via workspace symlinks (which is acceptable for now) but will break for any consumer outside the monorepo.

**Fix:**
```json
"./tokens": {
  "default": "./src/tokens/tokens.css"
}
```
If/when publishing outside the monorepo, add a `tsup` `copy` step or explicit asset to copy the CSS to `dist/tokens.css` and update the path to `"./dist/tokens/tokens.css"`.

---

### CR-03: `Progress` indicator renders incorrectly when `value` is `null`

**File:** `packages/ui/src/components/ui/progress.tsx:19`

**Issue:**
```tsx
style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
```
`ProgressPrimitive.Root` from `@radix-ui/react-progress` types `value` as `number | null`. When `value` is `null` the expression evaluates correctly via `(null || 0)` → 0, showing the bar at 0% which is acceptable. However when `value` is `0` (valid: 0% complete), the same `0 || 0` fallback also fires but returns the correct result only by coincidence. The real defect is when `value` is `undefined` (which TypeScript allows via `ComponentPropsWithoutRef` — the `value` prop may be omitted entirely by callers). In that case the expression `100 - undefined` produces `NaN`, and `translateX(-NaN%)` is an invalid CSS transform. The browser silently drops the transform, leaving the indicator at its default position (full width, visually showing 100% progress) regardless of intent.

The correct guard is a nullish coalesce, not a falsy short-circuit, because `value = 0` is semantically different from `value = undefined/null`:

**Fix:**
```tsx
style={{ transform: `translateX(-${100 - (value ?? 0)}%)` }}
```

---

## Warnings

### WR-01: `React.forwardRef` is deprecated in React 19 across the entire component set

**File:** All 28 components that use `React.forwardRef` (button.tsx, input.tsx, textarea.tsx, label.tsx, card.tsx, separator.tsx, avatar.tsx, progress.tsx, switch.tsx, checkbox.tsx, radio-group.tsx, tabs.tsx, select.tsx, dropdown-menu.tsx, dialog.tsx, alert-dialog.tsx, sheet.tsx, popover.tsx, tooltip.tsx, scroll-area.tsx, accordion.tsx, table.tsx, toggle.tsx, toggle-group.tsx, hover-card.tsx, context-menu.tsx, alert.tsx, navigation-menu.tsx, toast.tsx)

**Issue:** React 19 makes `forwardRef` unnecessary — `ref` is now a plain prop on function components. While `React.forwardRef` remains available for backwards compatibility, the React team explicitly deprecates it in 19 and the CLAUDE.md stack calls for React 19.2. Using the deprecated API across the entire shared component library means:
1. Downstream apps using React 19 strict mode may see deprecation warnings in development.
2. Any future React version that removes `forwardRef` will break all 28 components simultaneously.
3. The codebase explicitly uses React 19 (`"react": "^19.0.0"` peer dep) and notes `ref` as a plain prop — yet the implementation ignores this.

**Fix:** Migrate each component to accept `ref` as a plain prop. Example for `Input`:
```tsx
// Before
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => (
    <input type={type} className={cn(...)} ref={ref} {...props} />
  ),
);
Input.displayName = "Input";

// After (React 19)
function Input({ className, type, ref, ...props }: InputProps & { ref?: React.Ref<HTMLInputElement> }) {
  return <input type={type} className={cn(...)} ref={ref} {...props} />;
}
Input.displayName = "Input";
```
This is a systematic refactor across all wrapped components. The Radix primitive wrappers that use `React.ElementRef<typeof Primitive>` as the ref type remain valid; only the wrapper pattern changes.

---

### WR-02: `Badge` uses a `<div>` element — non-semantic and inaccessible as an interactive element

**File:** `packages/ui/src/components/ui/badge.tsx:31-38`

**Issue:**
```tsx
export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}
```
The `badgeVariants` include `hover:bg-primary/80` (and similar hover states for every variant), meaning the badge is styled to look interactive. However it renders as a `<div>`, which is not keyboard-focusable and has no implicit ARIA role. When used as a status indicator this is fine, but the hover styles imply it may be used as a clickable element in practice (e.g., a filter tag in the marketplace). Passing an `onClick` prop causes a `div` to receive click events without being reachable via keyboard.

**Fix:** Either remove the hover styles (if badges are strictly display-only) or add `asChild` support via `@radix-ui/react-slot` so consumers can render it as a `<button>` or `<a>` when interactive:
```tsx
import { Slot } from "@radix-ui/react-slot";

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  asChild?: boolean;
}

function Badge({ className, variant, asChild = false, ...props }: BadgeProps) {
  const Comp = asChild ? Slot : "div";
  return <Comp className={cn(badgeVariants({ variant }), className)} {...props} />;
}
```

---

### WR-03: `CardTitle` and `CardDescription` render as `<div>` — wrong semantic element

**File:** `packages/ui/src/components/ui/card.tsx:31-52`

**Issue:** `CardTitle` renders as a `<div>` but semantically should be a heading element. A card title is the heading for its card's content region. Rendering it as `<div>` means screen readers cannot navigate by heading landmarks, and the document outline is broken. Similarly, `CardDescription` renders as `<div>` where `<p>` would be correct. These are the default Shadcn component types but this project explicitly has accessibility requirements ("accessibility-conscious UI" in CLAUDE.md).

**Fix:**
```tsx
const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn("font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
```
Note: if heading level flexibility is needed (h2 vs h3 depending on context), consider an `as` prop or `asChild`.

---

### WR-04: `AlertTitle` has a type mismatch — ref typed as `HTMLParagraphElement` but renders `<h5>`

**File:** `packages/ui/src/components/ui/alert.tsx:38-47`

**Issue:**
```tsx
const AlertTitle = React.forwardRef<
  HTMLParagraphElement,          // <-- types ref as paragraph
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5                            // <-- renders a heading
    ref={ref}
    ...
  />
));
```
The generic type argument says the ref points to an `HTMLParagraphElement`, but the rendered element is `<h5>` (`HTMLHeadingElement`). This is a type lie — code that does `alertTitleRef.current.textContent` on a `HTMLParagraphElement` ref will access `HTMLHeadingElement` at runtime. TypeScript consumers who use the ref will get incorrect DOM type hints.

**Fix:**
```tsx
const AlertTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5 ref={ref} className={cn("mb-1 font-medium leading-none tracking-tight", className)} {...props} />
));
```

---

### WR-05: `HoverCardContent` not wrapped in `Portal` — will be clipped by `overflow:hidden` ancestors

**File:** `packages/ui/src/components/ui/hover-card.tsx:11-24`

**Issue:** Every other floating content component in this library (`PopoverContent`, `DropdownMenuContent`, `SelectContent`, `TooltipContent`, etc.) wraps its content in a `Portal` to escape stacking contexts and `overflow:hidden` containers. `HoverCardContent` does not:
```tsx
const HoverCardContent = React.forwardRef<...>(
  ({ className, align = "center", sideOffset = 4, ...props }, ref) => (
    <HoverCardPrimitive.Content   // no Portal wrapper
      ...
    />
  ),
);
```
In the Grovio marketplace storefront, product cards and table cells are common `overflow:hidden` containers. A `HoverCard` used inside a product card or data table cell will be clipped to the ancestor's overflow boundary, making the card content partially or fully invisible.

**Fix:**
```tsx
import * as HoverCardPrimitive from "@radix-ui/react-hover-card";

const HoverCardContent = React.forwardRef<...>(
  ({ className, align = "center", sideOffset = 4, ...props }, ref) => (
    <HoverCardPrimitive.Portal>
      <HoverCardPrimitive.Content
        ref={ref}
        align={align}
        sideOffset={sideOffset}
        className={cn(..., className)}
        {...props}
      />
    </HoverCardPrimitive.Portal>
  ),
);
```

---

### WR-06: `ToggleGroupItem` context fallback logic silently inverts intended precedence

**File:** `packages/ui/src/components/ui/toggle-group.tsx:43-45`

**Issue:**
```tsx
toggleVariants({
  variant: context.variant || variant,
  size: context.size || size,
})
```
The intent is: use context values when present, fall back to item-level values. But `||` is a falsy check, not a nullish check. The `toggleVariants` size and variant values are typed as `string | null | undefined`. If `context.variant` is explicitly set to `null` (e.g., a consumer resets it), `null || variant` will use the item-level value — which is actually correct in that edge case. The real problem is subtler: `context` is initialised with `{ size: "default", variant: "default" }`, so `context.variant` will always be the string `"default"` even when the `ToggleGroup` consumer does not explicitly set a variant. This means item-level `variant` overrides are silently suppressed — `context.variant || variant` will always evaluate to `"default"` from context, ignoring a `variant` prop passed directly to `ToggleGroupItem`.

**Fix:** Swap the precedence so item-level props override context (or document the intended override direction and use nullish coalescing):
```tsx
toggleVariants({
  variant: variant ?? context.variant,
  size: size ?? context.size,
})
```
This matches the principle of least surprise: explicit item props override the group default.

---

### WR-07: `tailwind-merge` v2 is pinned but Tailwind CSS v4 requires `tailwind-merge` v3+

**File:** `packages/ui/package.json:54`

**Issue:**
```json
"tailwind-merge": "^2.5.0"
```
Tailwind CSS v4 made significant changes to its class naming and modifier system (e.g., the removal of `tailwind.config.js`, changes to `ring-offset-*` utility names, new container query syntax). `tailwind-merge` v2 was built to understand Tailwind v3 class semantics. When a Tailwind v4-specific utility is passed to `cn()`, `tailwind-merge` v2 will not know how to merge or deduplicate it correctly — it may allow conflicting classes through, or merge non-conflicting classes incorrectly.

The `tailwind-merge` v3 release added explicit Tailwind v4 support. The project uses Tailwind v4 (`@tailwindcss/vite` plugin) per CLAUDE.md, and `tailwind-merge@^2.5.0` will not correctly handle Tailwind v4 classes at merge time.

**Fix:** Upgrade `tailwind-merge` to v3:
```json
"tailwind-merge": "^3.0.0"
```
Note: `tailwind-merge` v3 has a breaking API change for custom configs — review the migration guide if any `extendTailwindMerge` calls are in the codebase.

---

### WR-08: `ContextMenuContent` has a conflicting double animation class

**File:** `packages/ui/src/components/ui/context-menu.tsx:57`

**Issue:** The `ContextMenuContent` class string contains both `animate-in fade-in-80` (a legacy unconditional animation) and `data-[state=open]:animate-in data-[state=open]:fade-in-0` (the state-conditional animation used consistently across every other overlay component):
```
"z-50 ... animate-in fade-in-80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 ..."
```
The unconditional `animate-in fade-in-80` will fire immediately on mount regardless of state, while the `data-[state=open]:fade-in-0` replaces it when state is open. This creates a visible jump: the element fades in to 80% opacity and then immediately animates from 0% opacity again when the data-state attribute is applied by Radix. No other overlay component in the library has this double animation. It is inconsistent with `DropdownMenuContent`, `SelectContent`, `PopoverContent`, and all other menus.

**Fix:** Remove the unconditional `animate-in fade-in-80` class:
```tsx
className={cn(
  "z-50 min-w-[8rem] overflow-hidden rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
  className,
)}
```

---

### WR-09: `tokens.css` missing `@import "tailwindcss"` directive — the file will not activate Tailwind v4

**File:** `packages/ui/src/tokens/tokens.css`

**Issue:** Tailwind CSS v4 requires the entry CSS file to contain `@import "tailwindcss"` (replacing the v3 `@tailwind base/components/utilities` directives). The `tokens.css` file uses `@theme inline { ... }` and `@layer base { ... }` — both of which are valid Tailwind v4 at-rules — but these directives only function when Tailwind has been activated via `@import "tailwindcss"` in the same file or an ancestor file that includes this one.

If each app's CSS entry point already contains `@import "tailwindcss"` before importing this file, the behavior is correct. However `tokens.css` is documented as the single CSS entry for "all three web apps" and is the only CSS file in the package. If an app imports `@grovio/ui/tokens` as its first and only CSS import, Tailwind's core utilities will not be injected because `@import "tailwindcss"` is absent.

**Fix:** Add the Tailwind import at the top of `tokens.css`:
```css
@import "tailwindcss";

/* ─── Light mode variables ... */
```
If apps are expected to supply their own `@import "tailwindcss"` before importing this file, add a prominent comment to that effect so the contract is clear and the per-app setup docs reflect it.

---

## Info

### IN-01: `components.json` `tailwind.config` path is empty string

**File:** `packages/ui/components.json:7`

**Issue:**
```json
"tailwind": {
  "config": "",
  ...
}
```
Tailwind v4 does not use `tailwind.config.js`, so leaving this empty is intentional. However `shadcn` CLI uses this path when adding new components — an empty string may confuse the CLI or result in incorrect component generation in future runs. The correct v4 idiom is to omit the field or set it explicitly to the CSS entry file.

**Fix:** Document in a comment or set to the CSS path:
```json
"tailwind": {
  "config": "",
  "css": "src/tokens/tokens.css",
  ...
}
```
(Currently correct; this is a documentation/clarity gap, not a functional defect.)

---

### IN-02: `tokens/index.ts` border-radius values diverge from `tokens.css` computed values

**File:** `packages/ui/src/tokens/index.ts:18-23`

**Issue:** The JS tokens object hardcodes:
```ts
borderRadius: {
  sm: "0.375rem",   // 6px
  md: "0.5rem",     // 8px
  lg: "0.75rem",    // 12px
  xl: "1rem",       // 16px
}
```
But `tokens.css` computes them dynamically from `--radius: 0.5rem`:
```css
--radius-sm: calc(var(--radius) - 4px);   /* = 0.25rem / 4px  */
--radius-md: var(--radius);               /* = 0.5rem  / 8px  */
--radius-lg: calc(var(--radius) + 4px);   /* = 0.75rem / 12px */
--radius-xl: calc(var(--radius) + 8px);   /* = 1rem    / 16px */
```
`--radius-sm` resolves to `4px` (CSS), but the JS tokens object hardcodes `6px`. If a buyer changes `--radius` to `0.25rem` to create a sharper look, the CSS radii change automatically, but any code using `tokens.borderRadius.sm` in JS/inline styles will continue to show `6px`. This is a silent inconsistency that will cause pixel-level divergence between CSS-driven and JS-driven styling.

**Fix:** Either remove the `borderRadius` field from the JS tokens object (trusting CSS variables exclusively) or keep the values in sync and document that changing `--radius` requires updating both files.

---

### IN-03: `Button` uses `React.forwardRef` pattern but `forwardRef` is deprecated in React 19

This is covered under WR-01 (systematic). Specifically noting `button.tsx:47` as the canonical reference since Button is the most-used component.

---

### IN-04: `Textarea` missing `transition-colors` class inconsistent with `Input`

**File:** `packages/ui/src/components/ui/textarea.tsx:12`

**Issue:** `Input` includes `transition-colors` in its class list:
```
"flex h-9 w-full rounded-md border ... transition-colors ..."
```
`Textarea` does not have `transition-colors`:
```
"flex min-h-[60px] w-full rounded-md border ... placeholder:text-muted-foreground focus-visible:outline-none ..."
```
Both components have focus-visible ring styles that trigger a visual state change. Without `transition-colors`, the textarea's border/ring changes abruptly instead of transitioning, which looks inconsistent next to an `<Input>` on the same form.

**Fix:** Add `transition-colors` to the textarea class list after `shadow-sm`:
```tsx
"flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
```

---

### IN-05: `ScrollBar` uses `flex-col` for horizontal orientation but is missing `flex` direction class

**File:** `packages/ui/src/components/ui/scroll-area.tsx:35`

**Issue:**
```tsx
orientation === "horizontal" &&
  "h-2.5 flex-col border-t border-t-transparent p-[1px]",
```
The horizontal scrollbar adds `flex-col` but the parent `ScrollAreaScrollbar` element already has `flex` on it (from the base class `"flex touch-none select-none transition-colors"`). `flex-col` changes the flex direction, but `flex-col` without `w-full` means the scrollbar thumb won't stretch horizontally to fill the track. The standard Shadcn pattern also applies `w-full` on the horizontal track. This may cause the horizontal scrollbar thumb to display with zero or minimal width.

**Fix:**
```tsx
orientation === "horizontal" &&
  "h-2.5 w-full flex-col border-t border-t-transparent p-[1px]",
```

---

### IN-06: Empty `CommandDialogProps` interface adds no value

**File:** `packages/ui/src/components/ui/command.tsx:23`

**Issue:**
```tsx
interface CommandDialogProps extends DialogProps {}
```
An empty `extends` interface that adds no members is dead code. It provides no additional type information, no constraints, and just adds indirection. TypeScript consumers will see `CommandDialogProps` in the type signature but get no benefit from the named type.

**Fix:** Either add props to the interface (e.g., a `filter` prop to customise command matching) or use a type alias instead:
```tsx
type CommandDialogProps = DialogProps;
```
Or simply inline `DialogProps` in the `CommandDialog` props.

---

_Reviewed: 2026-06-05_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
