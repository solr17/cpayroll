"use client";

import React from "react";

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(" ");
}

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------

const buttonVariants = {
  primary:
    "bg-gradient-to-r from-sky-500 to-blue-600 text-white hover:from-sky-600 hover:to-blue-700 focus-visible:ring-sky-500 disabled:from-sky-300 disabled:to-blue-300 shadow-sm",
  secondary:
    "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:border-slate-300 focus-visible:ring-slate-400 disabled:bg-slate-50 disabled:text-slate-400",
  danger:
    "bg-gradient-to-r from-rose-500 to-red-600 text-white hover:from-rose-600 hover:to-red-700 focus-visible:ring-rose-500 disabled:from-rose-300 disabled:to-red-300 shadow-sm",
  ghost:
    "bg-transparent text-slate-600 hover:bg-slate-100 focus-visible:ring-slate-400 disabled:text-slate-400",
} as const;

const buttonSizes = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-sm",
  lg: "px-5 py-2.5 text-base",
} as const;

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof buttonVariants;
  size?: keyof typeof buttonSizes;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = "primary", size = "md", loading = false, disabled, className, children, ...props },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors",
          "focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
          "disabled:cursor-not-allowed",
          buttonVariants[variant],
          buttonSizes[size],
          className,
        )}
        {...props}
      >
        {loading && <Spinner className="h-4 w-4" />}
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

export interface CardProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function Card({ title, children, className }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-900/5",
        className,
      )}
    >
      {title && (
        <h3 className="mb-4 text-sm font-semibold tracking-wider text-slate-500 uppercase">
          {title}
        </h3>
      )}
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Badge
// ---------------------------------------------------------------------------

const badgeVariants = {
  success: "bg-emerald-50 text-emerald-700 ring-emerald-500/20",
  warning: "bg-amber-50 text-amber-700 ring-amber-500/20",
  danger: "bg-rose-50 text-rose-700 ring-rose-500/20",
  info: "bg-sky-50 text-sky-700 ring-sky-500/20",
  neutral: "bg-slate-100 text-slate-600 ring-slate-400/20",
} as const;

export interface BadgeProps {
  variant?: keyof typeof badgeVariants;
  children: React.ReactNode;
}

export function Badge({ variant = "neutral", children }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        badgeVariants[variant],
      )}
    >
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// StatusBadge — pay run statuses
// ---------------------------------------------------------------------------

const statusMap = {
  draft: { label: "Draft", variant: "neutral" as const },
  calculated: { label: "Calculated", variant: "info" as const },
  reviewed: { label: "Reviewed", variant: "warning" as const },
  approved: { label: "Approved", variant: "success" as const },
  paid: { label: "Paid", variant: "success" as const },
  filed: { label: "Filed", variant: "info" as const },
} as const;

const statusColors: Record<keyof typeof statusMap, string> = {
  draft: "bg-slate-100 text-slate-600 ring-slate-400/20",
  calculated: "bg-sky-50 text-sky-700 ring-sky-500/20",
  reviewed: "bg-amber-50 text-amber-700 ring-amber-500/20",
  approved: "bg-emerald-50 text-emerald-700 ring-emerald-500/20",
  paid: "bg-teal-50 text-teal-700 ring-teal-500/20",
  filed: "bg-violet-50 text-violet-700 ring-violet-500/20",
};

export type PayRunStatus = keyof typeof statusMap;

export interface StatusBadgeProps {
  status: PayRunStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const { label } = statusMap[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        statusColors[status],
      )}
    >
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  label: string;
  error?: string | undefined;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, id, error, disabled, className, ...props }, ref) => {
    return (
      <div className={cn("flex flex-col gap-1.5", className)}>
        <label htmlFor={id} className="text-sm font-medium text-gray-700">
          {label}
          {props.required && <span className="ml-0.5 text-red-500">*</span>}
        </label>
        <input
          ref={ref}
          id={id}
          disabled={disabled}
          className={cn(
            "block w-full rounded-lg border px-3 py-2 text-sm text-gray-900 shadow-sm transition-colors",
            "placeholder:text-gray-400",
            "focus:ring-2 focus:ring-offset-0 focus:outline-none",
            "disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500",
            error
              ? "border-red-300 focus:border-red-500 focus:ring-red-500/30"
              : "border-gray-300 focus:border-sky-500 focus:ring-sky-500/20",
          )}
          {...props}
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    );
  },
);
Input.displayName = "Input";

// ---------------------------------------------------------------------------
// Select
// ---------------------------------------------------------------------------

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  label: string;
  options: SelectOption[];
  error?: string | undefined;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, id, options, error, className, ...props }, ref) => {
    return (
      <div className={cn("flex flex-col gap-1.5", className)}>
        <label htmlFor={id} className="text-sm font-medium text-gray-700">
          {label}
          {props.required && <span className="ml-0.5 text-red-500">*</span>}
        </label>
        <select
          ref={ref}
          id={id}
          className={cn(
            "block w-full rounded-lg border px-3 py-2 text-sm text-gray-900 shadow-sm transition-colors",
            "focus:ring-2 focus:ring-offset-0 focus:outline-none",
            "disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500",
            error
              ? "border-red-300 focus:border-red-500 focus:ring-red-500/30"
              : "border-gray-300 focus:border-sky-500 focus:ring-sky-500/20",
          )}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    );
  },
);
Select.displayName = "Select";

