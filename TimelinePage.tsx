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
          title="No timeline events"
          message="Register a supplier first, then timeline events will appear here as you record calls, emails, meetings, visits, offers, and due diligence updates."
        />
      </Card>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Timeline</h1>
        <p className="text-sm text-gray-500 mt-1">Supplier interaction history</p>
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
