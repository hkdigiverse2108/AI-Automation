'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuthStore } from '../../../lib/store';
import api from '../../../lib/api';
import { getSocket } from '../../../lib/socket';
import toast from 'react-hot-toast';
import {
  Wallet, IndianRupee, ArrowUpRight, ArrowDownLeft, Plus, RefreshCw,
  QrCode, CreditCard, ShieldCheck, AlertTriangle, CheckCircle, XCircle,
  Clock, Search, Filter, Download, ExternalLink, Sparkles, TrendingUp,
  Receipt, Building, Eye, ChevronRight, X, UploadCloud, Info
} from 'lucide-react';

const QUICK_AMOUNTS = [500, 1000, 2500, 5000, 10000];

export default function FundManagementPage() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'passbook' | 'analytics' | 'rates' | 'admin'
  const [loading, setLoading] = useState(true);
  const [balanceData, setBalanceData] = useState({ balance: 0, currency: 'INR', lowBalanceThreshold: 100 });
  const [stats, setStats] = useState({ todaySpend: 0, monthSpend: 0, totalCredited: 0, totalDebited: 0, categoryBreakdown: {} });
  const [rates, setRates] = useState({ marketing: 0.85, utility: 0.15, authentication: 0.15, service: 0.35, currency: 'INR' });
  const [transactions, setTransactions] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, pages: 1 });
  
  // Filters for Passbook
  const [filterType, setFilterType] = useState(''); // '' | 'credit' | 'debit'
  const [filterCategory, setFilterCategory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [showRechargeModal, setShowRechargeModal] = useState(false);
  const [rechargeMode, setRechargeMode] = useState('razorpay'); // 'razorpay' | 'upi_qr'
  const [rechargeAmount, setRechargeAmount] = useState(1000);
  const [customAmount, setCustomAmount] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [upiForm, setUpiForm] = useState({ utrNumber: '', notes: '', screenshot: null, screenshotUrl: '' });
  const [uploadingScreenshot, setUploadingScreenshot] = useState(false);
  
  // Transaction Details Drawer
  const [selectedTxn, setSelectedTxn] = useState(null);

  // SuperAdmin Data
  const [pendingTopups, setPendingTopups] = useState([]);
  const [allWallets, setAllWallets] = useState([]);
  const [adminActionLoading, setAdminActionLoading] = useState(false);
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [adjustmentForm, setAdjustmentForm] = useState({ organizationId: '', type: 'credit', amount: '', reason: '' });

  // 1. Fetch Balance & Stats
  const fetchWalletOverview = useCallback(async () => {
    try {
      const [balRes, statsRes, ratesRes] = await Promise.all([
        api.get('/wallet/balance'),
        api.get('/wallet/stats'),
        api.get('/wallet/rates')
      ]);
      if (balRes.data?.success) setBalanceData(balRes.data.data);
      if (statsRes.data?.success) setStats(statsRes.data.data);
      if (ratesRes.data?.success) setRates(ratesRes.data.data);
    } catch (err) {
      console.error('Failed to load wallet overview:', err);
    }
  }, []);

  // 2. Fetch Transactions (Ledger)
  const fetchTransactions = useCallback(async (page = 1) => {
    try {
      const params = {
        page,
        limit: 15,
        type: filterType || undefined,
        category: filterCategory || undefined,
        search: searchQuery || undefined
      };
      const res = await api.get('/wallet/transactions', { params });
      if (res.data?.success) {
        setTransactions(res.data.data.transactions);
        setPagination(res.data.data.pagination);
      }
    } catch (err) {
      console.error('Failed to load transactions:', err);
    }
  }, [filterType, filterCategory, searchQuery]);

  // 3. Fetch Admin Data (if superadmin/admin)
  const fetchAdminData = useCallback(async () => {
    if (user?.role !== 'superadmin' && user?.role !== 'admin') return;
    try {
      const pendingRes = await api.get('/wallet/admin/pending-topups');
      if (pendingRes.data?.success) setPendingTopups(pendingRes.data.data);

      if (user?.role === 'superadmin') {
        const walletsRes = await api.get('/wallet/admin/all-wallets');
        if (walletsRes.data?.success) setAllWallets(walletsRes.data.data);
      }
    } catch (err) {
      console.error('Failed to load admin wallet data:', err);
    }
  }, [user?.role]);

  // Initial Load
  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      await Promise.all([fetchWalletOverview(), fetchTransactions(1), fetchAdminData()]);
      setLoading(false);
    };
    loadAll();
  }, [fetchWalletOverview, fetchTransactions, fetchAdminData]);

  // Real-time Socket.io updates
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleBalanceUpdate = (data) => {
      fetchWalletOverview();
      fetchTransactions(pagination.page);
      toast.success(
        data.type === 'credit'
          ? `🎉 ₹${data.delta} credited to your wallet!`
          : `Message charge debited (-₹${Math.abs(data.delta).toFixed(2)})`,
        { icon: data.type === 'credit' ? '💰' : '⚡' }
      );
    };

    socket.on('wallet_balance_updated', handleBalanceUpdate);
    return () => {
      socket.off('wallet_balance_updated', handleBalanceUpdate);
    };
  }, [fetchWalletOverview, fetchTransactions, pagination.page]);

  // Handle Online Recharge via Razorpay
  const handleRazorpayPayment = async () => {
    const finalAmount = customAmount ? parseFloat(customAmount) : rechargeAmount;
    if (!finalAmount || finalAmount < 10) {
      return toast.error('Minimum recharge amount is ₹10');
    }

    setSubmittingPayment(true);
    try {
      const { data } = await api.post('/wallet/create-razorpay-order', { amount: finalAmount });
      const order = data.data;

      const options = {
        key: order.keyId,
        amount: order.amount * 100,
        currency: order.currency || 'INR',
        name: 'HK Automation Wallet',
        description: `Prepaid WhatsApp Balance Recharge - ₹${finalAmount}`,
        order_id: order.orderId,
        handler: async function (response) {
          try {
            const verifyRes = await api.post('/wallet/verify-razorpay-payment', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              amount: finalAmount
            });
            if (verifyRes.data.success) {
              toast.success('🎉 Payment successful! Funds added to your wallet.');
              setShowRechargeModal(false);
              fetchWalletOverview();
              fetchTransactions(1);
            }
          } catch (err) {
            toast.error(err.response?.data?.error || 'Payment verification failed');
          }
        },
        prefill: {
          name: user?.name || '',
          email: user?.email || '',
        },
        theme: { color: '#10b981' }
      };

      if (typeof window !== 'undefined' && window.Razorpay) {
        const rzp = new window.Razorpay(options);
        rzp.open();
      } else {
        // Load razorpay script dynamically if missing
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.onload = () => {
          const rzp = new window.Razorpay(options);
          rzp.open();
        };
        script.onerror = () => toast.error('Failed to load Razorpay payment gateway');
        document.body.appendChild(script);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to initiate payment');
    } finally {
      setSubmittingPayment(false);
    }
  };

  // Handle Screenshot Upload for UPI
  const handleScreenshotUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingScreenshot(true);
    try {
      const formData = new FormData();
      formData.append('screenshot', file);
      const res = await api.post('/wallet/upload-screenshot', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data?.success) {
        setUpiForm(prev => ({ ...prev, screenshotUrl: res.data.url, screenshot: file }));
        toast.success('Payment screenshot uploaded');
      }
    } catch (err) {
      toast.error('Failed to upload screenshot');
    } finally {
      setUploadingScreenshot(false);
    }
  };

  // Submit UPI QR Request
  const handleSubmitUpiTopup = async (e) => {
    e.preventDefault();
    const finalAmount = customAmount ? parseFloat(customAmount) : rechargeAmount;
    if (!finalAmount || finalAmount < 10) return toast.error('Minimum amount is ₹10');
    if (!upiForm.utrNumber || upiForm.utrNumber.trim().length < 6) {
      return toast.error('Please enter a valid 12-digit UPI UTR / Reference number');
    }

    setSubmittingPayment(true);
    try {
      const res = await api.post('/wallet/submit-upi-topup', {
        amount: finalAmount,
        utrNumber: upiForm.utrNumber.trim(),
        screenshot: upiForm.screenshotUrl,
        notes: upiForm.notes
      });
      if (res.data?.success) {
        toast.success('🎉 Top-up request submitted! Your balance will update upon admin verification.');
        setShowRechargeModal(false);
        setUpiForm({ utrNumber: '', notes: '', screenshot: null, screenshotUrl: '' });
        fetchTransactions(1);
        setActiveTab('passbook');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Submission failed');
    } finally {
      setSubmittingPayment(false);
    }
  };

  // Admin: Approve UPI Topup
  const handleApproveTopup = async (transactionId) => {
    setAdminActionLoading(true);
    try {
      const res = await api.post('/wallet/admin/approve-topup', { transactionId });
      if (res.data?.success) {
        toast.success('Payment approved and credited to wallet!');
        fetchAdminData();
        fetchWalletOverview();
        fetchTransactions(pagination.page);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to approve');
    } finally {
      setAdminActionLoading(false);
    }
  };

  // Admin: Reject UPI Topup
  const handleRejectTopup = async (transactionId) => {
    const reason = prompt('Please enter rejection reason:');
    if (reason === null) return;
    setAdminActionLoading(true);
    try {
      const res = await api.post('/wallet/admin/reject-topup', { transactionId, reason });
      if (res.data?.success) {
        toast.success('Payment request rejected');
        fetchAdminData();
        fetchTransactions(pagination.page);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to reject');
    } finally {
      setAdminActionLoading(false);
    }
  };

  // SuperAdmin: Manual Balance Adjustment
  const handleManualAdjustment = async (e) => {
    e.preventDefault();
    if (!adjustmentForm.organizationId || !adjustmentForm.amount) {
      return toast.error('Organization and amount are required');
    }
    setAdminActionLoading(true);
    try {
      const res = await api.post('/wallet/admin/manual-adjustment', {
        organizationId: adjustmentForm.organizationId,
        type: adjustmentForm.type,
        amount: parseFloat(adjustmentForm.amount),
        reason: adjustmentForm.reason || 'Manual SuperAdmin Adjustment'
      });
      if (res.data?.success) {
        toast.success(res.data.message);
        setShowAdjustmentModal(false);
        setAdjustmentForm({ organizationId: '', type: 'credit', amount: '', reason: '' });
        fetchAdminData();
        fetchWalletOverview();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to adjust balance');
    } finally {
      setAdminActionLoading(false);
    }
  };

  const isLowBalance = balanceData.balance < 50;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* 1. Header with Title & Quick Top-up Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-lg shadow-emerald-500/20">
              <Wallet className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                Fund & Balance Management
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/50">
                  Prepaid Wallet
                </span>
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Real-time WhatsApp Cloud API conversation balances, automated deduction ledger, and Google Pay style passbook.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => { fetchWalletOverview(); fetchTransactions(1); toast.success('Wallet refreshed'); }}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Refresh balance and history"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={() => setShowRechargeModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm shadow-md shadow-emerald-500/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            Add Funds / Recharge
          </button>
        </div>
      </div>

      {/* Low Balance Alert Banner */}
      {isLowBalance && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-800 dark:text-amber-300">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold">Your Wallet Balance is Low (₹{balanceData.balance.toFixed(2)})</p>
              <p className="text-xs opacity-90">
                To prevent automated AI bot replies and marketing campaigns from stopping, please recharge your wallet.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowRechargeModal(true)}
            className="px-4 py-2 rounded-xl bg-amber-600 text-white font-bold text-xs hover:bg-amber-500 transition-colors shrink-0 shadow-sm"
          >
            Instant Recharge Now
          </button>
        </div>
      )}

      {/* 2. Top Stats Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Main Balance Card (Hero) */}
        <div className="relative overflow-hidden p-5 rounded-3xl bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 text-white shadow-xl shadow-emerald-700/20 border border-emerald-500/30">
          <div className="absolute -right-4 -bottom-4 w-28 h-28 rounded-full bg-white/10 blur-xl pointer-events-none" />
          <div className="flex items-center justify-between text-emerald-100">
            <span className="text-xs font-bold uppercase tracking-wider">Available Balance</span>
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/40 text-[10px] font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-200 animate-pulse" />
              Live Active
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-bold opacity-80">₹</span>
              <span className="text-3xl font-black font-mono tracking-tight">
                {balanceData.balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <p className="text-[11px] text-emerald-100/80 mt-1">Ready for Meta broadcasts & bot flows</p>
          </div>
          <div className="mt-4 pt-3 border-t border-emerald-500/30 flex items-center justify-between">
            <button
              onClick={() => setShowRechargeModal(true)}
              className="text-xs font-bold text-white hover:underline flex items-center gap-1"
            >
              Top-up now <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] text-emerald-200/80">Threshold: ₹{balanceData.lowBalanceThreshold}</span>
          </div>
        </div>

        {/* Today's Spend */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span className="text-xs font-bold uppercase tracking-wider">Today's Spend</span>
              <div className="p-2 rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
                <ArrowDownLeft className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2">
              <span className="text-2xl font-black font-mono text-slate-900 dark:text-white">
                ₹ {stats.todaySpend.toFixed(2)}
              </span>
              <p className="text-[11px] text-slate-500 mt-1">Meta conversations billed today</p>
            </div>
          </div>
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-400 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" /> Auto-debited on message delivery
          </div>
        </div>

        {/* Month's Spend */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span className="text-xs font-bold uppercase tracking-wider">This Month's Spend</span>
              <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2">
              <span className="text-2xl font-black font-mono text-slate-900 dark:text-white">
                ₹ {stats.monthSpend.toFixed(2)}
              </span>
              <p className="text-[11px] text-slate-500 mt-1">Total spend for current month</p>
            </div>
          </div>
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-400 flex items-center gap-1">
            <Info className="w-3.5 h-3.5" /> Lifetime spent: ₹{stats.totalDebited.toFixed(2)}
          </div>
        </div>

        {/* Lifetime Recharged */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span className="text-xs font-bold uppercase tracking-wider">Total Recharged</span>
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                <ShieldCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2">
              <span className="text-2xl font-black font-mono text-slate-900 dark:text-white">
                ₹ {stats.totalCredited.toFixed(2)}
              </span>
              <p className="text-[11px] text-slate-500 mt-1">Lifetime wallet additions</p>
            </div>
          </div>
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-bold">
            <CheckCircle className="w-3.5 h-3.5" /> 100% Verified Ledger
          </div>
        </div>
      </div>

      {/* 3. Navigation Toggles / Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-200 dark:border-slate-800 scrollbar-none">
        {[
          { id: 'overview', label: '💳 Quick Top-up' },
          { id: 'passbook', label: '📜 Passbook (Google Pay Style)' },
          { id: 'analytics', label: '📊 Spend Analytics' },
          { id: 'rates', label: '🏷️ Meta Pricing & Rate Card' },
          ...((user?.role === 'superadmin' || user?.role === 'admin') ? [
            { id: 'admin', label: `🛡️ Admin Approvals (${pendingTopups.length})` }
          ] : [])
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-200 ${
              activeTab === tab.id
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm scale-100'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ================= TAB 1: QUICK TOP-UP ================= */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Choose Recharge Amount</h3>
                  <p className="text-xs text-slate-500">Instant credit with GST invoice receipt</p>
                </div>
                <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs">
                  <button
                    onClick={() => setRechargeMode('razorpay')}
                    className={`px-3 py-1 rounded-lg font-bold transition-colors ${
                      rechargeMode === 'razorpay' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'
                    }`}
                  >
                    UPI / Card / NetBanking
                  </button>
                  <button
                    onClick={() => setRechargeMode('upi_qr')}
                    className={`px-3 py-1 rounded-lg font-bold transition-colors ${
                      rechargeMode === 'upi_qr' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'
                    }`}
                  >
                    Direct UPI QR Code
                  </button>
                </div>
              </div>

              {/* Quick Amount Chips */}
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                {QUICK_AMOUNTS.map((amt) => {
                  const isSelected = !customAmount && rechargeAmount === amt;
                  return (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => { setRechargeAmount(amt); setCustomAmount(''); }}
                      className={`p-4 rounded-2xl border text-center transition-all ${
                        isSelected
                          ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 ring-2 ring-emerald-500/20 font-black scale-105'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 text-slate-700 dark:text-slate-300 font-bold'
                      }`}
                    >
                      <p className="text-lg font-mono">₹{amt}</p>
                      <span className="text-[10px] opacity-75 font-normal">
                        ~{Math.floor(amt / (rates.marketing || 0.85))} msgs
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Custom Amount Field */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Or Enter Custom Amount (₹)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                  <input
                    type="number"
                    min="10"
                    placeholder="Enter amount (e.g. 1500)"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    className="w-full pl-8 pr-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Razorpay Online Button */}
              {rechargeMode === 'razorpay' ? (
                <div className="pt-2">
                  <button
                    onClick={handleRazorpayPayment}
                    disabled={submittingPayment}
                    className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-base shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                  >
                    {submittingPayment ? (
                      <>
                        <RefreshCw className="w-5 h-5 animate-spin" /> Processing Payment...
                      </>
                    ) : (
                      <>
                        <CreditCard className="w-5 h-5" />
                        Recharge ₹{customAmount || rechargeAmount} Instantly (Google Pay / UPI / Cards)
                      </>
                    )}
                  </button>
                  <p className="text-center text-[11px] text-slate-400 mt-2">
                    🔒 Secured by Razorpay. 100% instant credit with automated GST invoice generation.
                  </p>
                </div>
              ) : (
                /* Direct UPI QR Form */
                <form onSubmit={handleSubmitUpiTopup} className="pt-2 space-y-4">
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center gap-5">
                    <div className="p-2 bg-white rounded-xl shadow-sm border border-slate-200 shrink-0">
                      {/* Dynamic UPI QR Code */}
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(
                          `upi://pay?pa=hkdigiverse@icici&pn=HK%20Digiverse&am=${customAmount || rechargeAmount}&cu=INR`
                        )}`}
                        alt="UPI QR Code"
                        className="w-32 h-32 rounded-lg"
                      />
                    </div>
                    <div className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                      <p className="font-bold text-slate-900 dark:text-white text-sm">Scan with Google Pay, PhonePe, or Paytm</p>
                      <p>UPI ID: <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">hkdigiverse@icici</span></p>
                      <p>Amount: <span className="font-mono font-bold">₹{customAmount || rechargeAmount}</span></p>
                      <p className="text-[11px] text-slate-500">After payment, enter the 12-digit UTR number below to credit your account.</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      12-Digit UPI Reference / UTR Number <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 428910398412"
                      value={upiForm.utrNumber}
                      onChange={(e) => setUpiForm({ ...upiForm, utrNumber: e.target.value })}
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Payment Screenshot (Optional)</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleScreenshotUpload}
                      className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
                    />
                    {uploadingScreenshot && <p className="text-xs text-slate-400">Uploading screenshot...</p>}
                    {upiForm.screenshotUrl && <p className="text-xs text-emerald-600 font-bold">✓ Screenshot attached</p>}
                  </div>

                  <button
                    type="submit"
                    disabled={submittingPayment}
                    className="w-full py-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 dark:text-slate-900 text-white font-extrabold text-sm shadow-md flex items-center justify-center gap-2"
                  >
                    {submittingPayment ? 'Submitting Reference...' : 'Submit Payment Reference for Approval'}
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Rate Card & How Billing Works Sidebar */}
          <div className="space-y-4">
            <div className="p-5 rounded-3xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-4">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Receipt className="w-4 h-4 text-emerald-500" />
                Live Conversation Rates
              </h4>
              <div className="space-y-2.5">
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-slate-800 text-xs border border-slate-100 dark:border-slate-800">
                  <span className="font-bold text-slate-700 dark:text-slate-200">Marketing Conversation</span>
                  <span className="font-black font-mono text-emerald-600 dark:text-emerald-400">₹{rates.marketing} / conv</span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-slate-800 text-xs border border-slate-100 dark:border-slate-800">
                  <span className="font-bold text-slate-700 dark:text-slate-200">Utility / Order Updates</span>
                  <span className="font-black font-mono text-emerald-600 dark:text-emerald-400">₹{rates.utility} / conv</span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-slate-800 text-xs border border-slate-100 dark:border-slate-800">
                  <span className="font-bold text-slate-700 dark:text-slate-200">Authentication / OTP</span>
                  <span className="font-black font-mono text-emerald-600 dark:text-emerald-400">₹{rates.authentication} / conv</span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-slate-800 text-xs border border-slate-100 dark:border-slate-800">
                  <span className="font-bold text-slate-700 dark:text-slate-200">Customer Support / Service</span>
                  <span className="font-black font-mono text-emerald-600 dark:text-emerald-400">₹{rates.service} / conv</span>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Charges apply per 24-hour conversation window initiated with contacts. Messages inside an open window do not incur extra conversation fees.
              </p>
            </div>

            <div className="p-5 rounded-3xl bg-emerald-500/5 border border-emerald-500/20 text-xs space-y-2">
              <p className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                Zero Financial Risk Guarantee
              </p>
              <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                Your account is protected with strict balance checks. Campaigns and AI bot replies automatically halt if funds reach zero, so there are never any surprise charges.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 2: PASSBOOK (GOOGLE PAY STYLE) ================= */}
      {activeTab === 'passbook' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search transaction ID, phone, UTR..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
              <button
                onClick={() => setFilterType('')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  filterType === '' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilterType('credit')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  filterType === 'credit' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400'
                }`}
              >
                🟢 Credits (+₹)
              </button>
              <button
                onClick={() => setFilterType('debit')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  filterType === 'debit' ? 'bg-rose-600 text-white' : 'bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400'
                }`}
              >
                🔴 Debits (-₹)
              </button>
            </div>
          </div>

          {/* Ledger List (Google Pay Card Style) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
            {transactions.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <Receipt className="w-12 h-12 mx-auto stroke-[1.5] text-slate-300 dark:text-slate-700" />
                <p className="font-bold text-sm text-slate-700 dark:text-slate-300 mt-3">No transactions found</p>
                <p className="text-xs text-slate-400 mt-1">Recharge your wallet or send a campaign to see passbook entries.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {transactions.map((txn) => {
                  const isCredit = txn.type === 'credit';
                  const isPending = txn.status === 'pending';
                  const isRejected = txn.status === 'rejected';

                  return (
                    <div
                      key={txn._id}
                      onClick={() => setSelectedTxn(txn)}
                      className="p-4 sm:p-5 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors cursor-pointer flex items-center justify-between gap-4"
                    >
                      {/* Left side: Icon & Title */}
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div
                          className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                            isPending
                              ? 'bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400'
                              : isRejected
                              ? 'bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400'
                              : isCredit
                              ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                              : 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400'
                          }`}
                        >
                          {isPending ? (
                            <Clock className="w-5 h-5" />
                          ) : isCredit ? (
                            <ArrowUpRight className="w-5 h-5 stroke-[2.5]" />
                          ) : (
                            <ArrowDownLeft className="w-5 h-5 stroke-[2.5]" />
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                              {txn.description || (isCredit ? 'Wallet Top-up' : 'WhatsApp Charge')}
                            </p>
                            {isPending && (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                                Pending Approval
                              </span>
                            )}
                            {isRejected && (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
                                Rejected
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1">
                            <span className="font-mono">{txn.transactionId}</span>
                            <span>•</span>
                            <span>{new Date(txn.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                            {txn.metaData?.recipientPhone && (
                              <>
                                <span>•</span>
                                <span className="font-mono text-slate-600 dark:text-slate-300">To: {txn.metaData.recipientPhone}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right side: Amount & Closing Balance */}
                      <div className="text-right shrink-0">
                        <p
                          className={`text-base font-black font-mono tracking-tight ${
                            isPending
                              ? 'text-amber-600 dark:text-amber-400'
                              : isCredit
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {isCredit ? '+' : '-'} ₹{txn.amount.toFixed(2)}
                        </p>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                          Bal: ₹{txn.closingBalance.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination Controls */}
            {pagination.pages > 1 && (
              <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
                <span>Showing page {pagination.page} of {pagination.pages}</span>
                <div className="flex items-center gap-2">
                  <button
                    disabled={pagination.page <= 1}
                    onClick={() => fetchTransactions(pagination.page - 1)}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                    disabled={pagination.page >= pagination.pages}
                    onClick={() => fetchTransactions(pagination.page + 1)}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================= TAB 3: SPEND ANALYTICS ================= */}
      {activeTab === 'analytics' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-500">Spend by Conversation Category</h3>
            <div className="space-y-4 pt-2">
              {Object.entries(stats.categoryBreakdown || {}).length === 0 ? (
                <p className="text-xs text-slate-400">No category breakdown data available yet.</p>
              ) : (
                Object.entries(stats.categoryBreakdown).map(([cat, info]) => {
                  const percent = stats.totalDebited > 0 ? ((info.amount / stats.totalDebited) * 100).toFixed(1) : 0;
                  return (
                    <div key={cat} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="capitalize text-slate-700 dark:text-slate-300">{cat.replace('meta_', '')}</span>
                        <span className="font-mono text-slate-900 dark:text-white">
                          ₹{info.amount.toFixed(2)} ({percent}%)
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-slate-400">{info.count} conversations</p>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-500">Financial Summary Ledger</h3>
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 text-xs">
                <span className="text-slate-500">Current Wallet Balance</span>
                <span className="font-black font-mono text-emerald-600 dark:text-emerald-400 text-sm">
                  ₹{balanceData.balance.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 text-xs">
                <span className="text-slate-500">Total Funds Added (Lifetime)</span>
                <span className="font-black font-mono text-slate-900 dark:text-white text-sm">
                  ₹{stats.totalCredited.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 text-xs">
                <span className="text-slate-500">Total Deductions (Lifetime)</span>
                <span className="font-black font-mono text-rose-600 text-sm">
                  -₹{stats.totalDebited.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 text-xs">
                <span className="text-slate-500">Today's Consumption</span>
                <span className="font-black font-mono text-amber-600 text-sm">
                  ₹{stats.todaySpend.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 4: META PRICING & RATE CARD ================= */}
      {activeTab === 'rates' && (
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Meta WhatsApp Conversation Rate Card (India)</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Transparent, per-conversation billing structure based on official WhatsApp Cloud API standards.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase font-black tracking-wider text-[10px]">
                <tr>
                  <th className="p-3.5 rounded-l-xl">Category</th>
                  <th className="p-3.5">Typical Use Case</th>
                  <th className="p-3.5">Window Duration</th>
                  <th className="p-3.5 rounded-r-xl text-right">Rate per Conversation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                <tr>
                  <td className="p-3.5 font-bold text-slate-900 dark:text-white">📢 Marketing</td>
                  <td className="p-3.5 text-slate-500">Promotions, discounts, product catalogs, announcements</td>
                  <td className="p-3.5 text-slate-500">24 hours</td>
                  <td className="p-3.5 text-right font-black font-mono text-emerald-600 dark:text-emerald-400">₹{rates.marketing}</td>
                </tr>
                <tr>
                  <td className="p-3.5 font-bold text-slate-900 dark:text-white">📦 Utility</td>
                  <td className="p-3.5 text-slate-500">Order confirmations, billing, shipping alerts, invoices</td>
                  <td className="p-3.5 text-slate-500">24 hours</td>
                  <td className="p-3.5 text-right font-black font-mono text-emerald-600 dark:text-emerald-400">₹{rates.utility}</td>
                </tr>
                <tr>
                  <td className="p-3.5 font-bold text-slate-900 dark:text-white">🔐 Authentication</td>
                  <td className="p-3.5 text-slate-500">One-time passcodes (OTP), account verification</td>
                  <td className="p-3.5 text-slate-500">24 hours</td>
                  <td className="p-3.5 text-right font-black font-mono text-emerald-600 dark:text-emerald-400">₹{rates.authentication}</td>
                </tr>
                <tr>
                  <td className="p-3.5 font-bold text-slate-900 dark:text-white">💬 Service / Support</td>
                  <td className="p-3.5 text-slate-500">User-initiated support, automated AI bot conversations</td>
                  <td className="p-3.5 text-slate-500">24 hours</td>
                  <td className="p-3.5 text-right font-black font-mono text-emerald-600 dark:text-emerald-400">₹{rates.service}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= TAB 5: ADMIN APPROVALS & ALL WALLETS ================= */}
      {activeTab === 'admin' && (user?.role === 'superadmin' || user?.role === 'admin') && (
        <div className="space-y-6">
          {/* Superadmin Manual Adjustment Action Button */}
          {user?.role === 'superadmin' && (
            <div className="flex justify-end">
              <button
                onClick={() => setShowAdjustmentModal(true)}
                className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-white dark:text-slate-900 text-white font-bold text-xs shadow-sm flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Manual Organization Credit / Debit
              </button>
            </div>
          )}

          {/* Pending UPI Top-ups */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              Pending UPI Top-up Requests ({pendingTopups.length})
            </h3>

            {pendingTopups.length === 0 ? (
              <p className="text-xs text-slate-400 py-4">No pending payment approvals at the moment.</p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {pendingTopups.map((topup) => (
                  <div key={topup._id} className="py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900 dark:text-white">
                          ₹{topup.amount.toFixed(2)}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-bold">
                          UTR: {topup.paymentDetails?.utrNumber}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Org: {topup.organizationId?.name || 'N/A'} • Submitted by: {topup.userId?.name || topup.userId?.email || 'User'}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {new Date(topup.createdAt).toLocaleString('en-IN')}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {topup.paymentDetails?.screenshot && (
                        <a
                          href={topup.paymentDetails.screenshot}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold hover:bg-slate-50 flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" /> View Receipt
                        </a>
                      )}
                      <button
                        disabled={adminActionLoading}
                        onClick={() => handleApproveTopup(topup.transactionId)}
                        className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm"
                      >
                        Approve & Credit
                      </button>
                      <button
                        disabled={adminActionLoading}
                        onClick={() => handleRejectTopup(topup.transactionId)}
                        className="px-3 py-1.5 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 font-bold text-xs"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Superadmin: All Organizations Balances */}
          {user?.role === 'superadmin' && (
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-500 flex items-center gap-2">
                <Building className="w-4 h-4 text-emerald-500" />
                All Organization Wallet Balances
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase font-black tracking-wider text-[10px]">
                    <tr>
                      <th className="p-3 rounded-l-xl">Organization</th>
                      <th className="p-3">Contact</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 rounded-r-xl text-right">Wallet Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {allWallets.map((org) => (
                      <tr key={org._id}>
                        <td className="p-3 font-bold text-slate-900 dark:text-white">{org.name}</td>
                        <td className="p-3 text-slate-500">{org.contactEmail}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800">
                            {org.status}
                          </span>
                        </td>
                        <td className="p-3 text-right font-black font-mono text-emerald-600 dark:text-emerald-400 text-sm">
                          ₹{(org.walletBalance || 0).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= MODAL 1: RECHARGE MODAL ================= */}
      {showRechargeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                  <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 dark:text-white text-base">Recharge WhatsApp Wallet</h3>
                  <p className="text-xs text-slate-500">Current Balance: ₹{balanceData.balance.toFixed(2)}</p>
                </div>
              </div>
              <button
                onClick={() => setShowRechargeModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Amount Selection */}
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2.5">
                {QUICK_AMOUNTS.slice(0, 3).map((amt) => (
                  <button
                    key={amt}
                    onClick={() => { setRechargeAmount(amt); setCustomAmount(''); }}
                    className={`py-2.5 rounded-xl border text-center font-bold text-sm ${
                      !customAmount && rechargeAmount === amt
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-600'
                        : 'border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    ₹{amt}
                  </button>
                ))}
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Custom Amount (₹)</label>
                <input
                  type="number"
                  placeholder="Enter custom amount"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  className="w-full mt-1 px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold"
                />
              </div>

              <div className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setRechargeMode('razorpay')}
                  className={`flex-1 py-2 rounded-lg transition-colors ${
                    rechargeMode === 'razorpay' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'
                  }`}
                >
                  Online (Razorpay / UPI)
                </button>
                <button
                  type="button"
                  onClick={() => setRechargeMode('upi_qr')}
                  className={`flex-1 py-2 rounded-lg transition-colors ${
                    rechargeMode === 'upi_qr' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'
                  }`}
                >
                  Direct UPI QR Code
                </button>
              </div>

              {rechargeMode === 'razorpay' ? (
                <button
                  onClick={handleRazorpayPayment}
                  disabled={submittingPayment}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-extrabold text-sm shadow-md"
                >
                  {submittingPayment ? 'Processing...' : `Pay ₹${customAmount || rechargeAmount} via Razorpay`}
                </button>
              ) : (
                <form onSubmit={handleSubmitUpiTopup} className="space-y-3">
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center gap-4">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(
                        `upi://pay?pa=hkdigiverse@icici&pn=HK%20Digiverse&am=${customAmount || rechargeAmount}&cu=INR`
                      )}`}
                      alt="QR"
                      className="w-20 h-20 rounded bg-white p-1"
                    />
                    <div className="text-xs space-y-1">
                      <p className="font-bold">Scan & Pay via any UPI App</p>
                      <p className="font-mono text-emerald-600">hkdigiverse@icici</p>
                      <p className="text-[11px] text-slate-400">Amount: ₹{customAmount || rechargeAmount}</p>
                    </div>
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="Enter 12-digit UTR Number"
                    value={upiForm.utrNumber}
                    onChange={(e) => setUpiForm({ ...upiForm, utrNumber: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold"
                  />
                  <button
                    type="submit"
                    disabled={submittingPayment}
                    className="w-full py-3 rounded-xl bg-slate-900 dark:bg-white dark:text-slate-900 text-white font-bold text-xs"
                  >
                    Submit Reference
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL 2: TRANSACTION DETAILS DRAWER ================= */}
      {selectedTxn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Transaction Receipt</span>
              <button onClick={() => setSelectedTxn(null)} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Big Amount Header */}
            <div className="text-center py-2">
              <p className={`text-3xl font-black font-mono ${selectedTxn.type === 'credit' ? 'text-emerald-600' : 'text-rose-600'}`}>
                {selectedTxn.type === 'credit' ? '+' : '-'} ₹{selectedTxn.amount.toFixed(2)}
              </p>
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-1">{selectedTxn.description}</p>
              <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold mt-2 bg-slate-100 dark:bg-slate-800">
                Status: {selectedTxn.status.toUpperCase()}
              </span>
            </div>

            {/* Receipt Table */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 space-y-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Transaction ID</span>
                <span className="font-mono font-bold">{selectedTxn.transactionId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Date & Time</span>
                <span>{new Date(selectedTxn.createdAt).toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Category</span>
                <span className="font-bold capitalize">{selectedTxn.category.replace('meta_', '')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Opening Balance</span>
                <span className="font-mono">₹{selectedTxn.openingBalance.toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-2 font-bold">
                <span>Closing Balance</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400">₹{selectedTxn.closingBalance.toFixed(2)}</span>
              </div>
              {selectedTxn.paymentDetails?.utrNumber && (
                <div className="flex justify-between pt-1">
                  <span className="text-slate-400">UTR Number</span>
                  <span className="font-mono font-bold">{selectedTxn.paymentDetails.utrNumber}</span>
                </div>
              )}
              {selectedTxn.metaData?.recipientPhone && (
                <div className="flex justify-between pt-1">
                  <span className="text-slate-400">Recipient Phone</span>
                  <span className="font-mono font-bold">{selectedTxn.metaData.recipientPhone}</span>
                </div>
              )}
            </div>

            <button
              onClick={() => { window.print(); }}
              className="w-full py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-center gap-1.5"
            >
              <Download className="w-4 h-4" /> Print / Save Receipt
            </button>
          </div>
        </div>
      )}

      {/* ================= MODAL 3: SUPERADMIN MANUAL ADJUSTMENT ================= */}
      {showAdjustmentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">SuperAdmin Balance Adjustment</h3>
              <button onClick={() => setShowAdjustmentModal(false)} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleManualAdjustment} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Select Organization</label>
                <select
                  required
                  value={adjustmentForm.organizationId}
                  onChange={(e) => setAdjustmentForm({ ...adjustmentForm, organizationId: e.target.value })}
                  className="w-full mt-1 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold"
                >
                  <option value="">-- Choose Organization --</option>
                  {allWallets.map((org) => (
                    <option key={org._id} value={org._id}>
                      {org.name} (Current: ₹{(org.walletBalance || 0).toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Action Type</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => setAdjustmentForm({ ...adjustmentForm, type: 'credit' })}
                    className={`py-2 rounded-xl font-bold ${
                      adjustmentForm.type === 'credit' ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-slate-800'
                    }`}
                  >
                    Credit (+₹)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustmentForm({ ...adjustmentForm, type: 'debit' })}
                    className={`py-2 rounded-xl font-bold ${
                      adjustmentForm.type === 'debit' ? 'bg-rose-600 text-white' : 'bg-slate-100 dark:bg-slate-800'
                    }`}
                  >
                    Debit (-₹)
                  </button>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Amount (₹)</label>
                <input
                  type="number"
                  required
                  min="1"
                  step="0.01"
                  placeholder="Enter amount"
                  value={adjustmentForm.amount}
                  onChange={(e) => setAdjustmentForm({ ...adjustmentForm, amount: e.target.value })}
                  className="w-full mt-1 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold font-mono"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300">Reason / Notes</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Cash payment received in office"
                  value={adjustmentForm.reason}
                  onChange={(e) => setAdjustmentForm({ ...adjustmentForm, reason: e.target.value })}
                  className="w-full mt-1 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>

              <button
                type="submit"
                disabled={adminActionLoading}
                className="w-full py-3 rounded-xl bg-slate-900 dark:bg-white dark:text-slate-900 text-white font-extrabold shadow-sm"
              >
                {adminActionLoading ? 'Processing...' : 'Apply Adjustment'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
