/**
 * The FreeSite mark: three rounded bars in the vote colors (free, possible, impossible), like the
 * vote bar of a module. It takes its colors from the theme tokens, so it follows dark mode.
 * Keep the shapes in sync with scripts/build-icons.mjs, which renders the favicon and app icons.
 * @param {{className?: string}} props
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect x="2.5" y="5" width="7" height="22" rx="3" fill="var(--vote-free)" />
      <rect x="12.5" y="12" width="7" height="15" rx="3" fill="var(--vote-possible)" />
      <rect x="22.5" y="18" width="7" height="9" rx="3" fill="var(--vote-impossible)" />
    </svg>
  );
}
