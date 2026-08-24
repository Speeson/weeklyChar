import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

type Tone = "neutral" | "success" | "warning" | "danger";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: ReactNode;
  variant?: "primary" | "secondary" | "danger";
};

export function Button({ children, className, icon, type = "button", variant = "secondary", ...props }: ButtonProps) {
  return (
    <button className={["ui-button", `ui-button--${variant}`, className].filter(Boolean).join(" ")} type={type} {...props}>
      {icon}
      {children}
    </button>
  );
}

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  icon: ReactNode;
};

export function IconButton({ className, icon, label, type = "button", ...props }: IconButtonProps) {
  return (
    <button
      aria-label={label}
      className={["ui-icon-button", className].filter(Boolean).join(" ")}
      title={label}
      type={type}
      {...props}
    >
      {icon}
    </button>
  );
}

type CardProps = HTMLAttributes<HTMLDivElement>;

export function Card({ children, className, ...props }: CardProps) {
  return (
    <div className={["ui-card", className].filter(Boolean).join(" ")} {...props}>
      {children}
    </div>
  );
}

type BadgeProps = {
  children: ReactNode;
  tone?: Tone;
};

export function Badge({ children, tone = "neutral" }: BadgeProps) {
  return <span className={`ui-badge ui-badge--${tone}`}>{children}</span>;
}

type FieldProps = {
  children: ReactNode;
  label: string;
};

export function Field({ children, label }: FieldProps) {
  return (
    <label className="ui-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
};

export function TextField({ label, ...props }: TextFieldProps) {
  return (
    <Field label={label}>
      <input {...props} />
    </Field>
  );
}

type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & {
  children: ReactNode;
  label: string;
};

export function SelectField({ children, label, ...props }: SelectFieldProps) {
  return (
    <Field label={label}>
      <select {...props}>{children}</select>
    </Field>
  );
}

type DialogProps = {
  children: ReactNode;
  open: boolean;
  title: string;
};

export function Dialog({ children, open, title }: DialogProps) {
  if (!open) {
    return null;
  }

  const titleId = "ui-dialog-title";

  return (
    <div aria-labelledby={titleId} aria-modal="true" className="ui-dialog" role="dialog">
      <div className="ui-dialog__panel">
        <h2 id={titleId}>{title}</h2>
        {children}
      </div>
    </div>
  );
}

type StatusRowProps = {
  label: string;
  title?: string;
  tone?: Tone;
  value: ReactNode;
};

export function StatusRow({ label, title, tone = "neutral", value }: StatusRowProps) {
  return (
    <div className="ui-status-row">
      <dt>{label}</dt>
      <dd className={`ui-status-row__value ui-status-row__value--${tone}`} title={title}>
        {value}
      </dd>
    </div>
  );
}

type TooltipProps = {
  children: ReactNode;
  label: string;
};

export function Tooltip({ children, label }: TooltipProps) {
  return (
    <span className="ui-tooltip" data-tooltip={label}>
      {children}
    </span>
  );
}
