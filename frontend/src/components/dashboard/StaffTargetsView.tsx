import React, { useState } from 'react';
import { Target, Trophy, TrendingUp, Calendar, AlertCircle, Plus, Edit2, Trash2, CheckCircle2, DollarSign, Package } from 'lucide-react';
import { Staff, StaffTarget, Bill, staffApi } from '@/lib/api';
import { toast } from 'react-hot-toast';

interface StaffTargetsViewProps {
  targets: StaffTarget[];
  staffList: Staff[];
  selectedStaff: Staff | null;
  bills: Bill[];
  isAdmin: boolean;
  onOpenAddModal: () => void;
  onEditTarget: (target: StaffTarget) => void;
  onRefresh: () => void;
}

const StaffTargetsView: React.FC<StaffTargetsViewProps> = ({
  targets,
  staffList,
  selectedStaff,
  bills,
  isAdmin,
  onOpenAddModal,
  onEditTarget,
  onRefresh,
}) => {
  const [filterPeriod, setFilterPeriod] = useState<string>('ALL');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Filter targets for selected staff (or all if none selected)
  const safeTargets = Array.isArray(targets) ? targets : [];
  const displayTargets = safeTargets.filter(t => {
    const matchesStaff = selectedStaff ? t.staffId === selectedStaff.id : true;
    const matchesPeriod = filterPeriod === 'ALL' ? true : t.period === filterPeriod;
    return matchesStaff && matchesPeriod;
  });

  // Calculate live sales metrics for a target based on actual bills
  const calculateTargetProgress = (target: StaffTarget) => {
    const staffBills = bills.filter(b => {
      if (b.staffId !== target.staffId) return false;
      if (b.status === 'HOLD' || b.status === 'CANCELLED') return false;

      // Match period (format: YYYY-MM)
      if (target.period && target.period !== 'ALL') {
        const billDate = new Date(b.createdAt || new Date());
        if (isNaN(billDate.getTime())) return false;
        const yearMonth = `${billDate.getFullYear()}-${String(billDate.getMonth() + 1).padStart(2, '0')}`;
        return yearMonth === target.period;
      }
      return true;
    });

    const achievedRevenue = staffBills.reduce((sum, b) => sum + (Number(b.finalAmount) || 0), 0);
    const achievedUnits = staffBills.reduce((sum, b) => {
      const billUnits = (b.items || []).reduce((s, it) => s + (Number(it.quantity) || 0), 0);
      return sum + billUnits;
    }, 0);

    const targetRevenue = Number(target.targetAmount) || 1;
    const percentRevenue = Math.min(Math.round((achievedRevenue / targetRevenue) * 100), 100);
    const isCompleted = achievedRevenue >= targetRevenue;

    return {
      achievedRevenue,
      achievedUnits,
      billCount: staffBills.length,
      percentRevenue,
      isCompleted,
    };
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this sales target?')) return;
    setDeletingId(id);
    try {
      await staffApi.deleteTarget(id);
      toast.success('Sales target removed successfully.');
      onRefresh();
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || 'Failed to delete target.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Filter Bar */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
            <Target className="text-blue-600" size={22} />
            <span>Sales Targets & Product Selling Goals</span>
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            {selectedStaff
              ? `Performance targets for ${selectedStaff.name} achieved automatically by billing sales.`
              : 'Performance targets for all sales staff members achieved through bill generation.'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Period Filter */}
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-gray-700">
            <Calendar size={14} className="text-gray-400" />
            <select
              value={filterPeriod}
              onChange={(e) => setFilterPeriod(e.target.value)}
              className="bg-transparent outline-none cursor-pointer"
            >
              <option value="ALL">All Periods</option>
              {Array.from(new Set(targets.map(t => t.period))).filter(Boolean).map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {/* Admin Action: Appoint Target */}
          {isAdmin && (
            <button
              onClick={onOpenAddModal}
              className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-2"
            >
              <Plus size={16} /> Appoint Target
            </button>
          )}
        </div>
      </div>

      {/* Target Cards Grid */}
      {displayTargets.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center shadow-sm">
          <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Target size={32} />
          </div>
          <h4 className="text-base font-bold text-gray-800">No Sales Targets Configured</h4>
          <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
            {isAdmin
              ? 'Click "Appoint Target" above to assign monthly or periodic product sales goals for this staff member.'
              : 'No active sales targets have been appointed by the administrator yet.'}
          </p>
          {isAdmin && (
            <button
              onClick={onOpenAddModal}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 shadow-sm inline-flex items-center gap-2"
            >
              <Plus size={14} /> Appoint First Target
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {displayTargets.map((target) => {
            const { achievedRevenue, achievedUnits, billCount, percentRevenue, isCompleted } = calculateTargetProgress(target);
            const staffInfo = staffList.find(s => s.id === target.staffId);

            return (
              <div
                key={target.id}
                className={`bg-white rounded-2xl border p-5 shadow-sm transition-all relative flex flex-col justify-between ${
                  isCompleted ? 'border-emerald-200 ring-1 ring-emerald-500/20' : 'border-gray-200 hover:border-blue-200'
                }`}
              >
                {/* Header */}
                <div>
                  <div className="flex justify-between items-start gap-2 mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 uppercase tracking-wider font-mono">
                          {target.period || 'General'}
                        </span>
                        {isCompleted ? (
                          <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 flex items-center gap-1">
                            <Trophy size={12} className="text-emerald-600" /> Target Achieved!
                          </span>
                        ) : (
                          <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-700">
                            In Progress
                          </span>
                        )}
                      </div>
                      <h4 className="text-base font-bold text-gray-900 mt-1.5 flex items-center gap-1.5">
                        {target.staffName || staffInfo?.name || 'Staff Member'}
                      </h4>
                      {staffInfo?.role && (
                        <span className="text-xs text-gray-400 font-medium">{staffInfo.role}</span>
                      )}
                    </div>

                    {/* Admin Actions */}
                    {isAdmin && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => onEditTarget(target)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit Target"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          onClick={() => target.id && handleDelete(target.id)}
                          disabled={deletingId === target.id}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete Target"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Target Revenue Progress Bar */}
                  <div className="my-4">
                    <div className="flex justify-between items-end mb-1.5">
                      <div>
                        <span className="text-xs font-semibold text-gray-400">Achieved Revenue</span>
                        <div className="text-xl font-black text-gray-900 font-mono">
                          ₹{achievedRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                          <span className="text-xs font-normal text-gray-400 ml-1">
                            / ₹{target.targetAmount.toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`text-base font-black font-mono ${
                          isCompleted ? 'text-emerald-600' : 'text-blue-600'
                        }`}>
                          {percentRevenue}%
                        </span>
                      </div>
                    </div>

                    {/* Bar */}
                    <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden p-0.5">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isCompleted
                            ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                            : percentRevenue > 50
                            ? 'bg-gradient-to-r from-blue-500 to-indigo-500'
                            : 'bg-gradient-to-r from-amber-400 to-orange-500'
                        }`}
                        style={{ width: `${Math.max(percentRevenue, 4)}%` }}
                      />
                    </div>
                  </div>

                  {/* Secondary Metrics */}
                  <div className="grid grid-cols-2 gap-2 pt-3 border-t border-gray-100">
                    <div className="bg-gray-50/70 p-2.5 rounded-xl">
                      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                        <Package size={12} className="text-purple-500" /> Units Sold
                      </div>
                      <div className="text-sm font-bold text-gray-800 font-mono mt-0.5">
                        {achievedUnits} units
                        {target.targetQuantity ? (
                          <span className="text-xs font-normal text-gray-400"> / {target.targetQuantity}</span>
                        ) : null}
                      </div>
                    </div>

                    <div className="bg-gray-50/70 p-2.5 rounded-xl">
                      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                        <TrendingUp size={12} className="text-blue-500" /> Bills Generated
                      </div>
                      <div className="text-sm font-bold text-gray-800 font-mono mt-0.5">
                        {billCount} bills
                      </div>
                    </div>
                  </div>

                  {/* Notes / Incentive Description */}
                  {target.notes && (
                    <p className="mt-3 text-xs text-gray-500 bg-amber-50/50 border border-amber-100 p-2 rounded-lg">
                      💡 {target.notes}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default StaffTargetsView;
