import { useEffect, useState } from 'react';
type InsurerOption = { id: string; name: string };
type PlanOption = { id: string; name: string };
import { Building2, Shield } from 'lucide-react';

interface InsurerPlanSelectorProps {
  selectedInsurer: string | null;
  selectedPlan: string | null;
  onInsurerChange: (insurerId: string) => void;
  onPlanChange: (planId: string) => void;
}

export default function InsurerPlanSelector({
  selectedInsurer,
  selectedPlan,
  onInsurerChange,
  onPlanChange,
}: InsurerPlanSelectorProps) {
  const [insurers, setInsurers] = useState<InsurerOption[]>([]);
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInsurers();
  }, []);

  useEffect(() => {
    if (selectedInsurer) {
      fetchPlans(selectedInsurer);
    } else {
      setPlans([]);
      onPlanChange('');
    }
  }, [selectedInsurer]);

  const fetchInsurers = async () => {
    try {
      const base = import.meta.env.VITE_API_URL as string;
      const resp = await fetch(`${base}/insurers`);
      if (!resp.ok) throw new Error(`Failed to load insurers (${resp.status})`);
      const data = await resp.json() as string[];
      const options: InsurerOption[] = data.map((name) => ({ id: name, name: name.replace(/_/g, ' ') }));
      setInsurers(options);
    } catch (error) {
      console.error('Error fetching insurers from API:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPlans = async (insurerId: string) => {
    try {
      const base = import.meta.env.VITE_API_URL as string;
      const resp = await fetch(`${base}/plans?insurer=${encodeURIComponent(insurerId)}`);
      if (!resp.ok) throw new Error(`Failed to load plans (${resp.status})`);
      const data = await resp.json() as string[];
      const options: PlanOption[] = data.map((name) => ({ id: name, name }));
      setPlans(options);
    } catch (error) {
      console.error('Error fetching plans from API:', error);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-10 bg-gray-200 rounded mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="space-y-6">
        <div>
          <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
            <Building2 className="w-4 h-4 mr-2" />
            Select Insurance Company
          </label>
          <select
            value={selectedInsurer || ''}
            onChange={(e) => onInsurerChange(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
          >
            <option value="">Choose an insurer...</option>
            {insurers.map((insurer) => (
              <option key={insurer.id} value={insurer.id}>
                {insurer.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="flex items-center text-sm font-medium text-gray-700 mb-2">
            <Shield className="w-4 h-4 mr-2" />
            Select Plan
          </label>
          <select
            value={selectedPlan || ''}
            onChange={(e) => onPlanChange(e.target.value)}
            disabled={!selectedInsurer || plans.length === 0}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed"
          >
            <option value="">Choose a plan...</option>
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name}
              </option>
            ))}
          </select>
        </div>
        
      </div>
    </div>
  );
}
