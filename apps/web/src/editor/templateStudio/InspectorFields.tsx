import { useEffect, useRef, type ReactNode } from 'react';
import { safeTemplateColor } from './safety';

export function InspectorNumber({
  label,
  value,
  onChange,
  min = -2000,
  max = 4000,
  step = 0.1,
  unit = 'mm',
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (input.current && globalThis.document.activeElement !== input.current)
      input.current.value = String(Number(value.toFixed(2)));
  }, [value]);
  return (
    <label className="template-field">
      <span>
        {label}
        {unit && <small>{unit}</small>}
      </span>
      <input
        ref={input}
        aria-label={label}
        type="number"
        defaultValue={Number(value.toFixed(2))}
        step={step}
        min={min}
        max={max}
        onChange={(event) => {
          if (event.target.value !== '') {
            const next = Number(event.target.value);
            if (Number.isFinite(next)) onChange(Math.max(min, Math.min(max, next)));
          }
        }}
        onBlur={(event) => {
          const raw = event.target.value;
          const next =
            raw !== '' && Number.isFinite(Number(raw)) ? Math.max(min, Math.min(max, Number(raw))) : value;
          event.target.value = String(Number(next.toFixed(2)));
          if (next !== value) onChange(next);
        }}
      />
    </label>
  );
}

export function InspectorSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="template-field">
      <span>{label}</span>
      <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>
        {children}
      </select>
    </label>
  );
}

export function InspectorColor({
  label,
  value,
  onChange,
  transparent = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  transparent?: boolean;
}) {
  return (
    <label className="template-field">
      <span>{label}</span>
      <span className="template-color-field">
        <input
          type="color"
          aria-label={`${label} color`}
          value={/^#[a-f\d]{6}$/i.test(value) ? value : '#ffffff'}
          onChange={(event) => onChange(event.target.value)}
        />
        <input
          key={value}
          aria-label={label}
          defaultValue={value}
          spellCheck={false}
          onBlur={(event) => {
            const next = safeTemplateColor(event.target.value, value);
            event.target.value = next;
            if (next !== value) onChange(next);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
          }}
        />
        {transparent && (
          <button
            type="button"
            title={`Clear ${label.toLowerCase()}`}
            aria-label={`Clear ${label.toLowerCase()}`}
            onClick={() => onChange('none')}
          >
            ∅
          </button>
        )}
      </span>
    </label>
  );
}
