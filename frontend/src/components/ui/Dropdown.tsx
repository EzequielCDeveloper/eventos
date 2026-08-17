import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { clsx } from 'clsx';
import { type ReactNode } from 'react';

export function Dropdown({ children }: { children: ReactNode }) {
  return <DropdownMenuPrimitive.Root>{children}</DropdownMenuPrimitive.Root>;
}

export function DropdownTrigger({
  asChild = true,
  children,
}: {
  asChild?: boolean;
  children: ReactNode;
}) {
  return <DropdownMenuPrimitive.Trigger asChild={asChild}>{children}</DropdownMenuPrimitive.Trigger>;
}

export function DropdownContent({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        sideOffset={6}
        className={clsx(
          'z-[80] min-w-[12rem] rounded-lg bg-surface-container-lowest border border-outline-variant shadow-card-hover p-1',
          className,
        )}
      >
        {children}
      </DropdownMenuPrimitive.Content>
    </DropdownMenuPrimitive.Portal>
  );
}

export function DropdownItem({
  onSelect,
  children,
  danger,
}: {
  onSelect?: () => void;
  children: ReactNode;
  danger?: boolean;
}) {
  return (
    <DropdownMenuPrimitive.Item
      onSelect={onSelect}
      className={clsx(
        'flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-label-md outline-none transition-colors',
        danger
          ? 'text-error hover:bg-error-container'
          : 'text-on-surface hover:bg-surface-container-low',
      )}
    >
      {children}
    </DropdownMenuPrimitive.Item>
  );
}

export function DropdownLabel({ children }: { children: ReactNode }) {
  return (
    <DropdownMenuPrimitive.Label className="px-3 py-1.5 font-label-sm text-label-sm text-on-surface-variant">
      {children}
    </DropdownMenuPrimitive.Label>
  );
}
