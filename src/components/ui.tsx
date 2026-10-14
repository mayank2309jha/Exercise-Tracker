import { useEffect, useId, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import { AlertTriangle, CheckCircle2, CircleDashed, CircleHelp, Info, X } from 'lucide-react';
import type { CalorieEstimate, RecordStatus } from '../domain/types';

export function cx(...c: (string | false | null | undefined)[]): string {
  return c.filter(Boolean).join(' ');
}

// ---------------------------------------------------------------------------
// Layout primitives
// ---------------------------------------------------------------------------

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink-100 sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function Card({ title, subtitle, actions, children, className }: { title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx('min-w-0 rounded-2xl border border-ink-800 bg-ink-900 p-4 shadow-[0_1px_0_rgba(255,255,255,0.02)] sm:p-5', className)}>
      {(title || actions) && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold text-ink-100">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-ink-400">{subtitle}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, unit, sub, accent }: { label: string; value: ReactNode; unit?: string; sub?: ReactNode; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-ink-800 bg-ink-900 p-4">
      <div className="text-xs font-medium text-ink-400">{label}</div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className={cx('text-3xl font-semibold tracking-tight', accent ? 'text-lime-400' : 'text-ink-100')}>{value}</span>
        {unit && <span className="text-sm text-ink-400">{unit}</span>}
      </div>
      {sub && <div className="mt-1 text-xs text-ink-400">{sub}</div>}
    </div>
  );
}

export function Empty({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-ink-700 px-4 py-8 text-center text-sm text-ink-400">
      <div>{children}</div>
      {action}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({ variant = 'secondary', size = 'md', className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <button
      type="button"
      {...rest}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-400 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-950 disabled:cursor-not-allowed disabled:opacity-40',
        size === 'sm' && 'px-2.5 py-1.5 text-xs',
        size === 'md' && 'px-3.5 py-2 text-sm',
        size === 'lg' && 'px-5 py-3 text-base',
        variant === 'primary' && 'bg-lime-400 text-ink-950 hover:bg-lime-300',
        variant === 'secondary' && 'border border-ink-700 bg-ink-800 text-ink-100 hover:bg-ink-700',
        variant === 'ghost' && 'text-ink-300 hover:bg-ink-800 hover:text-ink-100',
        variant === 'danger' && 'border border-red-900/60 bg-red-950/40 text-red-300 hover:bg-red-900/40',
        className,
      )}
    />
  );
}

const inputCls =
  'w-full rounded-xl border border-ink-700 bg-ink-850 px-3 py-2 text-sm text-ink-100 placeholder:text-ink-500 focus:border-lime-400 focus:outline-none focus:ring-1 focus:ring-lime-400 disabled:opacity-50';

export function Field({ label, hint, children, className }: { label: string; hint?: ReactNode; children: (id: string) => ReactNode; className?: string }) {
  const id = useId();
  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-xs font-medium text-ink-300">
        {label}
      </label>
      {children(id)}
      {hint && <p className="text-[11px] leading-snug text-ink-500">{hint}</p>}
    </div>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(inputCls, props.className)} />;
}

export function Select({ children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={cx(inputCls, 'appearance-none bg-[length:16px] pr-8', props.className)}>
      {children}
    </select>
  );
}

/**
 * Nullable numeric input. Empty string ↔ null; keeps the raw text while typing
 * so "8." or "-" don't get clobbered.
 */
