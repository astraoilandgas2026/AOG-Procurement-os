import { useAsync } from '@/data/useDataStore';
import { getStore } from '@/data/store';
import {
  Card, CardBody, EmptyState, LoadingSpinner, ErrorState, Badge,
} from '@/components/ui';
import { verificationColor, verificationLabel } from '@/utils/statusHelpers';
import { FlaskConical } from 'lucide-react';

export function TechnicalPage() {
  const { data: products, loading, error } = useAsync(
    () => getStore().products.getAll(), []
  );

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorState message={error} />;

  const productsWithSpecs = (products ?? []).map((p) => ({
    product: p,
    specs: getStore().technicalSpecs.getByProduct(p.id),
  }));

  if (!products || products.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<FlaskConical size={28} />}
          title="No technical specifications"
          message="Products must be registered before technical specifications can be added. Register a product first, then capture quality parameters, COA, TDS, and SDS/FDS data."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Technical</h1>
        <p className="text-sm text-gray-500 mt-1">Technical specifications and quality parameters</p>
      </div>
      {productsWithSpecs.map(({ product }) => (
        <Card key={product.id}>
          <CardBody>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">{product.name}</h3>
                <p className="text-xs text-gray-500">{product.composition || 'No composition data'}</p>
              </div>
              <Badge color={verificationColor(product.verification_status)}>
                {verificationLabel(product.verification_status)}
              </Badge>
            </div>
            <p className="text-sm text-gray-400">No technical specifications recorded yet. Add COA, TDS, SDS/FDS parameters and quality data.</p>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
