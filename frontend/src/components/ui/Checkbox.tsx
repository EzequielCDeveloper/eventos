import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { clsx } from 'clsx';
import { type ReactNode } from 'react';
import { Icon } from './Icon';

export function Checkbox({
  id,
  checked,
  onCheckedChange,
  label,
  className,
  disabled,
}: {
  id?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label?: ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <div className={clsx('flex items-center gap-3', disabled && 'opacity-60', className)}>
      <CheckboxPrimitive.Root
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(value) => onCheckedChange(value === true)}
        className="flex h-5 w-5 items-center justify-center rounded border border-outline-variant bg-surface-container-lowest text-on-primary transition-colors focus:ring-2 focus:ring-primary focus:outline-none data-[state=checked]:bg-primary data-[state=checked]:border-primary"
      >
        <CheckboxPrimitive.Indicator>
          <Icon name="check" size={16} className="text-on-primary" />
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
      {label ? (
        <label htmlFor={id} className="cursor-pointer select-none font-body-md text-body-md text-on-surface">
          {label}
        </label>
      ) : null}
    </div>
  );
}
