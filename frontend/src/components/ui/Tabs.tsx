import * as TabsPrimitive from '@radix-ui/react-tabs';
import { clsx } from 'clsx';
import { type ReactNode } from 'react';

export function Tabs({
  value,
  onValueChange,
  children,
}: {
  value: string;
  onValueChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <TabsPrimitive.Root value={value} onValueChange={onValueChange}>
      {children}
    </TabsPrimitive.Root>
  );
}

/** Scrollable tab list styled like the mockup segmented control. */
export function TabsList({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <TabsPrimitive.List
      className={clsx(
        'flex flex-wrap items-center gap-sm border-b border-surface-variant pb-2',
        className,
      )}
    >
      {children}
    </TabsPrimitive.List>
  );
}

export function TabsTrigger({
  value,
  children,
  className,
}: {
  value: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <TabsPrimitive.Trigger
      value={value}
      className={clsx(
        'whitespace-nowrap rounded-full px-4 py-2 font-label-md text-label-md text-on-surface-variant transition-colors hover:text-on-surface data-[state=active]:text-primary data-[state=active]:bg-primary-fixed/40',
        className,
      )}
    >
      {children}
    </TabsPrimitive.Trigger>
  );
}

export function TabsContent({
  value,
  children,
  className,
}: {
  value: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <TabsPrimitive.Content value={value} className={clsx('mt-lg focus:outline-none', className)}>
      {children}
    </TabsPrimitive.Content>
  );
}
