import { useAsync } from '@/data/useDataStore';
import { getStore } from '@/data/store';
import {
  Card, CardBody, EmptyState, LoadingSpinner, ErrorState, Badge,
} from '@/components/ui';
import { TIMELINE_EVENT_LABELS } from '@/types';
import { formatDateTime } from '@/utils/date';
import { Clock } from 'lucide-react';

export function TimelinePage() {
  const { data: suppliers } = useAsync(() => getStore().suppliers.getAll(), []);
  const { data: timeline, loading, error } = useAsync(
    () => getStore().timeline.getBySupplier(''), []
  );

  // Since we can't easily get all timeline events across suppliers with the current interface,
  // we'll show all suppliers and their timelines
  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorState message={error} />;

  const hasSuppliers = suppliers && suppliers.length > 0;

  if (!hasSuppliers) {
    return (
      <Card>
        <EmptyState
          icon={<Clock size={28} />}
          title="No hay eventos en la cronología"
          message="Registra primero un proveedor; aquí aparecerán llamadas, correos, reuniones, visitas, ofertas y actualizaciones de DD."
        />
      </Card>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Cronología</h1>
        <p className="text-sm text-gray-500 mt-1">Historial de interacciones con proveedores</p>
      </div>

      <Card>
        <CardBody>
          <p className="text-sm text-gray-500 text-center py-8">
            No timeline events recorded yet. Timeline events are created as you interact with suppliers —
            calls, emails, meetings, site visits, offers received, and due diligence updates.
            Visit a supplier profile to add timeline events.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
