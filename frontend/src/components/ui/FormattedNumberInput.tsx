'use client';

import React from 'react';

interface FormattedNumberInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: string;
  onChange: (raw: string) => void;
  decimals?: number;
}

export function FormattedNumberInput({ value, onChange, decimals = 2, ...rest }: FormattedNumberInputProps) {
  const display = (() => {
    if (value === '') return '';
    const normalized = value.replace(/\./g, '').replace(',', '.');
    const num = parseFloat(normalized);
    if (isNaN(num)) return value;
    return num.toLocaleString('es-ES', {
      useGrouping: true,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  })();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let v = e.target.value;
    v = v.replace(/\./g, '').replace(',', '.');
    let sanitized = '';
    let dotSeen = false;
    for (const ch of v) {
      if (/[0-9]/.test(ch)) {
        sanitized += ch;
      } else if ((ch === '.' || ch === ',') && !dotSeen) {
        sanitized += '.';
        dotSeen = true;
      }
    }
    onChange(sanitized);
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      value={display}
      onChange={handleChange}
      {...rest}
    />
  );
}