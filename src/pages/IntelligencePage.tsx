import { useAsync } from '@/data/useDataStore';
import { getStore } from '@/data/store';
import {
  Card, CardBody, EmptyState, LoadingSpinner, ErrorState, Badge,
} from '@/components/ui';
import {
  lifecycleColor, lifecycleLabel,
  verificationColor, verificationLabel,
} from '@/utils/statusHelpers';
import { FEEDSTOCK_LABELS } from '@/types';
import { Network, Building2, Package, ShieldCheck, AlertTriangle } from 'lucide-react';

export function IntelligencePage() {
  const { data, loading, error } = useAsync(() => getStore().getAll(), []);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorState message={error} />;
  if (!data) return null;

  const isEmpty = data.suppliers.length === 0;

  if (isEmpty) {
    return (
      <Card>
        <EmptyState
          icon={<Network size={28} />}
          title="Aún no hay inteligencia para mapear"
          message="El mapa de inteligencia visualiza relaciones entre proveedores, productos, certificaciones, DD y alertas de riesgo. Registra entidades para poblarlo."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mapa de Inteligencia</h1>
        <p className="text-sm text-gray-500 mt-1">Mental map and relationship overview</p>
      </div>

      {/* Supplier overview cards */}
      <div className="space-y-4">
        {data.suppliers.map((s) => {
          const products = data.products.filter((p) => p.supplier_id === s.id);
          const contacts = data.contacts.filter((c) => c.supplier_id === s.id);
          const ddItems = data.due_diligence.filter((d) => d.supplier_id === s.id);
          const certs = data.certifications.filter((c) => c.supplier_id === s.id);
          const offers = data.commercial_offers.filter((o) => o.supplier_id === s.id);
          const flags = data.red_flags.filter((r) => r.supplier_id === s.id);
          const followUps = data.follow_ups.filter((f) => f.supplier_id === s.id);
          const docs = data.documents.filter((d) => d.supplier_id === s.id);
          const logistics = data.logistics.filter((l) => l.supplier_id === s.id);

          return (
            <Card key={s.id}>
              <CardBody>
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Building2 size={18} className="text-gray-400" />
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">{s.legal_name}</h3>
                      {s.country && <p className="text-xs text-gray-500">{s.city ? `${s.city}, ` : ''}{s.country}</p>}
                    </div>
                  </div>
                  <Badge color={lifecycleColor(s.lifecycle)}>{lifecycleLabel(s.lifecycle)}</Badge>
                </div>

                {/* Entity counts */}
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
                  <IntelChip icon={<Package size={14} />} label="Products" count={products.length} />
                  <IntelChip icon={<Building2 size={14} />} label="Contacts" count={contacts.length} />
                  <IntelChip icon={<ShieldCheck size={14} />} label="DD Items" count={ddItems.length} />
                  <IntelChip icon={<ShieldCheck size={14} />} label="Certs" count={certs.length} />
                  <IntelChip icon={<ShieldCheck size={14} />} label="Offers" count={offers.length} />
                  <IntelChip icon={<AlertTriangle size={14} />} label="Red Flags" count={flags.length} highlight={flags.length > 0} />
                  <IntelChip icon={<ShieldCheck size={14} />} label="Follow-ups" count={followUps.length} />
                  <IntelChip icon={<ShieldCheck size={14} />} label="Docs" count={docs.length} />
                </div>

                {/* Products breakdown */}
                {products.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Products</h4>
                    <div className="flex flex-wrap gap-2">
                      {products.map((p) => (
                        <div key={p.id} className="flex items-center gap-2 px-2.5 py-1 bg-gray-50 rounded text-xs">
                          <Package size={12} className="text-gray-400" />
                          <span className="text-gray-700">{p.name}</span>
                          <Badge color={verificationColor(p.verification_status)}>
                            {verificationLabel(p.verification_status)}
                          </Badge>
                          <span className="text-gray-400">{FEEDSTOCK_LABELS[p.feedstock_type]}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Logistics summary */}
                {logistics.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Logistics</h4>
                    <div className="flex flex-wrap gap-2">
                      {logistics.map((l) => (
                        <div key={l.id} className="flex items-center gap-2 px-2.5 py-1 bg-gray-50 rounded text-xs text-gray-700">
                          {l.port || l.origin_location || 'Sin ubicación'}
                          <Badge color={verificationColor(l.export_readiness)}>
                            {verificationLabel(l.export_readiness)}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardBody>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function IntelChip({
  icon, label, count, highlight = false,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  highlight?: boolean;
}) {
  return (
    <div className={`flex flex-col items-center justify-center p-2 rounded-lg ${highlight ? 'bg-red-50' : 'bg-gray-50'}`}>
      <div className={`${highlight ? 'text-red-500' : 'text-gray-400'} mb-1`}>{icon}</div>
      <div className={`text-lg font-bold ${highlight ? 'text-red-700' : 'text-gray-900'}`}>{count}</div>
      <div className="text-[10px] text-gray-500">{label}</div>
    </div>
  );
}
