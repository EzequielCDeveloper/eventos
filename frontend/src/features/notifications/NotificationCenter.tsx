import { useMemo } from 'react';
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from './hooks';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/common/StateView';
import { StateView } from '@/components/common/StateView';
import { Icon } from '@/components/ui/Icon';
import { useToast } from '@/components/ui/Toast';
import { CRITICAL_NOTIFICATION_TYPES, NOTIFICATION_TYPE_LABELS } from '@/lib/constants';
import { timeAgo } from '@/lib/formatters';
import { clsx } from 'clsx';
import type { NotificationPayload } from '@/types/api';
import { useUiStore } from '@/stores/uiStore';

/**
 * In-app notification center (FR-008.1) — read/unread state, critical
 * highlight (FR-008.2), mark read/all-read.
 */
export default function NotificationCenter() {
  const { data: items = [], isLoading, isError, refetch } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const { toast } = useToast();
  const clearUnread = useUiStore((s) => s.clearUnread);

  const unreadIds = useMemo(() => items.filter((n) => n.status !== 'leida').map((n) => n.id), [items]);

  if (isLoading) {
    return (
      <div className="space-y-md">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <StateView
        state="error"
        action={
          <Button variant="outline" onClick={() => refetch()}>
            Reintentar
          </Button>
        }
      />
    );
  }

  if (items.length === 0) {
    return (
      <StateView
        state="empty"
        icon="notifications_off"
        title="No tienes notificaciones"
        copy="Aquí aparecerán avisos de tus reservas, mensajes y pagos."
      />
    );
  }

  async function handleMarkAll() {
    try {
      await markAll.mutateAsync(unreadIds);
      clearUnread();
      toast('Todas las notificaciones marcadas como leídas.', undefined, 'success');
    } catch {
      toast('No se pudieron marcar todas.', undefined, 'error');
    }
  }

  async function handleToggle(item: NotificationPayload) {
    if (item.status === 'leida') return;
    try {
      await markRead.mutateAsync(item.id);
    } catch {
      toast('No se pudo actualizar la notificación.', undefined, 'error');
    }
  }

  return (
    <div>
      <div className="mb-lg flex items-end justify-between gap-md">
        <div>
          <h1 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface mb-xs">
            Notificaciones
          </h1>
          <p className="text-on-surface-variant">Recordatorios, avisos y novedades de tus eventos.</p>
        </div>
        <Button variant="ghost" size="sm" onClick={handleMarkAll} disabled={unreadIds.length === 0 || markAll.isPending}>
          Marcar todas como leídas
        </Button>
      </div>

      <div className="flex flex-col gap-md">
        {items.map((item) => {
          const isCritical = item.is_critical || CRITICAL_NOTIFICATION_TYPES.includes(item.type);
          const isUnread = item.status !== 'leida';
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleToggle(item)}
              className={clsx(
                'w-full rounded-xl p-lg text-left transition-colors hover:bg-surface-container-low flex items-start gap-md',
                isCritical
                  ? 'bg-error-container border-l-4 border-error'
                  : 'bg-surface-container-lowest border border-surface-container-high',
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="mb-xs flex items-center gap-sm">
                  <span className="truncate font-label-md text-label-md font-semibold text-on-surface">
                    {NOTIFICATION_TYPE_LABELS[item.type] ?? item.type}
                  </span>
                  {isCritical ? (
                    <span className="rounded-full bg-error text-on-error px-2 py-0.5 font-label-sm text-[10px] uppercase">
                      Importante
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center gap-sm font-label-sm text-[12px] text-on-surface-variant">
                  <span className="inline-flex items-center gap-1">
                    <Icon name="schedule" size={14} />
                    {timeAgo(item.created_at)}
                  </span>
                  <span
                    className="inline-flex items-center gap-1"
                    title={`Canal: ${item.channel === 'in_app' ? 'in-app' : item.channel}`}
                  >
                    <Icon name={item.channel === 'email' ? 'mail' : item.channel === 'push' ? 'notifications_active' : 'chat'} size={14} />
                  </span>
                  <span className="ml-auto">{isUnread ? <strong className="text-primary">Nueva</strong> : 'Leída'}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
