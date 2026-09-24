import { useState } from 'react';
import { useNav } from '@/context/NavContext';
import { useAsync } from '@/data/useDataStore';
import { getStore } from '@/data/store';
import {
  Card, CardBody, EmptyState, LoadingSpinner, ErrorState,
  Button, Input, TextArea, Badge, Modal, PageHeader, Select,
} from '@/components/ui';
import { Plus, Users, Trash2, Star, Mail, Phone, MessageCircle } from 'lucide-react';
import type { Contact } from '@/types';

function emptyForm(supplierId: string): Omit<Contact, 'id' | 'created_at'> {
  return {
    supplier_id: supplierId, name: '', title: '', email: '', phone: '',
    whatsapp: '', is_primary: false, notes: '',
  };
}

export function ContactsPage() {
  const { procurementDomain } = useNav();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Omit<Contact, 'id' | 'created_at'> | null>(null);

  const { data: contacts, loading, error, refresh } = useAsync(
    () => procurementDomain ? getStore().contacts.getByDomainKey(procurementDomain) : getStore().contacts.getAll(), [procurementDomain]
  );
  const { data: suppliers } = useAsync(
    () => procurementDomain ? getStore().suppliers.getByDomainKey(procurementDomain) : getStore().suppliers.getAll(), [procurementDomain]
  );

  const supplierMap = new Map((suppliers ?? []).map((s) => [s.id, s.legal_name || s.trading_name || 'Desconocido']));

  const openCrear = () => {
    setForm(emptyForm(''));
    setShowForm(true);
  };

  const save = async () => {
    if (!form || !form.supplier_id || !form.name) return;
    await getStore().contacts.create(form);
    setShowForm(false);
    refresh();
  };

  const remove = async (id: string) => {
    if (!confirm('¿Eliminar este contacto?')) return;
    await getStore().contacts.remove(id);
    refresh();
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorState message={error} />;

  return (
    <div>
      <PageHeader
        title="Contactos"
        subtitle="Directorio de contactos de proveedores"
        action={suppliers && suppliers.length > 0 ? <Button onClick={openCrear}><Plus size={16} /> Agregar contacto</Button> : undefined}
      />

      {!contacts || contacts.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Users size={28} />}
            title="No hay contactos registrados"
            message={suppliers && suppliers.length > 0
              ? "Agrega el primer contacto de proveedor para registrar canales de comunicación."
              : "Registra primero un proveedor y luego agrega sus contactos."}
            action={suppliers && suppliers.length > 0 ? <Button onClick={openCrear}><Plus size={16} /> Agregar contacto</Button> : undefined}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {contacts.map((c) => (
            <Card key={c.id}>
              <CardBody>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">{c.name}</h3>
                    {c.title && <p className="text-xs text-gray-500">{c.title}</p>}
                  </div>
                  {c.is_primary && <Badge color="amber"><Star size={10} className="mr-1" /> Principal</Badge>}
                </div>
                <div className="space-y-1 text-xs text-gray-600">
                  <div className="text-xs font-medium text-gray-400 mb-1">{supplierMap.get(c.supplier_id) ?? 'Proveedor desconocido'}</div>
                  {c.email && <div className="flex items-center gap-1.5"><Mail size={12} /> {c.email}</div>}
                  {c.phone && <div className="flex items-center gap-1.5"><Phone size={12} /> {c.phone}</div>}
                  {c.whatsapp && <div className="flex items-center gap-1.5"><MessageCircle size={12} /> {c.whatsapp}</div>}
                  {c.notes && <p className="mt-2 text-gray-500">{c.notes}</p>}
                </div>
                <div className="flex justify-end mt-3 pt-3 border-t border-gray-100">
                  <Button size="sm" variant="ghost" onClick={() => remove(c.id)}><Trash2 size={14} /></Button>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title="Agregar contacto"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={save} disabled={!form?.name || !form?.supplier_id}>Crear</Button>
          </>
        }
      >
        {form && (
          <div className="space-y-3">
            <Select
              label="Proveedor"
              value={form.supplier_id}
              onChange={(v) => setForm({ ...form, supplier_id: v })}
              options={(suppliers ?? []).map((s) => ({ value: s.id, label: s.legal_name || s.trading_name || 'Sin nombre' }))}
              required
            />
            <Input label="Nombre" required value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
            <Input label="Cargo / función" value={form.title} onChange={(v) => setForm({ ...form, title: v })} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Correo" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
              <Input label="Teléfono" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
            </div>
            <Input label="WhatsApp" value={form.whatsapp} onChange={(v) => setForm({ ...form, whatsapp: v })} />
            <TextArea label="Notas" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} />
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={form.is_primary} onChange={(e) => setForm({ ...form, is_primary: e.target.checked })} />
              Contacto principal
            </label>
          </div>
        )}
      </Modal>
    </div>
  );
}
