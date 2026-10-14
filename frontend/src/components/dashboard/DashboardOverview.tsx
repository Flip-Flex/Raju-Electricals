import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp, TrendingDown, DollarSign, ShoppingCart,
  Package, AlertTriangle, Download, Users, Check, X, Pencil,
  UserCheck, Award, Briefcase, Phone, FileText, Search, Filter, Sparkles, ChevronRight, Eye, User, Trophy, Percent, Wallet
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer
} from 'recharts';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { format, subDays, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, startOfYear, endOfMonth, endOfYear, addDays } from 'date-fns';
import { billingApi, productApi, daybookApi, Bill, Product, Vendor, DayBookEntry, Staff } from '@/lib/api';
import { useGlobalData } from '@/context/GlobalDataContext';
import LowStockProductsModal from './LowStockProductsModal';

type DashboardPeriod = 'day' | 'week' | 'month' | 'year';

const DashboardOverview = () => {
  const { toast } = useToast();
  const { bills = [], products = [], vendors = [], staff = [], refreshProducts } = useGlobalData() as any;
    const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [dashboardView, setDashboardView] = useState<DashboardPeriod>('month');
  const [isLowStockModalOpen, setIsLowStockModalOpen] = useState(false);

  // Raw data
  const [expenses, setExpenses] = useState<DayBookEntry[]>([]);
  const [totalExpenseAmount, setTotalExpenseAmount] = useState<number>(0);
    const [chartDataFetched, setChartDataFetched] = useState<any[]>([]);
  
  // Staff Performance UI state
  const [selectedStaffDetails, setSelectedStaffDetails] = useState<any | null>(null);
  const [staffSearch, setStaffSearch] = useState("");
  const [selectedStaffRole, setSelectedStaffRole] = useState("ALL");

  const getDateRange = (view: DashboardPeriod) => {
    const now = new Date();
    if (view === 'day') {
      // Day view implies current week days (Mon-Sat)
      return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
    }
    if (view === 'week') {
      // Week view implies weeks of current month (1st Week to 5th Week)
      return { start: startOfMonth(now), end: endOfMonth(now) };
    }
    if (view === 'month') {
      return { start: startOfMonth(now), end: endOfMonth(now) };
    }
    return { start: startOfYear(now), end: endOfYear(now) };
  };



  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        const daybookRes = await daybookApi.getSummary(format(new Date(), 'yyyy-MM-dd'));
        if (daybookRes.data && daybookRes.data.entries) {
          setExpenses(daybookRes.data.entries.filter((e: any) => e.type === 'EXPENSE'));
        }
        
      } catch (error) {
        console.warn("DayBook summary unavailable, continuing with bills data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, []);

  // Filter bills based on time range (Global for charts)
  const dateFilteredBills = useMemo(() => {
    const start = startOfDay(new Date(startDate));
    const end = endOfDay(new Date(endDate));

    return bills.filter(bill => {
      if (bill.status === 'CANCELLED' || bill.status === 'HOLD') return false;
      const billDate = new Date(bill.createdAt || new Date());
      return billDate >= start && billDate <= end;
    });
  }, [bills, startDate, endDate]);

const filteredBills = dateFilteredBills;

const filteredProducts = products;

  // Helper to aggregate chart data
  const aggregateChartData = (view: DashboardPeriod, rawData: any[], start: Date) => {
    if (view === 'year') {
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const monthlyAgg: Record<string, { income: number; expense: number }> = {};
      months.forEach(m => monthlyAgg[m] = { income: 0, expense: 0 });

      rawData.forEach((d: any) => {
        const dDate = new Date(d.date);
        if (!isNaN(dDate.getTime())) {
          const mName = months[dDate.getMonth()];
          if (monthlyAgg[mName]) {
            monthlyAgg[mName].income += (d.income || 0);
            monthlyAgg[mName].expense += (d.expense || 0);
          }
        }
      });
      return months.map(m => ({ date: m, income: monthlyAgg[m].income, expense: monthlyAgg[m].expense }));
    } else if (view === 'month') {
      const fullMonthData = [];
      const dataMap = new Map();
      rawData.forEach((d: any) => {
        const dayNum = new Date(d.date).getDate();
        dataMap.set(dayNum, d);
      });
      for (let i = 1; i <= 31; i++) {
        const dayData = dataMap.get(i);
        fullMonthData.push({ date: i.toString(), income: dayData?.income || 0, expense: dayData?.expense || 0 });
      }
      return fullMonthData;
    } else if (view === 'week') {
      const weeksData = [
        { date: '1st Week', income: 0, expense: 0 },
        { date: '2nd Week', income: 0, expense: 0 },
        { date: '3rd Week', income: 0, expense: 0 },
        { date: '4th Week', income: 0, expense: 0 },
        { date: '5th Week', income: 0, expense: 0 }
      ];
      rawData.forEach((d: any) => {
        const dayNum = new Date(d.date).getDate();
        let weekIdx = Math.floor((dayNum - 1) / 7);
        if (weekIdx > 4) weekIdx = 4;
        weeksData[weekIdx].income += (d.income || 0);
        weeksData[weekIdx].expense += (d.expense || 0);
      });
      return weeksData;
    } else { // day
      const fullWeekData = [];
      const dataMap = new Map();
      rawData.forEach((d: any) => {
        const dayStr = format(new Date(d.date), 'EEE');
        dataMap.set(dayStr, d);
      });
      for (let i = 0; i < 6; i++) {
        const currentDay = addDays(start, i);
        const dayStr = format(currentDay, 'EEE');
        const fullDayName = format(currentDay, 'EEEE');
        const dayData = dataMap.get(dayStr);
        fullWeekData.push({ date: fullDayName, income: dayData?.income || 0, expense: dayData?.expense || 0 });
      }
      return fullWeekData;
    }
  };

  const [allPeriodsData, setAllPeriodsData] = useState<Record<DashboardPeriod, any[]>>({
    day: [], week: [], month: [], year: []
  });

  useEffect(() => {
    const fetchChartData = async () => {
      let rawData: any[] = [];
      let totalExp = 0;

      try {
        const res = await daybookApi.getRange(startDate, endDate);
        rawData = res.data?.chartData || res.data?.dailyBreakdown || [];
        totalExp = res.data?.totalExpense !== undefined 
          ? res.data.totalExpense 
          : rawData.reduce((sum: number, d: any) => sum + (d.expense || 0), 0);
      } catch (err) {
        // Fallback: Compute chart data directly from filteredBills and loaded expenses
        const dailyMap = new Map<string, { date: string; income: number; expense: number }>();
        filteredBills.forEach(b => {
          const d = format(new Date(b.createdAt || new Date()), 'yyyy-MM-dd');
          const amt = Number(b.finalAmount || b.amountPaid || 0);
          const curr = dailyMap.get(d) || { date: d, income: 0, expense: 0 };
          curr.income += amt;
          dailyMap.set(d, curr);
        });
        expenses.forEach(e => {
          const d = e.date ? format(new Date(e.date), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');
          const amt = Number(e.amount || 0);
          totalExp += amt;
          const curr = dailyMap.get(d) || { date: d, income: 0, expense: 0 };
          curr.expense += amt;
          dailyMap.set(d, curr);
        });
        rawData = Array.from(dailyMap.values());
      }

      setTotalExpenseAmount(totalExp);
      const start = startOfDay(new Date(startDate));

      const dayData = aggregateChartData('day', rawData, start);
      const weekData = aggregateChartData('week', rawData, start);
      const monthData = aggregateChartData('month', rawData, start);
      const yearData = aggregateChartData('year', rawData, start);

      setAllPeriodsData({ day: dayData, week: weekData, month: monthData, year: yearData });

      // Update the main chart view
      if (dashboardView === 'day') setChartDataFetched(dayData);
      else if (dashboardView === 'week') setChartDataFetched(weekData);
      else if (dashboardView === 'month') setChartDataFetched(monthData);
      else if (dashboardView === 'year') setChartDataFetched(yearData);
    };
    fetchChartData();
  }, [dashboardView, startDate, endDate, filteredBills, expenses]);



  // KPIs
  const { totalRevenue, totalTransactions, totalProfit, totalCOGS } = useMemo(() => {
    let rev = 0;
    let profit = 0;
    let cogs = 0;

    // Create a product map for quick lookup using ALL products
    const combinedProducts = products;
    const productMap = new Map(combinedProducts.map(p => [p.name, p]));
    const productIdMap = new Map(combinedProducts.map(p => [p.id, p]));

    filteredBills.forEach(bill => {
      const finalAmt = bill.finalAmount || bill.amountPaid || 0;
      rev += finalAmt;

      // Estimate profit and COGS
      let billCost = 0;
      bill.items?.forEach(item => {
        const prod = productIdMap.get(item.productId) || productMap.get(item.productName);
        if (prod) {
          billCost += (prod.purchaseRate || 0) * item.quantity;
        } else {
          // rough estimate if product not found (30% margin)
          billCost += item.unitPrice * item.quantity * 0.7;
        }
      });
      cogs += billCost;
      profit += (finalAmt - billCost);
    });

    return {
      totalRevenue: rev,
      totalTransactions: filteredBills.length,
      totalProfit: Math.abs(profit) < 0.01 ? 0 : profit,
      totalCOGS: Math.abs(cogs) < 0.01 ? 0 : cogs
    };
  }, [filteredBills, filteredProducts]);

  // Transaction Stats for Dropdown
  const txStats = useMemo(() => {
    let upi = 0, cash = 0, card = 0, split = 0, partial = 0;
    filteredBills.forEach(b => {
      const method = (b.paymentMethod || 'Cash').toLowerCase();
      if (method.includes('upi') || method.includes('online')) upi++;
      else if (method.includes('split') || method.includes('mixed')) split++;
      else if (method.includes('card')) card++;
      else if (method.includes('partial')) partial++;
      else cash++;
    });
    return { upi, cash, card, split, partial };
  }, [filteredBills]);

  // Staff Performance Analytics
  const staffPerformance = useMemo(() => {
    const staffMap = new Map<string, any>();

    // 1. Pre-populate strictly with all registered staff from database
    (staff || []).forEach((s: any) => {
      const id = s.id || '';
      if (!id) return;
      staffMap.set(id, {
        id,
        name: s.name || s.id,
        role: s.role || 'Staff Member',
        phone: s.phone || 'N/A',
        profilePicUrl: s.profilePicUrl,
        active: s.active ?? s.isActive ?? true,
        baseSalary: s.baseSalary || 0,
        invoicesCount: 0,
        itemsSold: 0,
        totalRevenue: 0,
        totalCommission: 0,
        paidCommission: 0,
        unpaidCommission: 0,
        avgBillValue: 0,
        bills: []
      });
    });

    // 2. Iterate filteredBills and attribute strictly to registered staff
    filteredBills.forEach((bill: any) => {
      if (bill.status === 'CANCELLED' || bill.status === 'HOLD') return;

      const staffId = bill.staffId;
      if (!staffId) return;

      const entry = staffMap.get(staffId);
      if (!entry) return;

      const billRev = bill.finalAmount || bill.amountPaid || 0;
      const units = bill.items?.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0) || 0;

      // Commission calculation: direct staffCommissionAmount or from percentage
      let commAmt = 0;
      if (bill.staffCommissionAmount !== undefined && bill.staffCommissionAmount !== null && Number(bill.staffCommissionAmount) > 0) {
        commAmt = Number(bill.staffCommissionAmount);
      } else if (bill.staffCommissionPercentage !== undefined && bill.staffCommissionPercentage !== null && Number(bill.staffCommissionPercentage) > 0) {
        commAmt = (billRev * Number(bill.staffCommissionPercentage)) / 100;
      }

      entry.invoicesCount += 1;
      entry.itemsSold += units;
      entry.totalRevenue += billRev;
      entry.totalCommission += commAmt;
      if (bill.staffCommissionStatus === 'PAID') {
        entry.paidCommission += commAmt;
      } else {
        entry.unpaidCommission += commAmt;
      }
      entry.bills.push(bill);
    });

    // 3. Compute average bill value & sort by revenue
    const list = Array.from(staffMap.values()).map(item => ({
      ...item,
      avgBillValue: item.invoicesCount > 0 ? item.totalRevenue / item.invoicesCount : 0
    }));

    return list.sort((a, b) => b.totalRevenue - a.totalRevenue || b.invoicesCount - a.invoicesCount);
  }, [staff, filteredBills]);

  const top5Staff = useMemo(() => {
    return staffPerformance
      .filter(s => s.invoicesCount > 0 || s.totalRevenue > 0)
      .slice(0, 5);
  }, [staffPerformance]);

  const staffChartData = useMemo(() => {
    return staffPerformance
      .filter(s => s.invoicesCount > 0 || s.totalRevenue > 0)
      .slice(0, 8)
      .map(s => ({
        name: s.name,
        revenue: Math.round(s.totalRevenue),
        invoices: s.invoicesCount,
        commission: Math.round(s.totalCommission),
        itemsSold: s.itemsSold,
        role: s.role,
        id: s.id
      }));
  }, [staffPerformance]);

  const availableStaffRoles = useMemo(() => {
    const roles = new Set<string>();
    staffPerformance.forEach(s => {
      if (s.role) roles.add(s.role);
    });
    return Array.from(roles);
  }, [staffPerformance]);

  const filteredStaffList = useMemo(() => {
    return staffPerformance.filter(s => {
      const q = staffSearch.toLowerCase();
      const matchesSearch =
        s.name.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q) ||
        s.phone.toLowerCase().includes(q) ||
        s.role.toLowerCase().includes(q);
      const matchesRole = selectedStaffRole === 'ALL' || s.role === selectedStaffRole;
      return matchesSearch && matchesRole;
    });
  }, [staffPerformance, staffSearch, selectedStaffRole]);

  const totalStaffRevenue = useMemo(() => {
    return staffPerformance.reduce((acc, s) => acc + s.totalRevenue, 0);
  }, [staffPerformance]);

  const totalStaffCommissions = useMemo(() => {
    return staffPerformance.reduce((acc, s) => acc + s.totalCommission, 0);
  }, [staffPerformance]);

  const activeStaffCount = useMemo(() => {
    return staffPerformance.filter(s => s.invoicesCount > 0).length;
  }, [staffPerformance]);

  // Keep lowStockProducts independent of productPerformance
  const lowStockProducts = useMemo(() => {
    return (products || []).filter((p: any) => {
      const stock = p.stockQuantity ?? p.stock ?? 0;
      return Number(stock) <= 5;
    }).map((p: any) => ({
      id: p.id || '',
      name: p.name || 'Unnamed',
      category: p.category || 'N/A',
      vendorName: p.vendorName || p.weaverName || 'N/A',
      vendorId: p.vendorId || p.weaverId || 'N/A',
      purchaseRate: p.purchaseRate || 0,
      sellingPrice: p.sellingPrice || 0,
      stock: p.stockQuantity ?? p.stock ?? 0,
      purchaseDate: p.purchaseDate || p.createdAt || '',
      qtySold: 0
    }));
  }, [products]);



  // Helper to calculate pie data
  const getPieDataForRange = (start: Date, end: Date, overrideExpense?: number) => {
    let revenue = 0;
    let cogs = 0;

    const filteredRangeBills = bills.filter(bill => {
      if (bill.status === 'CANCELLED' || bill.status === 'HOLD') return false;
      const billDate = new Date(bill.createdAt || new Date());
      return billDate >= start && billDate <= end;
    });

    const combinedProducts = products;
    const productMap = new Map(combinedProducts.map(p => [p.name, p]));
    const productIdMap = new Map(combinedProducts.map(p => [p.id, p]));

    filteredRangeBills.forEach(bill => {
      revenue += (bill.finalAmount || bill.amountPaid || 0);
      bill.items?.forEach(item => {
        const prod = productIdMap.get(item.productId) || productMap.get(item.productName);
        cogs += prod ? ((prod.purchaseRate || 0) * item.quantity) : (item.unitPrice * item.quantity * 0.7);
      });
    });

    const filteredRangeExpenses = expenses.filter((entry: any) => {
      const dateStr = entry.date || entry.createdAt;
      if (!dateStr) return false;
      const expenseDate = new Date(dateStr);
      return !isNaN(expenseDate.getTime()) && expenseDate >= start && expenseDate <= end;
    });

    const profit = revenue - cogs;
    const expenseAmount = overrideExpense !== undefined ? overrideExpense : filteredRangeExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

    return [
      { name: 'Revenue', value: revenue, color: '#3b82f6' },
      { name: 'Profit', value: profit, color: '#10b981' },
      { name: 'Cost of Goods', value: cogs, color: '#facc15' },
      { name: 'Expenses', value: expenseAmount, color: '#ef4444' }
    ];
  };

  const pieData = useMemo(() => {
    return getPieDataForRange(startOfDay(new Date(startDate)), endOfDay(new Date(endDate)), totalExpenseAmount);
  }, [bills, expenses, products, startDate, endDate, totalExpenseAmount]);

  const allPieData = useMemo(() => {
    const now = new Date();
    return {
      day: getPieDataForRange(startOfWeek(now, { weekStartsOn: 1 }), endOfWeek(now, { weekStartsOn: 1 })),
      week: getPieDataForRange(startOfMonth(now), endOfMonth(now)),
      month: getPieDataForRange(startOfMonth(now), endOfMonth(now)),
      year: getPieDataForRange(startOfYear(now), endOfYear(now))
    };
  }, [bills, expenses, products]);



  const handleDownloadReport = async () => {
    const element = document.getElementById("report-container");
    if (!element) return;

    // Temporarily make it visible for capture (off-screen)
    element.style.display = "block";
    element.style.position = "absolute";
    element.style.left = "-9999px";
    element.style.top = "0";

    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      windowWidth: 1200 // Ensure consistent width for report
    });

    element.style.display = "none";

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");

    const imgWidth = 210;
    const pageHeight = 295;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(`Business_Dashboard_Report_${format(new Date(), 'yyyy-MM-dd')}.pdf`);

    toast({ title: "Success", description: "Report downloaded successfully" });
  };

  // Helper to aggregate data for report
  const getReportData = () => {
    // Current date range stats
    const reportKpis = [
      { label: 'Total Revenue', value: `₹${totalRevenue.toLocaleString()}` },
      { label: 'Total Profit', value: `₹${totalProfit.toLocaleString()}` },
      { label: 'Total Expense', value: `₹${totalExpenseAmount.toLocaleString()}` },
      { label: 'Total Transactions', value: totalTransactions },
      { label: 'Low Stock Count', value: lowStockProducts.length }
    ];

    // Top 5 Staff for report
    const topStaffReport = staffPerformance
      .filter(s => s.invoicesCount > 0 || s.totalRevenue > 0)
      .slice(0, 5)
      .map((s, i) => ({
      rank: i + 1,
      staffId: s.id,
      name: s.name,
      role: s.role,
      phone: s.phone,
      invoices: s.invoicesCount,
      unitsSold: s.itemsSold,
      revenue: `₹${s.totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
      commission: `₹${s.totalCommission.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
      avgBill: `₹${s.avgBillValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
    }));

    return { reportKpis, topStaffReport };
  };

  const { reportKpis, topStaffReport } = getReportData();

  if (loading && totalRevenue === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-slate-50 min-h-full space-y-6">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
          <p className="text-sm text-slate-500">Business performance and analytics</p>
        </div>
        <div className="flex gap-4 items-center">


          <div className="flex gap-3 items-center">
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-500 uppercase">From</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="border-slate-200 rounded-lg text-xs bg-slate-50 focus:ring-blue-500 px-3 py-1.5 border outline-none font-bold"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-slate-500 uppercase">To</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="border-slate-200 rounded-lg text-xs bg-slate-50 focus:ring-blue-500 px-3 py-1.5 border outline-none font-bold"
              />
            </div>
            <button
              onClick={handleDownloadReport}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
            >
              <Download size={16} /> Download Report
            </button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {/* Total Revenue */}
        <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm flex items-center justify-between hover:shadow-md transition">
          <div>
            <p className="text-xs font-medium text-slate-500">Total Revenue</p>
            <h3 className="text-xl font-bold text-slate-800">₹{totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</h3>
          </div>
          <div className="w-9 h-9 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center">
            <DollarSign size={18} />
          </div>
        </div>

        {/* Total Profit */}
        <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm flex items-center justify-between hover:shadow-md transition">
          <div>
            <p className="text-xs font-medium text-slate-500">Total Profit</p>
            <h3 className="text-xl font-bold text-slate-800">₹{totalProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })}</h3>
          </div>
          <div className="w-9 h-9 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center">
            <TrendingUp size={18} />
          </div>
        </div>

        {/* Total Expense */}
        <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm flex items-center justify-between hover:shadow-md transition">
          <div>
            <p className="text-xs font-medium text-slate-500">Total Expense</p>
            <h3 className="text-xl font-bold text-slate-800">₹{totalExpenseAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</h3>
          </div>
          <div className="w-9 h-9 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center">
            <TrendingDown size={18} />
          </div>
        </div>

        {/* Mode of Transactions */}
        <div className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm hover:shadow-md transition">
          <div className="flex items-start justify-between mb-1">
            <p className="text-xs font-medium text-slate-500">Transactions</p>
            <div className="w-9 h-9 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center">
              <ShoppingCart size={18} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
            <div className="flex items-center justify-between text-xs text-slate-600"><span>UPI:</span> <span className="font-bold">{txStats.upi}</span></div>
            <div className="flex items-center justify-between text-xs text-slate-600"><span>Cash:</span> <span className="font-bold">{txStats.cash}</span></div>
            <div className="flex items-center justify-between text-xs text-slate-600"><span>Card:</span> <span className="font-bold">{txStats.card}</span></div>
            <div className="flex items-center justify-between text-xs text-slate-600"><span>Split:</span> <span className="font-bold">{txStats.split}</span></div>
            <div className="flex items-center justify-between text-xs text-purple-600 font-bold"><span>Partial:</span> <span className="font-bold">{txStats.partial}</span></div>
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div
          className="bg-white p-3 rounded-lg border border-slate-100 shadow-sm flex items-center justify-between hover:shadow-md transition cursor-pointer"
          onClick={() => setIsLowStockModalOpen(true)}
        >
          <div>
            <p className="text-xs font-medium text-slate-500">Low Stock</p>
            <h3 className="text-xl font-bold text-slate-800">
              {lowStockProducts.length}
            </h3>
          </div>
          <div className={`w-9 h-9 rounded-full flex items-center justify-center ${(lowStockProducts.length) > 0 ? 'bg-amber-100 text-amber-600' : 'bg-slate-50 text-slate-400'}`}>
            <AlertTriangle size={18} />
          </div>
        </div>
      </div>

      <LowStockProductsModal
        isOpen={isLowStockModalOpen}
        onClose={() => setIsLowStockModalOpen(false)}
        lowStockProducts={lowStockProducts}
      />

      {/* Time Range Toggle Row */}
      <div className="flex justify-end mb-4">
        <div className="flex flex-wrap bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-sm gap-1">
          {(['day', 'week', 'month', 'year'] as const).map(view => (
            <button
              key={view}
              onClick={() => setDashboardView(view)}
              className={`px-4 py-1.5 text-[10px] font-black rounded-lg transition-all ${dashboardView === view ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              {view.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm lg:col-span-2">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-slate-800 text-lg">Income vs Expenses</h3>
          </div>
          <div className="h-[300px]">
            {chartDataFetched.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 font-medium">
                No transactions for selected period
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartDataFetched} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} dy={10} angle={-45} textAnchor="end" height={60} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} tickFormatter={(v) => `₹${v / 1000}k`} dx={-10} />
                  <RechartsTooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} verticalAlign="top" />
                  <Bar dataKey="income" name="Income" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  <Bar dataKey="expense" name="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-800 text-lg">Revenue Distribution</h3>
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
              <span className="text-[10px] font-black text-blue-600 px-2 py-1 bg-white rounded shadow-sm">SYNCED VIEW</span>
            </div>
          </div>
          <div className="h-[300px] flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} innerRadius={65} outerRadius={85} paddingAngle={4} dataKey="value" stroke="none">
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip formatter={(value) => `₹${Number(value).toLocaleString()}`} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 10px rgb(0 0 0 / 0.1)' }} />
                <Legend verticalAlign="bottom" height={40} iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Staff Performance Leaderboard */}
      <div className="grid grid-cols-1 gap-6">

        {/* Top Performing Staff Table */}
        <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
            <div>
              <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                <Award size={22} className="text-amber-500" />
                Top Performing Staff Leaderboard
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Staff ranked by sales revenue and bills handled in selected period
              </p>
            </div>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200 shadow-sm flex items-center gap-1.5">
              <Trophy size={14} className="text-amber-500" />
              Top Sales Champions
            </span>
          </div>

          <div className="overflow-x-auto max-h-[420px] custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-white shadow-sm z-10">
                <tr className="text-[10px] text-slate-400 uppercase tracking-widest border-b border-slate-100 bg-slate-50">
                  <th className="p-3 font-bold text-center">Rank</th>
                  <th className="p-3 font-bold">Staff Member</th>
                  <th className="p-3 font-bold">Role</th>
                  <th className="p-3 font-bold">Contact</th>
                  <th className="p-3 font-bold text-center">Invoices Handled</th>
                  <th className="p-3 font-bold text-center">Units Sold</th>
                  <th className="p-3 font-bold whitespace-nowrap">Sales Revenue</th>
                  <th className="p-3 font-bold whitespace-nowrap">Commission</th>
                  <th className="p-3 font-bold whitespace-nowrap">Avg Invoice</th>
                  <th className="p-3 font-bold text-center">Revenue Share</th>
                  <th className="p-3 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {top5Staff.map((s, i) => {
                  let badge = "";
                  if (i === 0) badge = "🥇 Rank 1";
                  else if (i === 1) badge = "🥈 Rank 2";
                  else if (i === 2) badge = "🥉 Rank 3";
                  else badge = `#${i + 1}`;

                  let badgeClasses = "inline-flex items-center justify-center font-black px-2.5 py-1 rounded-full shadow-sm text-xs whitespace-nowrap border ";
                  if (i === 0) badgeClasses += "bg-amber-100 text-amber-900 border-amber-300";
                  else if (i === 1) badgeClasses += "bg-slate-200 text-slate-800 border-slate-300";
                  else if (i === 2) badgeClasses += "bg-orange-100 text-orange-900 border-orange-300";
                  else badgeClasses += "bg-slate-50 text-slate-600 border-slate-200";

                  const isTop3 = i < 3;
                  const sharePct = totalStaffRevenue > 0 ? (s.totalRevenue / totalStaffRevenue) * 100 : 0;

                  return (
                    <tr
                      key={s.id || i}
                      onClick={() => setSelectedStaffDetails(s)}
                      className={`group cursor-pointer transition-colors ${isTop3 ? 'bg-amber-50/20 hover:bg-amber-50/60' : 'hover:bg-slate-50/50'}`}
                    >
                      <td className="p-3 text-center">
                        <span className={badgeClasses} title={`Rank ${i + 1}`}>
                          {badge}
                        </span>
                      </td>
                      <td className="p-3 min-w-[180px]">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 text-white font-bold flex items-center justify-center text-xs shadow-sm flex-shrink-0 overflow-hidden">
                            {s.profilePicUrl ? (
                              <img src={s.profilePicUrl} alt={s.name} className="w-full h-full object-cover" />
                            ) : (
                              s.name.slice(0, 2).toUpperCase()
                            )}
                          </div>
                          <div>
                            <p className="font-black text-slate-800 text-sm leading-tight group-hover:text-blue-600 transition-colors">
                              {s.name}
                            </p>
                            <p className="text-[10px] font-mono font-bold text-slate-400 mt-0.5">
                              ID: {s.id}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          {s.role}
                        </span>
                      </td>
                      <td className="p-3 text-xs font-bold text-slate-500 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1">
                          <Phone size={12} className="text-slate-400" />
                          {s.phone}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <span className="text-xs font-black text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100/60 inline-block">
                          {s.invoicesCount} Bills
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg inline-block">
                          {s.itemsSold}
                        </span>
                      </td>
                      <td className="p-3 text-sm font-black text-slate-900 whitespace-nowrap">
                        ₹{s.totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-xs font-bold whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-1 rounded-lg text-emerald-700 bg-emerald-50 border border-emerald-200 font-bold">
                          ₹{s.totalCommission.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="p-3 text-xs font-bold text-slate-600 whitespace-nowrap">
                        ₹{s.avgBillValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </td>
                      <td className="p-3 min-w-[120px]">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-blue-600 h-full rounded-full transition-all duration-500"
                              style={{ width: `${Math.min(100, Math.max(0, sharePct))}%` }}
                            />
                          </div>
                          <span className="text-[11px] font-bold text-slate-600">{sharePct.toFixed(1)}%</span>
                        </div>
                      </td>
                      <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setSelectedStaffDetails(s)}
                          className="px-3 py-1.5 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors inline-flex items-center gap-1"
                        >
                          <Eye size={13} />
                          Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {top5Staff.length === 0 && (
                  <tr>
                    <td colSpan={11} className="p-8 text-center text-slate-400 font-medium">
                      No staff performance data recorded for this period
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Staff Performance Details Modal */}
      {selectedStaffDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[2rem] shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
          >
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/70">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-black flex items-center justify-center text-xl shadow-md overflow-hidden">
                  {selectedStaffDetails.profilePicUrl ? (
                    <img src={selectedStaffDetails.profilePicUrl} alt={selectedStaffDetails.name} className="w-full h-full object-cover" />
                  ) : (
                    selectedStaffDetails.name.slice(0, 2).toUpperCase()
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-black text-slate-900">{selectedStaffDetails.name}</h2>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700">
                      {selectedStaffDetails.role}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-bold text-slate-500 mt-1">
                    <span className="font-mono text-slate-400">ID: {selectedStaffDetails.id}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Phone size={12} /> {selectedStaffDetails.phone}
                    </span>
                    {selectedStaffDetails.baseSalary > 0 && (
                      <>
                        <span>•</span>
                        <span>Base Salary: ₹{selectedStaffDetails.baseSalary.toLocaleString()}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedStaffDetails(null)}
                className="w-10 h-10 flex items-center justify-center bg-white border border-slate-200 rounded-full text-slate-400 hover:text-rose-500 hover:border-rose-100 transition-all hover:rotate-90"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Metric Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-blue-50/60 p-4 rounded-2xl border border-blue-100">
                  <p className="text-[10px] uppercase font-black text-blue-600">Total Sales Revenue</p>
                  <p className="text-xl font-black text-slate-900 mt-1">
                    ₹{selectedStaffDetails.totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <p className="text-[10px] uppercase font-black text-slate-400">Invoices Handled</p>
                  <p className="text-xl font-black text-slate-800 mt-1">{selectedStaffDetails.invoicesCount}</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <p className="text-[10px] uppercase font-black text-slate-400">Total Units Sold</p>
                  <p className="text-xl font-black text-slate-800 mt-1">{selectedStaffDetails.itemsSold}</p>
                </div>
                <div className="bg-emerald-50/60 p-4 rounded-2xl border border-emerald-100">
                  <p className="text-[10px] uppercase font-black text-emerald-600">Total Commission</p>
                  <p className="text-xl font-black text-emerald-700 mt-1">
                    ₹{selectedStaffDetails.totalCommission.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </p>
                  <p className="text-[10px] text-emerald-600 font-bold mt-0.5">
                    Paid: ₹{selectedStaffDetails.paidCommission.toLocaleString()} | Unpaid: ₹{selectedStaffDetails.unpaidCommission.toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Bills Handled by this Staff */}
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
                    <FileText size={16} className="text-blue-500" />
                    Invoices Handled ({selectedStaffDetails.bills?.length || 0})
                  </h3>
                  <span className="text-xs font-bold text-slate-500">
                    Period: {format(new Date(startDate), 'dd MMM')} - {format(new Date(endDate), 'dd MMM yyyy')}
                  </span>
                </div>
                <div className="max-h-[340px] overflow-y-auto custom-scrollbar">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="sticky top-0 bg-white shadow-sm z-10 text-[10px] text-slate-400 uppercase tracking-widest border-b border-slate-100">
                      <tr>
                        <th className="p-3">Invoice #</th>
                        <th className="p-3">Date</th>
                        <th className="p-3">Customer</th>
                        <th className="p-3">Items</th>
                        <th className="p-3">Payment</th>
                        <th className="p-3 text-right">Amount</th>
                        <th className="p-3 text-right">Commission</th>
                        <th className="p-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {selectedStaffDetails.bills?.map((b: any, idx: number) => {
                        const billTotal = b.finalAmount || b.amountPaid || 0;
                        let comm = 0;
                        if (b.staffCommissionAmount !== undefined && b.staffCommissionAmount !== null && Number(b.staffCommissionAmount) > 0) {
                          comm = Number(b.staffCommissionAmount);
                        } else if (b.staffCommissionPercentage) {
                          comm = (billTotal * b.staffCommissionPercentage) / 100;
                        }

                        return (
                          <tr key={b.id || idx} className="hover:bg-blue-50/20 transition-colors">
                            <td className="p-3 font-mono font-bold text-blue-600">
                              {b.invoiceNumber || b.invoiceId || b.id?.slice(-8) || `BILL-${idx + 1}`}
                            </td>
                            <td className="p-3 text-slate-500 whitespace-nowrap">
                              {b.createdAt ? format(new Date(b.createdAt), 'dd MMM yyyy, hh:mm a') : 'N/A'}
                            </td>
                            <td className="p-3 font-bold text-slate-800">
                              <div>{b.customerName || 'Walk-in Customer'}</div>
                              {b.customerPhone && <div className="text-[10px] text-slate-400 font-normal">PH: {b.customerPhone}</div>}
                            </td>
                            <td className="p-3">
                              <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-bold">
                                {b.items?.length || 0} items
                              </span>
                            </td>
                            <td className="p-3 text-slate-600 font-bold uppercase text-[11px]">
                              {b.paymentMethod || 'Cash'}
                            </td>
                            <td className="p-3 text-right font-black text-slate-900">
                              ₹{billTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                            </td>
                            <td className="p-3 text-right font-bold text-emerald-600">
                              ₹{comm.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                            </td>
                            <td className="p-3 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                b.status === 'PAID' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'
                              }`}>
                                {b.status || 'PAID'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                      {(!selectedStaffDetails.bills || selectedStaffDetails.bills.length === 0) && (
                        <tr>
                          <td colSpan={8} className="p-8 text-center text-slate-400 font-bold italic">
                            No bills found for this staff member in this date range
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedStaffDetails(null)}
                className="px-6 py-2 bg-slate-800 text-white rounded-xl font-bold text-xs hover:bg-slate-900 transition"
              >
                Close Details
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Staff Performance & Sales Comparison Chart */}
      <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-6">
          <div>
            <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
              <TrendingUp size={20} className="text-blue-500" />
              Staff Sales & Performance Comparison
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Comparative visualization of sales revenue, invoices completed, and commission earned
            </p>
          </div>
          <span className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
            Top 8 Contributors
          </span>
        </div>

        <div className="h-[360px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={staffChartData} layout="horizontal" margin={{ top: 10, right: 10, left: 10, bottom: 25 }}>
              <defs>
                <linearGradient id="colorStaffRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.9} />
                  <stop offset="95%" stopColor="#1d4ed8" stopOpacity={0.9} />
                </linearGradient>
                <linearGradient id="colorStaffComm" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.9} />
                  <stop offset="95%" stopColor="#059669" stopOpacity={0.9} />
                </linearGradient>
                <linearGradient id="colorStaffInvoices" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.9} />
                  <stop offset="95%" stopColor="#d97706" stopOpacity={0.9} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#475569', fontSize: 12, fontWeight: 600 }} dy={12} interval={0} angle={-15} textAnchor="end" />
              <YAxis yAxisId="left" orientation="left" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={(v) => `₹${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
              <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fill: '#f59e0b', fontSize: 11 }} tickFormatter={(v) => `${v} bills`} />
              <RechartsTooltip
                cursor={{ fill: '#f8fafc' }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xl min-w-[220px]">
                        <p className="font-bold text-slate-800 mb-2 border-b border-slate-100 pb-2 flex items-center justify-between">
                          <span className="text-sm">{data.name}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-bold">{data.role}</span>
                        </p>
                        <div className="space-y-1.5 text-xs">
                          <div className="flex justify-between items-center text-slate-600">
                            <span>Sales Revenue:</span>
                            <span className="font-black text-blue-600">₹{data.revenue.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between items-center text-slate-600">
                            <span>Invoices Handled:</span>
                            <span className="font-black text-amber-600">{data.invoices} bills</span>
                          </div>
                          <div className="flex justify-between items-center text-slate-600">
                            <span>Units Sold:</span>
                            <span className="font-bold text-slate-800">{data.itemsSold} items</span>
                          </div>
                          <div className="flex justify-between items-center text-slate-600 pt-1 border-t border-slate-100">
                            <span>Commission:</span>
                            <span className="font-black text-emerald-600">₹{data.commission.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '12px', fontWeight: 600 }} />
              <Bar yAxisId="left" dataKey="revenue" name="Sales Revenue (₹)" fill="url(#colorStaffRev)" radius={[4, 4, 0, 0]} barSize={18} />
              <Bar yAxisId="left" dataKey="commission" name="Commission (₹)" fill="url(#colorStaffComm)" radius={[4, 4, 0, 0]} barSize={18} />
              <Bar yAxisId="right" dataKey="invoices" name="Invoices Handled" fill="url(#colorStaffInvoices)" radius={[4, 4, 0, 0]} barSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Staff Performance & Sales Ledger Row */}
      <div className="pb-6">
        <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm font-sans">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-6">
            <div>
              <h3 className="font-bold text-slate-800 flex items-center gap-2 text-lg">
                <UserCheck size={22} className="text-indigo-600" />
                Staff Sales & Performance Ledger
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Comprehensive directory with invoices, revenue contributions, and commissions
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
              {/* Role filter */}
              <div className="relative">
                <select
                  value={selectedStaffRole}
                  onChange={(e) => setSelectedStaffRole(e.target.value)}
                  className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="ALL">All Roles ({staffPerformance.length})</option>
                  {availableStaffRoles.map(role => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
              </div>

              {/* Search input */}
              <div className="relative flex-1 sm:w-64">
                <input
                  type="text"
                  placeholder="Search staff by name, ID, phone..."
                  value={staffSearch}
                  onChange={(e) => setStaffSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none font-medium"
                />
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              </div>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
              <p className="text-[10px] uppercase font-bold text-slate-400">Total Staff</p>
              <p className="text-lg font-black text-slate-800 mt-0.5">{staffPerformance.length}</p>
            </div>
            <div className="bg-blue-50/50 p-3 rounded-lg border border-blue-100/60">
              <p className="text-[10px] uppercase font-bold text-blue-600">Active Sellers</p>
              <p className="text-lg font-black text-blue-700 mt-0.5">{activeStaffCount}</p>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
              <p className="text-[10px] uppercase font-bold text-slate-400">Attributed Sales</p>
              <p className="text-lg font-black text-slate-800 mt-0.5">₹{totalStaffRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            </div>
            <div className="bg-emerald-50/50 p-3 rounded-lg border border-emerald-100/60">
              <p className="text-[10px] uppercase font-bold text-emerald-600">Total Commissions</p>
              <p className="text-lg font-black text-emerald-700 mt-0.5">₹{totalStaffCommissions.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            </div>
          </div>

          {/* Full Ledger Table */}
          <div className="max-h-[500px] overflow-auto custom-scrollbar border border-slate-200 rounded-lg">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-slate-100 shadow-sm z-10">
                <tr className="text-slate-500 text-[10px] uppercase font-black tracking-widest border-b border-slate-200">
                  <th className="p-3.5 text-center">Rank</th>
                  <th className="p-3.5">Staff Details</th>
                  <th className="p-3.5">Role</th>
                  <th className="p-3.5">Contact</th>
                  <th className="p-3.5 text-center">Invoices</th>
                  <th className="p-3.5 text-center">Units Sold</th>
                  <th className="p-3.5 whitespace-nowrap">Total Sales (₹)</th>
                  <th className="p-3.5 whitespace-nowrap">Avg Sale (₹)</th>
                  <th className="p-3.5 whitespace-nowrap">Commission (₹)</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStaffList.map((s, idx) => {
                  const isTop3 = idx < 3 && s.totalRevenue > 0;
                  return (
                    <tr
                      key={s.id || idx}
                      onClick={() => setSelectedStaffDetails(s)}
                      className={`transition-colors group cursor-pointer ${isTop3 ? 'bg-amber-50/20 hover:bg-amber-50/50' : 'hover:bg-slate-50'}`}
                    >
                      <td className="p-3.5 text-center">
                        <span className={`inline-flex items-center justify-center font-black px-2.5 py-0.5 rounded-full text-[10px] border ${
                          idx === 0 && s.totalRevenue > 0 ? 'bg-amber-100 text-amber-900 border-amber-300' :
                          idx === 1 && s.totalRevenue > 0 ? 'bg-slate-200 text-slate-800 border-slate-300' :
                          idx === 2 && s.totalRevenue > 0 ? 'bg-orange-100 text-orange-900 border-orange-300' :
                          'bg-slate-50 text-slate-500 border-slate-200'
                        }`}>
                          #{idx + 1}
                        </span>
                      </td>
                      <td className="p-3.5 min-w-[170px]">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-xs flex-shrink-0 overflow-hidden">
                            {s.profilePicUrl ? (
                              <img src={s.profilePicUrl} alt={s.name} className="w-full h-full object-cover" />
                            ) : (
                              s.name.slice(0, 2).toUpperCase()
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-black text-slate-800 group-hover:text-blue-600 transition-colors">
                              {s.name}
                            </p>
                            <p className="text-[10px] font-mono text-slate-400 font-bold">
                              ID: {s.id}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3.5 text-xs font-bold text-slate-600">
                        <span className="inline-block px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-[11px]">
                          {s.role}
                        </span>
                      </td>
                      <td className="p-3.5 text-xs font-bold text-slate-500 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1">
                          <Phone size={12} className="text-slate-400" />
                          {s.phone}
                        </span>
                      </td>
                      <td className="p-3.5 text-center">
                        <span className="text-xs font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                          {s.invoicesCount}
                        </span>
                      </td>
                      <td className="p-3.5 text-center text-xs font-bold text-slate-700">
                        {s.itemsSold}
                      </td>
                      <td className="p-3.5 font-black text-slate-900 text-xs whitespace-nowrap">
                        ₹{s.totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </td>
                      <td className="p-3.5 text-xs font-bold text-slate-600 whitespace-nowrap">
                        ₹{s.avgBillValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </td>
                      <td className="p-3.5 text-xs font-bold whitespace-nowrap">
                        <span className="text-emerald-600 font-bold">
                          ₹{s.totalCommission.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </span>
                        {s.totalCommission > 0 && (
                          <div className="text-[9px] text-slate-400 font-medium">
                            Paid: ₹{s.paidCommission.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </div>
                        )}
                      </td>
                      <td className="p-3.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          s.active ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500 border border-slate-200'
                        }`}>
                          {s.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="p-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setSelectedStaffDetails(s)}
                          className="px-2.5 py-1 text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors inline-flex items-center gap-1"
                        >
                          <Eye size={13} />
                          Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filteredStaffList.length === 0 && (
                  <tr>
                    <td colSpan={11} className="p-8 text-center text-slate-400 font-medium">
                      No staff members match the selected filters
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {/* Hidden Report Container */}
      <div id="report-container" style={{ display: 'none', width: '1000px', backgroundColor: 'white', color: 'black', padding: '40px', fontFamily: 'Inter, sans-serif' }}>
        {/* Header Section */}
        <div style={{ textAlign: 'center', marginBottom: '40px', borderBottom: '2px solid #f1f5f9', paddingBottom: '20px' }}>
          <h1 style={{ fontSize: '32px', fontWeight: 'bold', margin: '0' }}>Business Dashboard Report</h1>
          <p style={{ color: '#64748b', marginTop: '10px', fontSize: '16px' }}>
            Period: {format(new Date(startDate), 'dd MMM yyyy')} - {format(new Date(endDate), 'dd MMM yyyy')}
          </p>
          <p style={{ color: '#94a3b8', fontSize: '14px' }}>
            Generated on: {format(new Date(), 'dd MMM yyyy, hh:mm a')}
          </p>
        </div>

        {/* Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '20px', marginBottom: '40px' }}>
          {reportKpis.map((kpi, i) => (
            <div key={i} style={{ padding: '20px', border: '1px solid #e2e8f0', borderRadius: '12px', textAlign: 'center', backgroundColor: '#f8fafc' }}>
              <p style={{ fontSize: '14px', color: '#64748b', fontWeight: 'medium', marginBottom: '8px' }}>{kpi.label}</p>
              <p style={{ fontSize: '20px', fontWeight: 'bold', color: '#1e293b' }}>{kpi.value}</p>
            </div>
          ))}
        </div>

        {/* Charts Sections */}
        {(['day', 'week', 'month', 'year'] as const).map((view) => (
          <div key={view} style={{ 
            marginBottom: '40px', 
            breakBefore: (view === 'month' || view === 'year') ? 'page' : 'auto',
            paddingTop: (view === 'month' || view === 'year') ? '20px' : '0' 
          }}>
            <h2 style={{ fontSize: '22px', fontWeight: 'bold', marginBottom: '20px', borderLeft: '4px solid #3b82f6', paddingLeft: '15px', color: '#1e293b', textTransform: 'capitalize' }}>
              {view === 'day' ? 'Daily' : view === 'week' ? 'Weekly' : view === 'month' ? 'Monthly' : 'Yearly'} Analytics
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div style={{ border: '1px solid #f1f5f9', borderRadius: '12px', padding: '15px', backgroundColor: '#fff' }}>
                <h3 style={{ fontSize: '13px', fontWeight: 'bold', textAlign: 'center', marginBottom: '10px' }}>Revenue vs Expenses</h3>
                <BarChart width={440} height={220} data={allPeriodsData[view]} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{fontSize: 9}} />
                  <YAxis tick={{fontSize: 9}} tickFormatter={(v) => `₹${v/1000}k`} />
                  <Bar dataKey="income" name="Income" fill="#10b981" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="expense" name="Expenses" fill="#ef4444" radius={[3, 3, 0, 0]} />
                </BarChart>
              </div>
              <div style={{ border: '1px solid #f1f5f9', borderRadius: '12px', padding: '15px', backgroundColor: '#fff' }}>
                <h3 style={{ fontSize: '13px', fontWeight: 'bold', textAlign: 'center', marginBottom: '10px' }}>Revenue Distribution</h3>
                <PieChart width={440} height={220}>
                  <Pie data={allPieData[view]} innerRadius={35} outerRadius={65} dataKey="value" stroke="#fff" strokeWidth={2}>
                    {allPieData[view].map((entry: any, index: number) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                  </Pie>
                  <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{fontSize: '9px'}} />
                </PieChart>
              </div>
            </div>
          </div>
        ))}

        {/* Staff Performance Overview Graph */}
        <div style={{ marginBottom: '40px', breakBefore: 'page', paddingTop: '20px' }}>
          <h2 style={{ fontSize: '22px', fontWeight: 'bold', marginBottom: '20px', borderLeft: '4px solid #6366f1', paddingLeft: '15px', color: '#1e293b' }}>
            Staff Performance Overview (Revenue & Commission)
          </h2>
          <div style={{ border: '1px solid #f1f5f9', borderRadius: '12px', padding: '20px', backgroundColor: '#fff' }}>
            <BarChart width={900} height={350} data={staffChartData.slice(0, 8)} margin={{ top: 10, right: 10, left: 10, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" interval={0} angle={-20} textAnchor="end" tick={{fontSize: 10, fontWeight: 600}} dy={15} />
              <YAxis tick={{fontSize: 10}} />
              <Bar dataKey="revenue" name="Sales Revenue (₹)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="commission" name="Commission (₹)" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Legend verticalAlign="top" align="right" wrapperStyle={{paddingBottom: '20px', fontSize: '12px'}} />
            </BarChart>
          </div>
        </div>

        {/* Top Performing Staff */}
        <div style={{ marginBottom: '40px', breakBefore: 'page' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '20px', borderLeft: '4px solid #10b981', paddingLeft: '15px' }}>Top Performing Staff</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
            <thead style={{ backgroundColor: '#f8fafc', textAlign: 'left', fontSize: '10px', textTransform: 'uppercase' }}>
              <tr>
                <th style={{ padding: '10px', borderBottom: '1px solid #e2e8f0' }}>Rank</th>
                <th style={{ padding: '10px', borderBottom: '1px solid #e2e8f0' }}>Staff ID</th>
                <th style={{ padding: '10px', borderBottom: '1px solid #e2e8f0' }}>Staff Name</th>
                <th style={{ padding: '10px', borderBottom: '1px solid #e2e8f0' }}>Role</th>
                <th style={{ padding: '10px', borderBottom: '1px solid #e2e8f0' }}>Phone</th>
                <th style={{ padding: '10px', borderBottom: '1px solid #e2e8f0', textAlign: 'center' }}>Invoices</th>
                <th style={{ padding: '10px', borderBottom: '1px solid #e2e8f0', textAlign: 'center' }}>Units Sold</th>
                <th style={{ padding: '10px', borderBottom: '1px solid #e2e8f0' }}>Total Sales (₹)</th>
                <th style={{ padding: '10px', borderBottom: '1px solid #e2e8f0' }}>Commission (₹)</th>
                <th style={{ padding: '10px', borderBottom: '1px solid #e2e8f0' }}>Avg Invoice (₹)</th>
              </tr>
            </thead>
            <tbody style={{ fontSize: '10px' }}>
              {topStaffReport.map((s, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px' }}>#{s.rank}</td>
                  <td style={{ padding: '10px', fontFamily: 'monospace' }}>{s.staffId}</td>
                  <td style={{ padding: '10px', fontWeight: 'bold' }}>{s.name}</td>
                  <td style={{ padding: '10px' }}>{s.role}</td>
                  <td style={{ padding: '10px' }}>{s.phone}</td>
                  <td style={{ padding: '10px', textAlign: 'center', fontWeight: 'bold' }}>{s.invoices}</td>
                  <td style={{ padding: '10px', textAlign: 'center' }}>{s.unitsSold}</td>
                  <td style={{ padding: '10px', fontWeight: 'bold', color: '#1e293b' }}>{s.revenue}</td>
                  <td style={{ padding: '10px', fontWeight: 'bold', color: '#059669' }}>{s.commission}</td>
                  <td style={{ padding: '10px' }}>{s.avgBill}</td>
                </tr>
              ))}
              {topStaffReport.length === 0 && (
                <tr>
                  <td colSpan={10} style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>No staff performance data available</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Low Stock Products Section */}
        <div style={{ marginBottom: '50px', breakBefore: 'page' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '20px', borderLeft: '4px solid #ef4444', paddingLeft: '15px', color: '#1e293b' }}>
            Low Stock Products Details
          </h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
            <thead style={{ backgroundColor: '#fef2f2' }}>
              <tr style={{ textAlign: 'left', fontSize: '9px', textTransform: 'uppercase', color: '#64748b' }}>
                <th style={{ padding: '8px', borderBottom: '1px solid #e2e8f0' }}>S.No</th>
                <th style={{ padding: '8px', borderBottom: '1px solid #e2e8f0' }}>Date</th>
                <th style={{ padding: '8px', borderBottom: '1px solid #e2e8f0' }}>Supplier Name</th>
                <th style={{ padding: '8px', borderBottom: '1px solid #e2e8f0' }}>Supplier ID</th>
                <th style={{ padding: '8px', borderBottom: '1px solid #e2e8f0' }}>Product Name</th>
                <th style={{ padding: '8px', borderBottom: '1px solid #e2e8f0' }}>Series</th>
                <th style={{ padding: '8px', borderBottom: '1px solid #e2e8f0' }}>Product ID</th>
                <th style={{ padding: '8px', borderBottom: '1px solid #e2e8f0' }}>Category</th>
                <th style={{ padding: '8px', borderBottom: '1px solid #e2e8f0' }}>Purchase Price</th>
                <th style={{ padding: '8px', borderBottom: '1px solid #e2e8f0' }}>Total Qty</th>
                <th style={{ padding: '8px', borderBottom: '1px solid #e2e8f0' }}>Sold Out (qty sold)</th>
                <th style={{ padding: '8px', borderBottom: '1px solid #e2e8f0' }}>Available Stock</th>
              </tr>
            </thead>
            <tbody style={{ fontSize: '9px' }}>
              {lowStockProducts.map((p, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: p.stock === 0 ? '#fff1f2' : 'transparent' }}>
                  <td style={{ padding: '8px' }}>{i + 1}</td>
                  <td style={{ padding: '8px' }}>{p.purchaseDate ? format(new Date(p.purchaseDate), 'dd MMM yyyy') : 'N/A'}</td>
                  <td style={{ padding: '8px' }}>{p.vendorName || 'N/A'}</td>
                  <td style={{ padding: '8px', fontFamily: 'monospace' }}>#{p.vendorId?.slice(-8) || 'N/A'}</td>
                  <td style={{ padding: '8px', fontWeight: 'bold' }}>{p.name}</td>
                  <td style={{ padding: '8px' }}>#{p.hashtagNumber || 'N/A'}</td>
                  <td style={{ padding: '8px', fontFamily: 'monospace' }}>{p.id}</td>
                  <td style={{ padding: '8px' }}>{p.category || 'N/A'}</td>
                  <td style={{ padding: '8px' }}>₹{p.purchaseRate.toLocaleString()}</td>
                  <td style={{ padding: '8px' }}>{(p.qtySold || 0) + (p.stock || 0)}</td>
                  <td style={{ padding: '8px', color: '#059669', fontWeight: 'bold' }}>{p.qtySold || 0}</td>
                  <td style={{ padding: '8px', color: '#ef4444', fontWeight: 'bold' }}>{p.stock}</td>
                </tr>
              ))}
              {lowStockProducts.length === 0 && <tr><td colSpan={10} style={{ padding: '20px', textAlign: 'center', color: '#94a3b8' }}>No low stock products</td></tr>}
            </tbody>
          </table>
        </div>


      </div>
    </div>
  );
};

export default DashboardOverview;

