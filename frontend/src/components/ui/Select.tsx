import * as SelectPrimitive from '@radix-ui/react-select';
import { clsx } from 'clsx';
import { type ReactNode } from 'react';
import { Icon } from './Icon';

export interface SelectOption {
  value: string;
  label: string;
}

export function Select({
  value,
  onValueChange,
  options,
  placeholder = 'Seleccionar',
  className,
}: {
  value?: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
}) {
  return (
    <SelectPrimitive.Root value={value} onValueChange={onValueChange}>
      <SelectPrimitive.Trigger
        className={clsx(
          'flex w-full items-center justify-between gap-2 rounded-lg border border-outline-variant bg-surface-container px-4 py-3 font-body-md text-body-md text-on-surface focus:ring-2 focus:ring-primary focus:outline-none',
          className,
        )}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon>
          <Icon name="keyboard_arrow_down" size={18} />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={6}
          className="z-[80] max-h-[16rem] overflow-y-auto rounded-lg bg-surface-container-lowest border border-outline-variant shadow-card-hover p-1"
        >
          <SelectPrimitive.Viewport>
            {options.map((option) => (
              <SelectPrimitive.Item
                key={option.value}
                value={option.value}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-label-md text-on-surface outline-none hover:bg-surface-container-low data-[state=checked]:bg-primary-fixed"
              >
                <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator className="ml-auto">
                  <Icon name="check" size={16} />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

/** Raw trigger/content for advanced use (e.g. native-like styling). */
export const SelectRoot = SelectPrimitive.Root;
export type { ReactNode };
