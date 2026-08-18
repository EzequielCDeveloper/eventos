import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { adminKeys, fetchCommission, setCommission } from './adminApi';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Spinner } from '@/components/common/StateView';
import { useToast } from '@/components/ui/Toast';
import { money } from '@/lib/formatters';
import { clsx } from 'clsx';

/**
 * Comisión global (FR-003.3) — read the current platform commission from
 * GET /admin/commission (latest commission_settings row; seed default 10%
 * when none exists) and update it via PUT /admin/commission (backend inserts
 * a new row; the latest row governs NEW reservations, D-007).
 */
const FALLBACK_RATE = 10;

function loadSavedRate(): number {
  try {
    const raw = localStorage.getItem('fiestaexpert-admin-commission');
    if (raw === null) return FALLBACK_RATE;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 && n <= 100 ? n : FALLBACK_RATE;
  } catch {
    return FALLBACK_RATE;
  }
}

export default function CommissionConfig() {
  const { toast } = useToast();
  const [rate, setRate] = useState<number>(loadSavedRate());
  const [history, setHistory] = useState<Array<{ rate: number; at: string; origin: string }>>([
    { rate: loadSavedRate(), at: 'inicio', origin: 'local' },
  ]);

  const commissionQuery = useQuery({
    queryKey: adminKeys.commission,
    queryFn: fetchCommission,
  });

  // Backend is the source of truth once loaded (falls back to the saved/local
  // value while loading or if the API returns no row).
  useEffect(() => {
    const backendRate = Number(commissionQuery.data?.commission_rate);
    if (Number.isFinite(backendRate) && backendRate >= 0 && backendRate <= 100) {
      setRate(backendRate);
      setHistory((h) =>
        h[0]?.origin === 'backend'
          ? h
          : [{ rate: backendRate, at: 'backend', origin: 'backend' }, ...h],
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commissionQuery.data]);

  const saveQ = useMutation({
    mutationFn: () => setCommission({ commission_rate: rate }),
    onSuccess: (updated) => {
      const saved = Number(updated.commission_rate);
      localStorage.setItem('fiestaexpert-admin-commission', String(saved));
      setHistory((h) => [
        { rate: saved, at: new Date().toLocaleString('es-MX'), origin: 'local' },
        ...h,
      ]);
      toast('Comisión actualizada.', 'La nueva tasa aplica a partir de nuevas reservas.');
    },
    onError: (e) => toast('No se pudo actualizar la comisión.', String(e), 'error'),
  });

  const providerReceives = 1000 * (1 - rate / 100);

  return (
    <div className="flex flex-col gap-xxl">
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-md">
        <div>
          <h1 className="font-headline-lg-mobile md:font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface">
            Comisión Global
          </h1>
          <p className="font-body-lg text-body-lg text-on-surface-variant mt-sm">
            Porcentaje que la plataforma retiene de cada reserva.
          </p>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-lg lg:grid-cols-2">
        <Card>
          <CardContent className="flex flex-col gap-lg">
            <div className="flex items-end justify-between">
              <div>
                <p className="mb-xs font-label-md text-label-md text-on-surface-variant">Tasa actual</p>
                <h4 className="font-display-lg text-[36px] leading-none text-primary">
                  {commissionQuery.isLoading ? '…' : `${rate}%`}
                </h4>
              </div>
              {commissionQuery.isLoading ? <Spinner /> : null}
            </div>
            <div>
              <label htmlFor="commission-slider" className="mb-sm block font-label-md text-label-md text-on-surface">
                Ajuste (0% – 100%)
              </label>
              <input
                id="commission-slider"
                type="range"
                min={0.5}
                max={30}
                step={0.5}
                value={rate}
                onChange={(e) => setRate(Number(e.target.value))}
                className="w-full"
                style={{ accentColor: '#000666' }}
              />
              <div className="mt-xs flex justify-between font-label-sm text-label-sm text-on-surface-variant">
                <span>0%</span>
                <span>15%</span>
                <span>30%</span>
              </div>
              <p className="mt-sm font-label-sm text-label-sm text-on-surface-variant">
                El backend acepta valores de 0.01 a 100; el control acota el rango típico.
              </p>
            </div>
            <div className="flex flex-col gap-sm rounded-lg bg-surface-container-low p-md">
              <p className="mb-sm font-label-md text-label-md text-on-surface">Vista previa en una reserva de $1,000</p>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">El proveedor recibe</span>
                <strong className="text-on-surface">{money(providerReceives)}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-on-surface-variant">La plataforma retiene</span>
                <strong className="text-primary">{money(1000 - providerReceives)}</strong>
              </div>
            </div>
            <Button onClick={() => saveQ.mutate()} loading={saveQ.isPending} className="justify-center">
              <Icon name="save" size={18} /> Guardar cambios
            </Button>
            <p className="font-label-sm text-label-sm text-on-surface-variant">
              Los cambios solo aplican a nuevas reservas (D-007 — las reservas existentes conservan su precio).
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-md">
            <h3 className="font-headline-md text-headline-md text-on-surface">Historial de cambios</h3>
            <div className="flex flex-col gap-sm">
              {history.map((h, i) => (
                <div
                  key={`${h.rate}-${i}`}
                  className={clsx(
                    'flex items-center justify-between rounded-lg bg-surface-container-low px-md py-sm',
                    i === 0 && 'ring-1 ring-primary/30',
                  )}
                >
                  <span className="font-body-md text-body-md text-on-surface">{h.rate}%</span>
                  <span className="font-label-sm text-label-sm text-on-surface-variant">
                    {h.at === 'inicio'
                      ? 'Tasa inicial'
                      : h.origin === 'backend'
                        ? 'Valor actual (backend)'
                        : h.origin === 'local'
                          ? 'Guardado en este navegador'
                          : h.at}
                  </span>
                </div>
              ))}
            </div>
            <p className="font-label-sm text-label-sm text-on-surface-variant">
              El historial completo vive en la tabla <code>commission_settings</code> del backend;
              cargamos la tasa vigente desde <code>GET /admin/commission</code> (default de siembra:
              10%).
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
