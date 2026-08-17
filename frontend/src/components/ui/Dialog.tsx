import * as DialogPrimitive from '@radix-ui/react-dialog';
import { clsx } from 'clsx';
import { type ReactNode } from 'react';
import { Icon } from './Icon';

/**
 * Accessible Dialog wrapper over Radix (FR-015.2). Focus is trapped and
 * Escape closes it out of the box.
 */
export function Dialog({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      {children}
    </DialogPrimitive.Root>
  );
}

export function DialogContent({
  className,
  children,
  title,
  hideClose,
}: {
  className?: string;
  children: ReactNode;
  title?: ReactNode;
  hideClose?: boolean;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-sm" />
      <DialogPrimitive.Content
        className={clsx(
          'fixed left-1/2 top-1/2 z-[75] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl bg-surface-container-lowest shadow-lg border border-outline-variant p-lg max-h-[90dvh] overflow-y-auto focus:outline-none',
          className,
        )}
      >
        {title ? (
          <div className="mb-md flex items-center justify-between border-b border-outline-variant pb-md">
            <DialogPrimitive.Title className="font-headline-md text-headline-md text-on-surface">
              {title}
            </DialogPrimitive.Title>
            {!hideClose ? (
              <DialogPrimitive.Close
                className="flex h-8 w-8 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-low transition-colors"
                aria-label="Cerrar"
              >
                <Icon name="close" size={20} />
              </DialogPrimitive.Close>
            ) : null}
          </div>
        ) : null}
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export const DialogClose = DialogPrimitive.Close;
