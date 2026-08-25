import type { LucideProps } from "lucide-react";
import { resolveThemeIcon, type ThemeIconRole } from "../theme/icon.registry";
import { useTheme } from "../theme/useTheme";

export type ThemedIconProps = Omit<LucideProps, "ref"> & {
  label?: string;
  name: ThemeIconRole;
};

export function ThemedIcon({ label, name, ...props }: ThemedIconProps) {
  const { theme } = useTheme();
  const Icon = resolveThemeIcon(theme, name);
  const {
    "aria-hidden": ariaHidden,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
    className,
    role,
    ...iconProps
  } = props;
  const accessibleLabel = label ?? ariaLabel;
  const isAccessible = Boolean(accessibleLabel || ariaLabelledBy || ariaHidden === false || ariaHidden === "false");

  return (
    <Icon
      {...iconProps}
      aria-hidden={isAccessible ? undefined : ariaHidden ?? true}
      aria-label={accessibleLabel}
      aria-labelledby={ariaLabelledBy}
      className={["theme-icon", className].filter(Boolean).join(" ")}
      data-icon-role={name}
      role={accessibleLabel ? role ?? "img" : role}
    />
  );
}
