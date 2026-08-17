import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { StateView } from '@/components/common/StateView';

/**
 * Provider dashboard shell (Slice S7). Full feature screens
 * (Hoy, Mensajes, Calendario, Anuncios, Estadísticas, Onboarding, KYC)
 * land in the S7 slice — this placeholder keeps routing + the layout live.
 */
export default function ProviderShell() {
  return (
    <StateView
      state="empty"
      icon="storefront"
      title="Panel de proveedor"
      copy="El dashboard del proveedor (Hoy, Calendario, Anuncios, Estadísticas y Onboarding) llega en la siguiente entrega de desarrollo."
      action={
        <Link to="/">
          <Button variant="outline">
            <Icon name="arrow_back" size={18} /> Ir al inicio
          </Button>
        </Link>
      }
    />
  );
}
