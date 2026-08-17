import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { StateView } from '@/components/common/StateView';

/**
 * Admin panel shell (Slice S7). The 5 function areas (moderación,
 * proveedores, estadísticas, disputas, comisión) land in the S7 slice —
 * this placeholder keeps routing + the layout live.
 */
export default function AdminShell() {
  return (
    <StateView
      state="empty"
      icon="admin_panel_settings"
      title="Panel de administración"
      copy="Las 5 funciones del admin (moderación, proveedores, estadísticas, disputas y comisión) llegan en la siguiente entrega de desarrollo."
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
