import React, { useState, useEffect } from 'react';
import { Target, CheckSquare, Plus, RefreshCw, Trophy, Clock, CheckCircle2, AlertCircle, Filter, User, TrendingUp } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useGlobalData } from '@/context/GlobalDataContext';
import { staffApi, StaffTarget, StaffTask, Staff } from '@/lib/api';
import StaffTargetsView from './StaffTargetsView';
import StaffTasksView from './StaffTasksView';
import StaffTargetModal from './StaffTargetModal';
import StaffTaskModal from './StaffTaskModal';

const TasksAndTargets: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role?.toLowerCase() === 'admin';
  const { staff: staffList = [], bills = [] } = useGlobalData() as any;

  const [activeTab, setActiveTab] = useState<'targets' | 'tasks'>('targets');
  const [selectedStaffId, setSelectedStaffId] = useState<string>('ALL');

  const [targets, setTargets] = useState<StaffTarget[]>([]);
  const [tasks, setTasks] = useState<StaffTask[]>([]);
  const [loading, setLoading] = useState(false);

  // Modals state
  const [targetModalOpen, setTargetModalOpen] = useState(false);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTarget, setEditingTarget] = useState<StaffTarget | null>(null);
  const [editingTask, setEditingTask] = useState<StaffTask | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [targetsRes, tasksRes] = await Promise.all([
        staffApi.getAllTargets(),
        staffApi.getAllTasks(),
      ]);
      setTargets(targetsRes.data || []);
      setTasks(tasksRes.data || []);
    } catch (err) {
      console.error('Failed to load targets or tasks', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const selectedStaffObj = selectedStaffId === 'ALL'
    ? null
    : (staffList.find((s: Staff) => s.id === selectedStaffId) || null);

  // Compute summary stats
  const activeTargets = targets.filter(t => t.status === 'ACTIVE');
  const totalTargetGoal = activeTargets.reduce((sum, t) => sum + (Number(t.targetAmount) || 0), 0);

  // Calculate live sales achieved for active targets
  const totalAchievedRevenue = activeTargets.reduce((sum, t) => {
    const staffBills = bills.filter((b: any) => {
      if (b.staffId !== t.staffId) return false;
      if (b.status === 'HOLD' || b.status === 'CANCELLED') return false;
      if (t.period && t.period !== 'ALL') {
        const billDate = new Date(b.createdAt || new Date());
        if (isNaN(billDate.getTime())) return false;
        const yearMonth = `${billDate.getFullYear()}-${String(billDate.getMonth() + 1).padStart(2, '0')}`;
        return yearMonth === t.period;
      }
      return true;
    });
    return sum + staffBills.reduce((s: number, b: any) => s + (Number(b.finalAmount) || 0), 0);
  }, 0);

  const pendingTasks = tasks.filter(t => t.status === 'PENDING');
  const completedTasks = tasks.filter(t => t.status === 'COMPLETED');
  const urgentPendingCount = pendingTasks.filter(t => t.priority === 'URGENT' || t.priority === 'HIGH').length;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm shadow-blue-200">
              <Target size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-800 tracking-tight">
                Tasks & Targets
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">
                Sales targets achieved automatically from billed sales, and staff to-do checklists
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Staff Filter Selector */}
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700">
            <User size={15} className="text-slate-400 mr-2" />
            <select
              value={selectedStaffId}
              onChange={(e) => setSelectedStaffId(e.target.value)}
              className="bg-transparent text-slate-800 font-semibold focus:outline-none cursor-pointer pr-2"
            >
              <option value="ALL">All Staff Members</option>
              {staffList.map((s: Staff) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.role || 'Staff'})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition flex items-center gap-1.5 text-xs font-bold"
            title="Refresh Data"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>

          {isAdmin && (
            <>
              <button
                onClick={() => {
                  setEditingTarget(null);
                  setTargetModalOpen(true);
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2.5 rounded-xl font-bold text-xs shadow-sm shadow-blue-200 transition flex items-center gap-1.5"
              >
                <Plus size={16} />
                <span>Set Sales Target</span>
              </button>

              <button
                onClick={() => {
                  setEditingTask(null);
                  setTaskModalOpen(true);
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2.5 rounded-xl font-bold text-xs shadow-sm shadow-emerald-200 transition flex items-center gap-1.5"
              >
                <Plus size={16} />
                <span>Assign To-Do Task</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Active Targets */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Sales Targets</span>
            <h3 className="text-2xl font-black text-slate-800 mt-1">
              {activeTargets.length} <span className="text-xs font-semibold text-slate-400">Active</span>
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Goal: ₹{totalTargetGoal.toLocaleString('en-IN')}
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Target size={24} />
          </div>
        </div>

        {/* Card 2: Revenue Achieved */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Billed Sales</span>
            <h3 className="text-2xl font-black text-emerald-600 mt-1">
              ₹{totalAchievedRevenue.toLocaleString('en-IN')}
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-1 flex items-center gap-1">
              <TrendingUp size={13} className="text-emerald-500" />
              <span>
                {totalTargetGoal > 0
                  ? `${Math.min(Math.round((totalAchievedRevenue / totalTargetGoal) * 100), 100)}% achieved`
                  : 'Live from sales bills'}
              </span>
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Trophy size={24} />
          </div>
        </div>

        {/* Card 3: Pending Tasks */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Pending Tasks</span>
            <h3 className="text-2xl font-black text-amber-600 mt-1">
              {pendingTasks.length}
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-1">
              {urgentPendingCount > 0 ? (
                <span className="text-rose-600 font-bold">{urgentPendingCount} high priority</span>
              ) : (
                'Standard priority'
              )}
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Clock size={24} />
          </div>
        </div>

        {/* Card 4: Completed Tasks */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Completed Tasks</span>
            <h3 className="text-2xl font-black text-purple-600 mt-1">
              {completedTasks.length}
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Total {tasks.length} tasks assigned
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <CheckCircle2 size={24} />
          </div>
        </div>
      </div>

      {/* View Switcher Tabs */}
      <div className="flex items-center gap-3 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('targets')}
          className={`flex items-center gap-2 px-5 py-3 font-black text-sm border-b-2 transition ${
            activeTab === 'targets'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Target size={18} />
          <span>Sales Targets</span>
          <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full font-bold ml-1">
            {targets.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('tasks')}
          className={`flex items-center gap-2 px-5 py-3 font-black text-sm border-b-2 transition ${
            activeTab === 'tasks'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <CheckSquare size={18} />
          <span>To-Do Tasks</span>
          <span className="bg-emerald-100 text-emerald-700 text-xs px-2 py-0.5 rounded-full font-bold ml-1">
            {tasks.length}
          </span>
        </button>
      </div>

      {/* Main Content Area */}
      {activeTab === 'targets' ? (
        <StaffTargetsView
          targets={targets}
          staffList={staffList}
          selectedStaff={selectedStaffObj}
          bills={bills}
          isAdmin={isAdmin}
          onOpenAddModal={() => {
            setEditingTarget(null);
            setTargetModalOpen(true);
          }}
          onEditTarget={(target) => {
            setEditingTarget(target);
            setTargetModalOpen(true);
          }}
          onRefresh={fetchData}
        />
      ) : (
        <StaffTasksView
          tasks={tasks}
          staffList={staffList}
          selectedStaff={selectedStaffObj}
          isAdmin={isAdmin}
          onOpenAddModal={() => {
            setEditingTask(null);
            setTaskModalOpen(true);
          }}
          onEditTask={(task) => {
            setEditingTask(task);
            setTaskModalOpen(true);
          }}
          onRefresh={fetchData}
        />
      )}

      {/* Modals for Admin Appointing */}
      <StaffTargetModal
        isOpen={targetModalOpen}
        onClose={() => {
          setTargetModalOpen(false);
          setEditingTarget(null);
        }}
        staffList={staffList}
        editingTarget={editingTarget}
        onSuccess={fetchData}
      />

      <StaffTaskModal
        isOpen={taskModalOpen}
        onClose={() => {
          setTaskModalOpen(false);
          setEditingTask(null);
        }}
        staffList={staffList}
        editingTask={editingTask}
        onSuccess={fetchData}
      />
    </div>
  );
};

export default TasksAndTargets;