// ---------------------------------------------------------------------------
// Textarea
// ---------------------------------------------------------------------------

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string | undefined;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, id, error, disabled, className, ...props }, ref) => {
    return (
      <div className={cn("flex flex-col gap-1.5", className)}>
        <label htmlFor={id} className="text-sm font-medium text-gray-700">
          {label}
          {props.required && <span className="ml-0.5 text-red-500">*</span>}
        </label>
        <textarea
          ref={ref}
          id={id}
          disabled={disabled}
          className={cn(
            "block w-full rounded-lg border px-3 py-2 text-sm text-gray-900 shadow-sm transition-colors",
            "placeholder:text-gray-400",
            "focus:ring-2 focus:ring-offset-0 focus:outline-none",
            "disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500",
            error
              ? "border-red-300 focus:border-red-500 focus:ring-red-500/30"
              : "border-gray-300 focus:border-sky-500 focus:ring-sky-500/20",
          )}
          {...props}
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    );
  },
);
Textarea.displayName = "Textarea";

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

const modalSizes = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
} as const;

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: keyof typeof modalSizes;
}

export function Modal({ open, onClose, title, children, size = "md" }: ModalProps) {
  // Close on Escape
  React.useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  // Prevent body scroll when modal open
  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={cn(
          "relative z-10 w-full rounded-xl bg-white shadow-xl",
          "mx-4 p-6",
          modalSizes[size],
        )}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="modal-title" className="text-lg font-semibold text-gray-900">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------

export interface TableProps {
  children: React.ReactNode;
}

export function Table({ children }: TableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200 text-sm">{children}</table>
    </div>
  );
}

// Convenience sub-components for consistent table styling
Table.Head = function TableHead({ children }: { children: React.ReactNode }) {
  return <thead className="bg-gray-50">{children}</thead>;
};

Table.HeadCell = function TableHeadCell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={cn(
        "px-4 py-3 text-left text-xs font-medium tracking-wide text-gray-500 uppercase",
        className,
      )}
    >
      {children}
    </th>
  );
};

Table.Body = function TableBody({ children }: { children: React.ReactNode }) {
  return <tbody className="divide-y divide-gray-100 bg-white">{children}</tbody>;
};

Table.Row = function TableRow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <tr className={cn("transition-colors hover:bg-gray-50", className)}>{children}</tr>;
};

Table.Cell = function TableCell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={cn("px-4 py-3 whitespace-nowrap text-gray-700", className)}>{children}</td>;
};

// ---------------------------------------------------------------------------
// Spinner
// ---------------------------------------------------------------------------

export interface SpinnerProps {
  className?: string;
}

export function Spinner({ className }: SpinnerProps) {
  return (
    <svg
      className={cn("animate-spin text-current", className ?? "h-5 w-5")}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      role="status"
      aria-label="Loading"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// EmptyState
// ---------------------------------------------------------------------------

export interface EmptyStateProps {
  message: string;
  action?: React.ReactNode;
}

export function EmptyState({ message, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="mb-4 h-12 w-12 text-gray-300"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
        />
      </svg>
      <p className="mb-4 text-sm text-gray-500">{message}</p>
      {action}
    </div>
  );
}

// ---------------------------------------------------------------------------
// StatCard
// ---------------------------------------------------------------------------

export interface StatCardProps {
  label: string;
  value: string;
  change?: string;
  changeType?: "up" | "down" | "neutral";
}

const changeColors: Record<NonNullable<StatCardProps["changeType"]>, string> = {
  up: "text-green-600",
  down: "text-red-600",
  neutral: "text-gray-500",
};

const changeIcons: Record<NonNullable<StatCardProps["changeType"]>, string> = {
  up: "\u2191",
  down: "\u2193",
  neutral: "\u2192",
};

export function StatCard({ label, value, change, changeType = "neutral" }: StatCardProps) {
  return (
    <div className="card-hover rounded-xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/5">
      <p className="text-xs font-medium tracking-wide text-slate-400 uppercase">{label}</p>
      <p className="tabular mt-2 text-2xl font-bold tracking-tight text-slate-900">{value}</p>
      {change && (
        <p className={cn("mt-1 text-sm font-medium", changeColors[changeType])}>
          {changeIcons[changeType]} {change}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PageHeader
// ---------------------------------------------------------------------------

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: string;
  onAction?: () => void;
}

export function PageHeader({ title, subtitle, action, onAction }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
      </div>
      {action && onAction && (
        <Button onClick={onAction} className="mt-3 sm:mt-0">
          {action}
        </Button>
      )}
    </div>
  );
}
