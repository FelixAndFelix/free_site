import type { InputHTMLAttributes } from "react";

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  onValue: (value: string) => void;
}

/**
 * A labelled form input that reports its value as a string.
 * @param {FieldProps} props
 */
export function Field({ label, onValue, ...inputProps }: FieldProps) {
  return (
    <label className="field">
      <span>{label}</span>
      <input required {...inputProps} onChange={(event) => onValue(event.target.value)} />
    </label>
  );
}
