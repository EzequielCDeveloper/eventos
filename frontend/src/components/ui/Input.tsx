import { clsx } from 'clsx';
import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { Label } from '@radix-ui/react-label';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leading?: React.ReactNode;
}

const inputBase =
  'w-full bg-surface-container border border-outline-variant rounded-lg px-4 py-3 font-body-md text-body-md text-on-surface placeholder:text-outline focus:ring-2 focus:ring-primary focus:border-primary focus:outline-none transition-shadow disabled:bg-surface-container-high disabled:text-on-surface-variant';

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, leading, className, id, ...props }, ref) => {
    const inputId = id ?? (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
    return (
      <div className="w-full">
        {label ? (
          <Label htmlFor={inputId} className="block font-label-md text-label-md text-on-surface mb-2">
            {label}
          </Label>
        ) : null}
        <div className="relative">
          {leading ? (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none">
              {leading}
            </span>
          ) : null}
          <input
            ref={ref}
            id={inputId}
            aria-invalid={error ? true : undefined}
            className={clsx(inputBase, leading && 'pl-10', error && 'border-error focus:ring-error', className)}
            {...props}
          />
        </div>
        {error ? (
          <p className="mt-1.5 flex items-center gap-1 font-label-sm text-label-sm text-error font-semibold" data-state="invalid">
            {error}
          </p>
        ) : hint ? (
          <p className="mt-1.5 font-label-sm text-label-sm text-on-surface-variant">{hint}</p>
        ) : null}
      </div>
    );
  },
);
Input.displayName = 'Input';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className, id, ...props }, ref) => {
    const inputId = id ?? (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
    return (
      <div className="w-full">
        {label ? (
          <Label htmlFor={inputId} className="block font-label-md text-label-md text-on-surface mb-2">
            {label}
          </Label>
        ) : null}
        <textarea
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          className={clsx(inputBase, 'min-h-[100px] resize-y', error && 'border-error focus:ring-error', className)}
          {...props}
        />
        {error ? (
          <p className="mt-1.5 flex items-center gap-1 font-label-sm text-label-sm text-error font-semibold">{error}</p>
        ) : null}
      </div>
    );
  },
);
Textarea.displayName = 'Textarea';
