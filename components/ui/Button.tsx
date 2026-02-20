import { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  block?: boolean;
}

const BASE_STYLE =
  "inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60";

const VARIANT_STYLE: Record<ButtonVariant, string> = {
  primary:
    "bg-teal-600 text-white hover:bg-teal-700 focus-visible:outline-teal-700",
  secondary:
    "bg-white text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50 focus-visible:outline-slate-500",
  ghost:
    "bg-transparent text-slate-700 hover:bg-slate-100 focus-visible:outline-slate-500",
};

export function Button({
  variant = "primary",
  block = false,
  className,
  ...props
}: ButtonProps) {
  const blockStyle = block ? "w-full" : "";
  const mergedClassName = [BASE_STYLE, VARIANT_STYLE[variant], blockStyle, className]
    .filter(Boolean)
    .join(" ");

  return <button className={mergedClassName} {...props} />;
}

export default Button;
