import { useAsync } from '@/data/useDataStore';
import { getStore } from '@/data/store';
import { Card, CardBody, EmptyState, LoadingSpinner, ErrorState } from '@/components/ui';
import { useNav } from '@/context/NavContext';
import {
  Building2,
  ShieldCheck,
  CheckSquare,
  AlertTriangle,
  Package,
  FileText,
  TrendingUp,
  Clock,
} from 'lucide-react';
import type { AppData } from '@/types';

export function DashboardPage() {
  const { navigate } = useNav();
  const { data, loading, error } = useAsync<AppData>(() => getStore().getAll(), []);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorState message={error} />;
  if (!data) return null;

  const totalSuppliers = data.suppliers.length;
  const activeSuppliers = data.suppliers.filter((s) => s.lifecycle === 'active').length;
  const ddPending = data.suppliers.filter((s) => s.lifecycle === 'dd_pending').length;
  const qualified = data.suppliers.filter((s) => s.lifecycle === 'qualified').length;
  const trial = data.suppliers.filter((s) => s.lifecycle === 'trial').length;
  const recurring = data.suppliers.filter((s) => s.lifecycle === 'recurring').length;
  const pausedRejectedArchived = data.suppliers.filter((s) =>
    ['paused', 'rejected', 'archived'].includes(s.lifecycle)
  ).length;
  const followUpsDue = data.follow_ups.filter((f) => f.status === 'open' || f.status === 'in_progress').length;
  const openRedFlags = data.red_flags.filter((r) => r.status === 'open' || r.status === 'investigating').length;
  const totalProducts = data.products.length;
  const totalDocuments = data.documents.length;

  const isEmpty = totalSuppliers === 0 && totalProducts === 0 && totalDocuments === 0;

  const metrics = [
    { label: 'Total Suppliers', value: totalSuppliers, icon: <Building2 size={20} />, color: 'text-slate-700 bg-slate-100', onClick: () => navigate('suppliers') },
    { label: 'Active', value: activeSuppliers, icon: <TrendingUp size={20} />, color: 'text-blue-700 bg-blue-100', onClick: () => navigate('suppliers') },
    { label: 'DD Pending', value: ddPending, icon: <ShieldCheck size={20} />, color: 'text-amber-700 bg-amber-100', onClick: () => navigate('due_diligence') },
    { label: 'Qualified', value: qualified, icon: <ShieldCheck size={20} />, color: 'text-teal-700 bg-teal-100', onClick: () => navigate('due_diligence') },
    { label: 'Trial', value: trial, icon: <Package size={20} />, color: 'text-violet-700 bg-violet-100', onClick: () => navigate('suppliers') },
    { label: 'Recurring', value: recurring, icon: <TrendingUp size={20} />, color: 'text-emerald-700 bg-emerald-100', onClick: () => navigate('suppliers') },
    { label: 'Paused / Rejected / Archived', value: pausedRejectedArchived, icon: <Building2 size={20} />, color: 'text-gray-700 bg-gray-100', onClick: () => navigate('suppliers') },
    { label: 'Follow-ups Due', value: followUpsDue, icon: <CheckSquare size={20} />, color: 'text-blue-700 bg-blue-100', onClick: () => navigate('follow_ups') },
    { label: 'Open Red Flags', value: openRedFlags, icon: <AlertTriangle size={20} />, color: 'text-red-700 bg-red-100', onClick: () => navigate('due_diligence') },
    { label: 'Products / Feedstocks', value: totalProducts, icon: <Package size={20} />, color: 'text-slate-700 bg-slate-100', onClick: () => navigate('products') },
    { label: 'Documents', value: totalDocuments, icon: <FileText size={20} />, color: 'text-slate-700 bg-slate-100', onClick: () => navigate('documents') },
    { label: 'Timeline Events', value: data.timeline.length, icon: <Clock size={20} />, color: 'text-slate-700 bg-slate-100', onClick: () => navigate('timeline') },
  ];

  if (isEmpty) {
    return (
      <Card>
        <EmptyState
          icon={<Building2 size={28} />}
          title="No procurement intelligence yet"
          message="Start by registering your first supplier. The dashboard will populate with metrics as you add suppliers, products, commercial offers, and due diligence records."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Metrics grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {metrics.map((m) => (
          <button key={m.label} onClick={m.onClick} className="text-left">
            <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
              <CardBody>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold text-gray-900">{m.value}</div>
                    <div className="text-xs text-gray-500 mt-1">{m.label}</div>
                  </div>
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${m.color}`}>
                    {m.icon}
                  </div>
                </div>
              </CardBody>
            </Card>
          </button>
        ))}
      </div>

      {/* Missing evidence / action needed */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardBody>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Action Required</h3>
            {followUpsDue === 0 && openRedFlags === 0 ? (
              <p className="text-sm text-gray-500">No outstanding actions or open red flags.</p>
            ) : (
              <ul className="space-y-2">
                {followUpsDue > 0 && (
                  <li className="flex items-center gap-2 text-sm text-gray-700">
                    <CheckSquare size={16} className="text-blue-600" />
                    {followUpsDue} follow-up(s) require attention
                  </li>
                )}
                {openRedFlags > 0 && (
                  <li className="flex items-center gap-2 text-sm text-gray-700">
                    <AlertTriangle size={16} className="text-red-600" />
                    {openRedFlags} open red flag(s) need investigation
                  </li>
                )}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Supplier Lifecycle Breakdown</h3>
            {totalSuppliers === 0 ? (
              <p className="text-sm text-gray-500">No suppliers registered.</p>
            ) : (
              <div className="space-y-1.5">
                {[
                  { label: 'Prospect', count: data.suppliers.filter((s) => s.lifecycle === 'prospect').length },
                  { label: 'Active', count: activeSuppliers },
                  { label: 'DD Pending', count: ddPending },
                  { label: 'Qualified', count: qualified },
                  { label: 'Trial', count: trial },
                  { label: 'Recurring', count: recurring },
                  { label: 'Paused / Rejected / Archived', count: pausedRejectedArchived },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">{row.label}</span>
                    <span className="font-medium text-gray-900">{row.count}</span>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