export function NumberInput({
  value,
  onChange,
  min,
  max,
  step = 'any',
  placeholder,
  id,
  className,
  ariaLabel,
  disabled,
}: {
  value: number | null | undefined;
  onChange: (v: number | null) => void;
  min?: number;
  max?: number;
  step?: number | 'any';
  placeholder?: string;
  id?: string;
  className?: string;
  ariaLabel?: string;
  disabled?: boolean;
}) {
  const [text, setText] = useState(value == null ? '' : String(round(value)));
  useEffect(() => {
    const parsed = text.trim() === '' ? null : Number(text);
    if (parsed !== value && !(parsed != null && value != null && Math.abs(parsed - value) < 1e-9)) {
      setText(value == null ? '' : String(round(value)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  const invalid = text.trim() !== '' && (!Number.isFinite(Number(text)) || (min != null && Number(text) < min) || (max != null && Number(text) > max));
  return (
    <input
      id={id}
      type="number"
      inputMode="decimal"
      aria-label={ariaLabel}
      aria-invalid={invalid || undefined}
      disabled={disabled}
      min={min}
      max={max}
      step={step}
      placeholder={placeholder}
      value={text}
      onChange={(e) => {
        const t = e.target.value;
        setText(t);
        if (t.trim() === '') onChange(null);
        else {
          const n = Number(t);
          if (Number.isFinite(n)) onChange(n);
        }
      }}
      className={cx(inputCls, invalid && 'border-red-500 focus:border-red-500 focus:ring-red-500', className)}
    />
  );
}

function round(n: number) {
  return Math.round(n * 1000) / 1000;
}

export function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  const id = useId();
  return (
    <div className="flex items-start gap-3">
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cx('relative mt-0.5 h-5 w-9 shrink-0 rounded-full border transition-colors', checked ? 'border-lime-400 bg-lime-400' : 'border-ink-600 bg-ink-800')}
      >
        <span className={cx('absolute top-0.5 h-3.5 w-3.5 rounded-full transition-all', checked ? 'left-[18px] bg-ink-950' : 'left-0.5 bg-ink-400')} />
      </button>
      <label htmlFor={id} className="cursor-pointer text-sm">
        <span className="text-ink-100">{label}</span>
        {description && <span className="block text-xs text-ink-500">{description}</span>}
      </label>
    </div>
  );
}

export function Segmented<T extends string>({ value, options, onChange, ariaLabel }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; ariaLabel: string }) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="inline-flex rounded-xl border border-ink-700 bg-ink-850 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx('rounded-[10px] px-3 py-1.5 text-xs font-medium transition-colors', value === o.value ? 'bg-ink-700 text-ink-100' : 'text-ink-400 hover:text-ink-200')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Badges — icon + text, never colour alone
// ---------------------------------------------------------------------------

export function Badge({ children, tone = 'neutral', icon }: { children: ReactNode; tone?: 'neutral' | 'lime' | 'warn' | 'danger' | 'info'; icon?: ReactNode }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium',
        tone === 'neutral' && 'border-ink-700 bg-ink-800 text-ink-300',
        tone === 'lime' && 'border-lime-700/60 bg-lime-700/15 text-lime-300',
        tone === 'warn' && 'border-amber-700/60 bg-amber-900/20 text-amber-300',
        tone === 'danger' && 'border-red-800/60 bg-red-950/40 text-red-300',
        tone === 'info' && 'border-sky-800/60 bg-sky-950/40 text-sky-300',
      )}
    >
      {icon}
      {children}
    </span>
  );
}

export function ConfidenceBadge({ confidence }: { confidence: CalorieEstimate['confidence'] }) {
  switch (confidence) {
    case 'high':
      return <Badge tone="lime" icon={<CheckCircle2 size={12} aria-hidden />}>High confidence</Badge>;
    case 'medium':
      return <Badge tone="info" icon={<CircleDashed size={12} aria-hidden />}>Medium confidence</Badge>;
    case 'low':
      return <Badge tone="warn" icon={<CircleHelp size={12} aria-hidden />}>Low confidence</Badge>;
    default:
      return <Badge tone="danger" icon={<AlertTriangle size={12} aria-hidden />}>Insufficient data</Badge>;
  }
}

const STATUS_LABEL: Record<RecordStatus, string> = {
  completed: 'Completed',
  planned: 'Planned',
  estimated: 'Estimated',
  'imported-incomplete': 'Imported · incomplete',
  'in-progress': 'In progress',
};

export function StatusBadge({ status }: { status: RecordStatus }) {
  const tone = status === 'completed' ? 'lime' : status === 'imported-incomplete' ? 'warn' : status === 'in-progress' ? 'info' : 'neutral';
  const icon = status === 'completed' ? <CheckCircle2 size={12} aria-hidden /> : status === 'imported-incomplete' ? <CircleHelp size={12} aria-hidden /> : <CircleDashed size={12} aria-hidden />;
  return (
    <Badge tone={tone} icon={icon}>
      {STATUS_LABEL[status]}
    </Badge>
  );
}

export function Notice({ tone = 'info', children, onClose }: { tone?: 'info' | 'warn' | 'danger' | 'success'; children: ReactNode; onClose?: () => void }) {
  const Icon = tone === 'success' ? CheckCircle2 : tone === 'info' ? Info : AlertTriangle;
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cx(
        'flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm',
        tone === 'info' && 'border-sky-900/60 bg-sky-950/30 text-sky-200',
        tone === 'warn' && 'border-amber-800/60 bg-amber-950/30 text-amber-200',
        tone === 'danger' && 'border-red-800/60 bg-red-950/40 text-red-200',
        tone === 'success' && 'border-lime-700/50 bg-lime-900/10 text-lime-200',
      )}
    >
      <Icon size={16} className="mt-0.5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">{children}</div>
      {onClose && (
        <button type="button" onClick={onClose} aria-label="Dismiss" className="shrink-0 opacity-70 hover:opacity-100">
          <X size={16} />
        </button>
      )}
    </div>
  );
}

export function Modal({ open, title, onClose, children, footer }: { open: boolean; title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border border-ink-700 bg-ink-900 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-ink-800 bg-ink-900 px-5 py-4">
          <h2 className="text-base font-semibold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-ink-400 hover:bg-ink-800 hover:text-ink-100">
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="sticky bottom-0 flex justify-end gap-2 border-t border-ink-800 bg-ink-900 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}
