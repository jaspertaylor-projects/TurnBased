import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';

function inferAllowsDecimal(step: number | undefined, allowDecimal: boolean | undefined): boolean {
  if (typeof allowDecimal === 'boolean') {
    return allowDecimal;
  }

  if (typeof step !== 'number' || !Number.isFinite(step)) {
    return false;
  }

  return !Number.isInteger(step);
}

function formatNumericValue(value: number): string {
  if (!Number.isFinite(value)) {
    return '0';
  }

  return String(value);
}

function clampNumericValue(value: number, min: number | undefined, max: number | undefined): number {
  let next = value;

  if (typeof min === 'number' && Number.isFinite(min)) {
    next = Math.max(min, next);
  }

  if (typeof max === 'number' && Number.isFinite(max)) {
    next = Math.min(max, next);
  }

  return next;
}

interface NumericInputProps {
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  allowDecimal?: boolean;
  placeholder?: string;
  style?: CSSProperties;
}

export function NumericInput({
  value,
  onValueChange,
  min,
  max,
  step,
  allowDecimal,
  placeholder,
  style,
}: NumericInputProps) {
  const [draft, setDraft] = useState(() => formatNumericValue(value));
  const [isFocused, setIsFocused] = useState(false);
  const acceptsDecimal = inferAllowsDecimal(step, allowDecimal);
  const pattern = useMemo(
    () => (acceptsDecimal ? /^\d*(\.\d*)?$/ : /^\d*$/),
    [acceptsDecimal],
  );
  const displayedValue = isFocused ? draft : formatNumericValue(value);

  function commitDraft() {
    if (draft.trim().length === 0) {
      setDraft(formatNumericValue(value));
      return;
    }

    const parsed = Number(draft);
    if (!Number.isFinite(parsed)) {
      setDraft(formatNumericValue(value));
      return;
    }

    const nextValue = clampNumericValue(parsed, min, max);
    onValueChange(nextValue);
    setDraft(formatNumericValue(nextValue));
  }

  return (
    <input
      type="text"
      inputMode={acceptsDecimal ? 'decimal' : 'numeric'}
      value={displayedValue}
      placeholder={placeholder}
      onFocus={() => {
        setDraft(formatNumericValue(value));
        setIsFocused(true);
      }}
      onBlur={() => {
        setIsFocused(false);
        commitDraft();
      }}
      onChange={(event) => {
        const nextDraft = event.target.value;
        if (!pattern.test(nextDraft)) {
          return;
        }

        setDraft(nextDraft);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.currentTarget.blur();
        }

        if (event.key === 'Escape') {
          setDraft(formatNumericValue(value));
          event.currentTarget.blur();
        }
      }}
      style={style}
    />
  );
}
