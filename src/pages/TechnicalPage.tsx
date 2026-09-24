import { useMemo } from 'react';
import { useAsync } from '@/data/useDataStore';
import { getStore } from '@/data/store';
import { Card, CardBody, EmptyState, LoadingSpinner, ErrorState, Badge } from '@/components/ui';
import { verificationColor, verificationLabel } from '@/utils/statusHelpers';
import { displayProductName } from '@/utils/productFamilies';
import { FlaskConical } from 'lucide-react';
import { useNav } from '@/context/NavContext';

export function TechnicalPage() {
  const { procurementDomain } = useNav();

  const { data, loading, error } = useAsync(async () => {
    const store = getStore();
    const products = procurementDomain
      ? await store.products.getByDomainKey(procurementDomain)
      : await store.products.getAll();

    const result = await Promise.all(
      products.map(async (product) => ({
        product,
        specs: await store.technicalSpecs.getByProduct(product.id),
      }))
    );

    return result;
  }, [procurementDomain]);

  const title = procurementDomain === 'energy_commodities'
    ? 'Calidad técnica — Energy Commodities'
    : 'Calidad técnica — Feedstock';

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorState message={error} />;

  if (!data || data.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-500">
            Revisión de composición, parámetros de calidad y evidencia técnica por producto.
          </p>
        </div>
        <Card>
          <EmptyState
            icon={<FlaskConical size={28} />}
            title="Todavía no hay productos"
            message="Registra productos primero. Cuando existan, aparecerán aquí para revisar su calidad y documentación técnica."
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        <p className="mt-1 max-w-3xl text-sm text-gray-500">
          Revisión de composición, parámetros de calidad y evidencia técnica por producto.
        </p>
      </div>

      <div className="space-y-4">
        {data.map(({ product, specs }) => (
          <Card key={product.id}>
            <CardBody>
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-gray-900">
                    {displayProductName(product.name)}
                  </h2>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                    <span>Origen: {product.origin || '—'}</span>
                    <span>Composición: {product.composition || '—'}</span>
                    <span>Volumen: {product.available_volume ? `${product.available_volume} ${product.unit}` : '—'}</span>
                  </div>
                </div>
                <Badge color={verificationColor(product.verification_status)}>
                  {verificationLabel(product.verification_status)}
                </Badge>
              </div>

              {specs.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-4 text-sm text-gray-500">
                  No hay parámetros técnicos registrados todavía para este producto.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-gray-100">
                  <table className="w-full text-sm">
                    <thead className="border-b border-gray-200 bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">Parámetro</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">Valor</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">Unidad</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">Método</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">Verificación</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {specs.map((spec) => (
                        <tr key={spec.id}>
                          <td className="px-3 py-2 font-medium text-gray-900">{spec.parameter || '—'}</td>
                          <td className="px-3 py-2 text-gray-700">{spec.value || '—'}</td>
                          <td className="px-3 py-2 text-gray-600">{spec.unit || '—'}</td>
                          <td className="px-3 py-2 text-gray-600">{spec.method || '—'}</td>
                          <td className="px-3 py-2">
                            <Badge color={verificationColor(spec.verification_status)}>
                              {verificationLabel(spec.verification_status)}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
