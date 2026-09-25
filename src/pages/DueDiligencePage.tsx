import { useState } from 'react';
import { useAsync } from '@/data/useDataStore';
import { getStore } from '@/data/store';
import {
  Card, CardBody, EmptyState, LoadingSpinner, ErrorState,
  Button, Input, Select, TextArea, Badge, Modal, PageHeader,
} from '@/components/ui';
import {
  ddStatusColor, ddStatusLabel,
} from '@/utils/statusHelpers';
import { formatDate } from '@/utils/date';
import { Plus, ShieldCheck, Trash2, AlertTriangle } from 'lucide-react';
import type { VencimientoDiligenceItem, RedFlag, DDCategory, DDStatus } from '@/types';
import { DD_CATEGORY_LABELS, DD_STATUS_LABELS } from '@/types';

const DD_CATEGORY_OPTIONS = Object.entries(DD_CATEGORY_LABELS).map(([value, label]) => ({ value, label }));
const DD_STATUS_OPTIONS = Object.entries(DD_STATUS_LABELS).map(([value, label]) => ({ value, label }));

function emptyDDForm(supplierId: string): Omit<VencimientoDiligenceItem, 'id' | 'created_at' | 'updated_at'> {
  return {
    supplier_id: supplierId, category: 'legal', status: 'pending',
    findings: '', evidence_ref: '', reviewer: '', review_date: '',
  };
}

function emptyFlagForm(supplierId: string): Omit<RedFlag, 'id' | 'created_at'> {
  return {
    supplier_id: supplierId, flag_type: '', description: '', evidence: '',
    source: '', reviewer: '', flag_date: new Date().toISOString().slice(0, 10),
    status: 'open',
  };
}

