import { useAsync } from '@/data/useDataStore';
import { getStore } from '@/data/store';
import {
  Card, CardBody, EmptyState, LoadingSpinner, ErrorState, Badge,
} from '@/components/ui';
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

    const withSpecs = await Promise.all(
      products.map(async (product) => ({
        product,
        specs: await store.technicalSpecs.getByProduct(product.id),
      }))
    );

    return withSpecs;
  }, [procurementDomain]);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorState message={error} />;
  if (!data || data.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<FlaskConical size={28} />}
          title="No hay productos para revisar"
          message="Los productos aparecerán aquí cuando estén registrados. Desde esta vista podrás revisar y completar su información técnica y de calidad."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Calidad técnica</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">
          Aquí se concentra la evidencia técnica de cada producto: composición, parámetros de calidad y resultados de COA, TDS y SDS/FDS.
          Si todavía no existe una especificación registrada, el producto permanece visible para que puedas completar su ficha.
        </p>
        <p className="mt-1 text-sm text-gray-500">Especificaciones técnicas y parámetros de calidad por producto.</p>
      </div>

      {data.map(({ product, specs }) => (
        <Card key={product.id}>
          <CardBody>
            <div className="mb-3 flex items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">{displayProductName(product.name)}</h3>
                <p className="text-xs text-gray-500">{product.composition || 'Sin datos de composición'}</p>
              </div>
              <Badge color={verificationColor(product.verification_status)}>
                {verificationLabel(product.verification_status)}
              </Badge>
            </div>

            {specs.length === 0 ? (
              <p className="text-sm text-gray-400">Aún no hay especificaciones técnicas. Agrega parámetros de COA, TDS, SDS/FDS y datos de calidad.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-200">
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
                        <td className="px-3 py-2 font-medium text-gray-900">{spec.parameter}</td>
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
  );
}
