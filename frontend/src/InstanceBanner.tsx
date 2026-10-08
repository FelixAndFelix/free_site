import { useI18n } from "./i18n";

/**
 * Marks non-production instances (e.g. "Development") so they are never mistaken for the real app.
 * The label is baked into the build from INSTANCE_LABEL; production has none and renders nothing.
 * @param {{label?: string}} props defaults to the build-time label, overridable for tests
 */
export function InstanceBanner({ label = import.meta.env.VITE_INSTANCE_LABEL as string | undefined }: { label?: string }) {
  const { t } = useI18n();
  if (!label) return null;
  return (
    <div className="instance-banner" role="note">
      {t("app.instanceBanner", { label })}
    </div>
  );
}