export function DueDiligencePage() {
  const [showDDForm, setShowDDForm] = useState(false);
  const [showFlagForm, setShowFlagForm] = useState(false);
  const [ddForm, setDDForm] = useState<Omit<VencimientoDiligenceItem, 'id' | 'created_at' | 'updated_at'> | null>(null);
  const [flagForm, setFlagForm] = useState<Omit<RedFlag, 'id' | 'created_at'> | null>(null);

  const { data: ddItems, loading, error, refresh } = useAsync(
    () => getStore().dueDiligence.getAll(), []
  );
  const { data: suppliers } = useAsync(() => getStore().suppliers.getAll(), []);

  const supplierMap = new Map((suppliers ?? []).map((s) => [s.id, s.legal_name || s.trading_name || 'Desconocido']));

  const groupedDD = Array.from(
    (ddItems ?? []).reduce((map, item) => {
      const existing = map.get(item.supplier_id) ?? [];
      existing.push(item);
      map.set(item.supplier_id, existing);
      return map;
    }, new Map<string, VencimientoDiligenceItem[]>())
  );

  const openDDCrear = () => {
    setDDForm(emptyDDForm(suppliers?.[0]?.id ?? ''));
    setShowDDForm(true);
  };

  const saveDD = async () => {
    if (!ddForm || !ddForm.supplier_id) return;
    await getStore().dueDiligence.create(ddForm);
    setShowDDForm(false);
    refresh();
  };

  const removeDD = async (id: string) => {
    if (!confirm('¿Eliminar este elemento de DD?')) return;
    await getStore().dueDiligence.remove(id);
    refresh();
  };

  const openFlagCreate = () => {
    setFlagForm(emptyFlagForm(suppliers?.[0]?.id ?? ''));
    setShowFlagForm(true);
  };

  const saveFlag = async () => {
    if (!flagForm || !flagForm.supplier_id || !flagForm.description) return;
    await getStore().redFlags.create(flagForm);
    setShowFlagForm(false);
    refresh();
  };

  const removeFlag = async (id: string) => {
    if (!confirm('¿Eliminar esta alerta de riesgo?')) return;
    await getStore().redFlags.remove(id);
    refresh();
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorState message={error} />;

  const hasSuppliers = suppliers && suppliers.length > 0;
  const hasDD = ddItems && ddItems.length > 0;

  if (!hasSuppliers && !hasDD) {
    return (
      <Card>
        <EmptyState
          icon={<ShieldCheck size={28} />}
          title="No hay registros de debida diligencia"
          message="Registra primero un proveedor y luego crea elementos de DD para verificar existencia legal, operación, producto, exportación, riesgo comercial y cumplimiento."
        />
      </Card>
    );
  }

  return (
    <div>
      <PageHeader
        title="Debida Diligencia"
        subtitle="Verificación and risk assessment"
        action={
          hasSuppliers && (
            <div className="flex gap-2">
              <Button variant="secondary" onClick={openFlagCreate}><AlertTriangle size={16} /> Alerta de riesgo</Button>
              <Button onClick={openDDCrear}><Plus size={16} /> Agregar elemento de DD</Button>
            </div>
          )
        }
      />

      {/* DD Items */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Elementos de debida diligencia</h2>
        {!hasDD ? (
          <Card>
            <EmptyState
              icon={<ShieldCheck size={28} />}
              title="Aún no hay elementos de DD"
              message="Crea elementos de DD para seguir la verificación de existencia legal, operación/capacidad, producto/calidad, historial exportador, riesgo comercial y cumplimiento."
              action={hasSuppliers ? <Button onClick={openDDCrear}><Plus size={16} /> Agregar elemento de DD</Button> : undefined}
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {groupedDD.map(([supplierId, items]) => (
              <Card key={supplierId}>
                <CardBody>
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-base font-semibold text-gray-900">{supplierMap.get(supplierId) ?? 'Proveedor sin nombre'}</h3>
                      <p className="text-xs text-gray-500">{items.length} de 6 categorías de DD registradas</p>
                    </div>
                    <Badge color={items.every((item) => item.status === 'completed') ? 'green' : 'yellow'}>
                      {items.filter((item) => item.status === 'completed').length}/{items.length} completas
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    {items
                      .slice()
                      .sort((a, b) => String(a.category).localeCompare(String(b.category)))
                      .map((d) => (
                        <div key={d.id} className="rounded-lg border border-gray-100 bg-gray-50/60 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-xs font-semibold text-gray-800">{DD_CATEGORY_LABELS[d.category]}</div>
                              {d.findings && <p className="mt-1 text-xs text-gray-600">{d.findings}</p>}
                              <div className="mt-1 space-y-0.5 text-[11px] text-gray-500">
                                {d.reviewer && <div>Revisor: {d.reviewer}</div>}
                                {d.review_date && <div>Revisado: {formatDate(d.review_date)}</div>}
                                {d.evidence_ref && <div>Evidencia: {d.evidence_ref}</div>}
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <Badge color={ddStatusColor(d.status)}>{ddStatusLabel(d.status)}</Badge>
                              <Button size="sm" variant="ghost" onClick={() => removeDD(d.id)}><Trash2 size={14} /></Button>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Alerta de riesgos */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Alertas de riesgo</h2>
        <Card>
          <CardBody>
            <p className="text-sm text-gray-500">No hay alertas de riesgo registradas. Registra precios irreales, especificaciones perfectas sin evidencia, exceso de intermediarios, presión por anticipos o documentación inconsistente.</p>
          </CardBody>
        </Card>
      </div>

      {/* DD Modal */}
      <Modal
        open={showDDForm}
        onClose={() => setShowDDForm(false)}
        title="Agregar elemento de debida diligencia"
        footer={<><Button variant="secondary" onClick={() => setShowDDForm(false)}>Cancelar</Button><Button onClick={saveDD}>Crear</Button></>}
      >
        {ddForm && (
          <div className="space-y-3">
            <Select label="Proveedor" value={ddForm.supplier_id} onChange={(v) => setDDForm({ ...ddForm, supplier_id: v })}
              options={(suppliers ?? []).map((s) => ({ value: s.id, label: s.legal_name || s.trading_name || 'Sin nombre' }))} required />
            <Select label="Categoría de DD" value={ddForm.category} onChange={(v) => setDDForm({ ...ddForm, category: v as DDCategory })} options={DD_CATEGORY_OPTIONS} />
            <Select label="Estado" value={ddForm.status} onChange={(v) => setDDForm({ ...ddForm, status: v as DDStatus })} options={DD_STATUS_OPTIONS} />
            <TextArea label="Hallazgos" value={ddForm.findings} onChange={(v) => setDDForm({ ...ddForm, findings: v })} />
            <Input label="Referencia de evidencia" value={ddForm.evidence_ref} onChange={(v) => setDDForm({ ...ddForm, evidence_ref: v })} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Revisor" value={ddForm.reviewer} onChange={(v) => setDDForm({ ...ddForm, reviewer: v })} />
              <Input label="Fecha de revisión" type="date" value={ddForm.review_date} onChange={(v) => setDDForm({ ...ddForm, review_date: v })} />
            </div>
          </div>
        )}
      </Modal>

      {/* Alerta de riesgo Modal */}
      <Modal
        open={showFlagForm}
        onClose={() => setShowFlagForm(false)}
        title="Registrar alerta de riesgo"
        footer={<><Button variant="secondary" onClick={() => setShowFlagForm(false)}>Cancelar</Button><Button onClick={saveFlag} disabled={!flagForm?.description}>Crear</Button></>}
      >
        {flagForm && (
          <div className="space-y-3">
            <Select label="Proveedor" value={flagForm.supplier_id} onChange={(v) => setFlagForm({ ...flagForm, supplier_id: v })}
              options={(suppliers ?? []).map((s) => ({ value: s.id, label: s.legal_name || s.trading_name || 'Sin nombre' }))} required />
            <Input label="Tipo de alerta" value={flagForm.flag_type} onChange={(v) => setFlagForm({ ...flagForm, flag_type: v })} placeholder="ej. Precio irreal" />
            <TextArea label="Descripción" required value={flagForm.description} onChange={(v) => setFlagForm({ ...flagForm, description: v })} />
            <TextArea label="Evidencia" value={flagForm.evidence} onChange={(v) => setFlagForm({ ...flagForm, evidence: v })} />
            <Input label="Fuente" value={flagForm.source} onChange={(v) => setFlagForm({ ...flagForm, source: v })} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Revisor" value={flagForm.reviewer} onChange={(v) => setFlagForm({ ...flagForm, reviewer: v })} />
              <Input label="Fecha de alerta" type="date" value={flagForm.flag_date} onChange={(v) => setFlagForm({ ...flagForm, flag_date: v })} />
            </div>
            <p className="text-xs text-gray-400">El sistema registra evidencia y fuente. No clasifica automáticamente a un proveedor como fraudulento.</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
