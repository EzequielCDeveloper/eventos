import * as AvatarPrimitive from '@radix-ui/react-avatar';
import { clsx } from 'clsx';

export function Avatar({
  name,
  src,
  size = 40,
  className,
}: {
  name: string;
  src?: string | null;
  size?: number;
  className?: string;
}) {
  const initial = (name || '?').slice(0, 1).toUpperCase();
  return (
    <AvatarPrimitive.Root
      className={clsx(
        'inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full bg-primary-fixed text-on-primary-fixed font-label-md',
        className,
      )}
      style={{ width: size, height: size, fontSize: size / 2.4 }}
    >
      <AvatarPrimitive.Image src={src ?? undefined} alt={name} className="h-full w-full object-cover" />
      <AvatarPrimitive.Fallback className="flex h-full w-full items-center justify-center">
        {initial}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}
