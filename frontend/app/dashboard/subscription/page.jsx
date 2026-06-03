'use client';
import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../../../lib/store';
import api from '../../../lib/api';
import toast from 'react-hot-toast';
import {
  CreditCard, Clock, CheckCircle, AlertTriangle, Upload, Download,
  IndianRupee, Calendar, FileText, ArrowRight, Loader2, XCircle,
  Shield, Zap, Bot, MessageSquare, Users, BarChart3, Megaphone, RefreshCw
} from 'lucide-react';

export default function SubscriptionPage() {
  const { user } = useAuthStore();
  const [tab, setTab] = useState('current');
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState(null);
  const [plans, setPlans] = useState(null);
  const [payments, setPayments] = useState([]);
  const [selectedMonths, setSelectedMonths] = useState(null);
  const [paymentMode, setPaymentMode] = useState(null); // 'online' | 'offline'
  const [offlineForm, setOfflineForm] = useState({ transactionId: '', notes: '', screenshot: null });
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [currentRes, plansRes, paymentsRes] = await Promise.all([
        api.get('/subscription/current'),
        api.get('/subscription/plans'),
        api.get('/subscription/payments')
      ]);
      setCurrent(currentRes.data.data);
      setPlans(plansRes.data.data);
      setPayments(paymentsRes.data.data);
    } catch (err) {
      if (err.response?.data?.code !== 'SUBSCRIPTION_EXPIRED') {
        toast.error('Failed to load subscription data');
      }
      // Try fetching plans even if other requests fail
      try {
        const plansRes = await api.get('/subscription/plans');
        setPlans(plansRes.data.data);
      } catch {}
      try {
        const currentRes = await api.get('/subscription/current');
        setCurrent(currentRes.data.data);
      } catch {}
      try {
        const paymentsRes = await api.get('/subscription/payments');
        setPayments(paymentsRes.data.data);
      } catch {}
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ===== Razorpay Online Payment =====
  const handleOnlinePayment = async () => {
    if (!selectedMonths) return toast.error('Please select a plan');
    setSubmitting(true);
    try {
      const { data } = await api.post('/subscription/create-order', { months: selectedMonths });
      const order = data.data;

      const options = {
        key: order.keyId,
        amount: order.amount * 100,
        currency: order.currency || 'INR',
        name: 'Ajnabh Connect',
        description: `Subscription - ${order.planMonths} Month(s)`,
        order_id: order.orderId,
        handler: async function (response) {
          try {
            const verifyRes = await api.post('/subscription/verify-payment', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              paymentId: order.paymentId
            });
            if (verifyRes.data.success) {
              toast.success('🎉 Payment successful! Subscription activated.');
              fetchData();
              setTab('current');
              setSelectedMonths(null);
              setPaymentMode(null);
            }
          } catch (err) {
            toast.error(err.response?.data?.error || 'Payment verification failed');
          }
        },
        prefill: { name: user?.name || '', email: user?.email || '' },
        theme: { color: '#25d366' }
      };

      if (typeof window !== 'undefined' && window.Razorpay) {
        const rzp = new window.Razorpay(options);
        rzp.open();
      } else {
        // Load Razorpay script dynamically
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.onload = () => {
          const rzp = new window.Razorpay(options);
          rzp.open();
        };
        document.body.appendChild(script);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create payment order');
    } finally {
      setSubmitting(false);
    }
  };

  // ===== Offline Payment =====
  const handleOfflinePayment = async () => {
    if (!selectedMonths) return toast.error('Please select a plan');
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('months', selectedMonths);
      formData.append('transactionId', offlineForm.transactionId);
      formData.append('notes', offlineForm.notes);
      if (offlineForm.screenshot) formData.append('screenshot', offlineForm.screenshot);

      const { data } = await api.post('/subscription/offline-payment', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (data.success) {
        toast.success('✅ Payment submitted! Awaiting verification.');
        fetchData();
        setTab('current');
        setSelectedMonths(null);
        setPaymentMode(null);
        setOfflineForm({ transactionId: '', notes: '', screenshot: null });
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to submit payment');
    } finally {
      setSubmitting(false);
    }
  };

  const statusBadge = (status) => {
    const map = {
      active: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400', label: 'Active' },
      expiring_soon: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', label: 'Expiring Soon' },
      expired: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', label: 'Expired' },
      pending: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400', label: 'Pending' },
      trial: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-400', label: 'Trial' },
      paid: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400', label: 'Paid' },
      failed: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', label: 'Failed' },
      rejected: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', label: 'Rejected' }
    };
    const s = map[status] || map.pending;
    return <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${s.bg} ${s.text}`}>{s.label}</span>;
  };

  const features = [
    { icon: MessageSquare, label: 'WhatsApp Messaging' },
    { icon: Megaphone, label: 'Bulk Campaigns' },
    { icon: Bot, label: 'Auto-Reply Bots' },
    { icon: Users, label: 'Contact Management' },
    { icon: BarChart3, label: 'Analytics Dashboard' },
    { icon: Shield, label: 'Meta Integration' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-wa-green" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-wa-text-primary dark:text-white flex items-center gap-2">
            <CreditCard className="w-7 h-7 text-wa-green" />
            Subscription & Billing
          </h1>
          <p className="text-sm text-wa-text-secondary dark:text-wa-dark-text-secondary mt-1">
            Manage your plan, payments, and billing history
          </p>
        </div>
        <button onClick={fetchData} className="p-2 rounded-lg hover:bg-wa-hover dark:hover:bg-wa-dark-hover transition-colors text-wa-text-secondary">
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* Expiry Warning Banner */}
      {current && (current.subscriptionStatus === 'expiring_soon' || current.subscriptionStatus === 'expired') && (
        <div className={`p-4 rounded-xl border ${current.subscriptionStatus === 'expired' ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800' : 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800'}`}>
          <div className="flex items-center gap-3">
            <AlertTriangle className={`w-5 h-5 ${current.subscriptionStatus === 'expired' ? 'text-red-500' : 'text-amber-500'}`} />
            <div>
              <p className={`font-semibold text-sm ${current.subscriptionStatus === 'expired' ? 'text-red-700 dark:text-red-400' : 'text-amber-700 dark:text-amber-400'}`}>
                {current.subscriptionStatus === 'expired'
                  ? `Your subscription expired on ${new Date(current.subscriptionExpiryDate).toLocaleDateString('en-IN')}.`
                  : `Your subscription expires in ${current.remainingDays} day(s).`
                }
              </p>
              <p className="text-xs text-wa-text-secondary dark:text-wa-dark-text-secondary mt-0.5">
                {current.subscriptionStatus === 'expired'
                  ? 'All platform features are disabled. Please renew immediately.'
                  : 'Renew now to avoid service interruption.'
                }
              </p>
            </div>
            <button onClick={() => setTab('renew')} className="ml-auto px-4 py-2 bg-wa-green hover:bg-wa-green-hover text-white text-sm font-semibold rounded-lg transition-colors">
              Renew Now
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-wa-search dark:bg-wa-dark-search rounded-xl p-1">
        {[
          { id: 'current', label: 'Current Plan', icon: Shield },
          { id: 'renew', label: 'Renew / Buy Plan', icon: CreditCard },
          { id: 'history', label: 'Payment History', icon: FileText }
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${tab === t.id ? 'bg-white dark:bg-wa-dark-panel text-wa-green shadow-sm' : 'text-wa-text-secondary dark:text-wa-dark-text-secondary hover:text-wa-text-primary'}`}
          >
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {/* ========== TAB: Current Plan ========== */}
      {tab === 'current' && (
        <div className="space-y-6">
          {/* Plan Status Card */}
          <div className="bg-white dark:bg-wa-dark-panel rounded-2xl border border-wa-border dark:border-wa-dark-border p-6 shadow-sm">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-wa-text-primary dark:text-white">Plan Status</h2>
                <p className="text-sm text-wa-text-secondary dark:text-wa-dark-text-secondary">{current?.organizationName}</p>
              </div>
              {statusBadge(current?.subscriptionStatus)}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-wa-search dark:bg-wa-dark-search rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2 text-wa-text-secondary dark:text-wa-dark-text-secondary">
                  <Calendar className="w-4 h-4" />
                  <span className="text-xs font-medium uppercase">Expiry Date</span>
                </div>
                <p className="text-lg font-bold text-wa-text-primary dark:text-white">
                  {current?.subscriptionExpiryDate ? new Date(current.subscriptionExpiryDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Not Set'}
                </p>
              </div>
              <div className="bg-wa-search dark:bg-wa-dark-search rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2 text-wa-text-secondary dark:text-wa-dark-text-secondary">
                  <Clock className="w-4 h-4" />
                  <span className="text-xs font-medium uppercase">Remaining</span>
                </div>
                <p className={`text-lg font-bold ${current?.remainingDays > 7 ? 'text-emerald-600' : current?.remainingDays > 0 ? 'text-amber-600' : 'text-red-600'}`}>
                  {current?.remainingDays || 0} Days
                </p>
              </div>
              <div className="bg-wa-search dark:bg-wa-dark-search rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2 text-wa-text-secondary dark:text-wa-dark-text-secondary">
                  <Zap className="w-4 h-4" />
                  <span className="text-xs font-medium uppercase">Plan</span>
                </div>
                <p className="text-lg font-bold text-wa-text-primary dark:text-white">
                  {current?.subscription ? `${current.subscription.planMonths} Month(s)` : 'No Active Plan'}
                </p>
              </div>
            </div>

            {(current?.subscriptionStatus === 'expired' || current?.subscriptionStatus === 'trial' || !current?.subscription) && (
              <button onClick={() => setTab('renew')} className="mt-6 w-full py-3 bg-wa-green hover:bg-wa-green-hover text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2">
                <CreditCard className="w-5 h-5" /> {current?.subscriptionStatus === 'expired' ? 'Renew Now' : 'Get Started — Buy a Plan'}
              </button>
            )}
          </div>

          {/* Features Included */}
          <div className="bg-white dark:bg-wa-dark-panel rounded-2xl border border-wa-border dark:border-wa-dark-border p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-wa-text-primary dark:text-white mb-4">Features Included in All Plans</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {features.map((f, i) => (
                <div key={i} className="flex items-center gap-2.5 px-3 py-2.5 bg-wa-search dark:bg-wa-dark-search rounded-lg">
                  <f.icon className="w-4 h-4 text-wa-green" />
                  <span className="text-xs font-medium text-wa-text-primary dark:text-wa-dark-text-primary">{f.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========== TAB: Renew / Buy Plan ========== */}
      {tab === 'renew' && plans && (
        <div className="space-y-6">
          {/* Plan Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {plans.plans.map((plan) => (
              <div
                key={plan.months}
                onClick={() => { setSelectedMonths(plan.months); setPaymentMode(null); }}
                className={`cursor-pointer bg-white dark:bg-wa-dark-panel rounded-2xl border-2 p-5 transition-all hover:shadow-lg ${selectedMonths === plan.months ? 'border-wa-green shadow-lg ring-2 ring-wa-green/20' : 'border-wa-border dark:border-wa-dark-border'}`}
              >
                {plan.months === 12 && (
                  <div className="mb-3">
                    <span className="px-2.5 py-1 bg-gradient-to-r from-wa-green to-emerald-400 text-white text-[10px] font-bold rounded-full uppercase tracking-wider">Best Value</span>
                  </div>
                )}
                <h3 className="text-2xl font-extrabold text-wa-text-primary dark:text-white">{plan.months} <span className="text-base font-medium text-wa-text-secondary">Month{plan.months > 1 ? 's' : ''}</span></h3>
                <div className="mt-3 flex items-baseline gap-1">
                  <IndianRupee className="w-5 h-5 text-wa-text-primary dark:text-white" />
                  <span className="text-3xl font-extrabold text-wa-text-primary dark:text-white">{plan.totalAmount.toLocaleString('en-IN')}</span>
                </div>
                {plan.taxAmount > 0 && (
                  <p className="text-xs text-wa-text-secondary mt-1">Includes ₹{plan.taxAmount} tax</p>
                )}
                <p className="text-xs text-wa-text-secondary dark:text-wa-dark-text-secondary mt-2">
                  ₹{plans.monthlyPrice.toLocaleString('en-IN')}/month
                </p>
                {selectedMonths === plan.months && (
                  <div className="mt-3 flex items-center gap-1 text-wa-green text-xs font-semibold">
                    <CheckCircle className="w-4 h-4" /> Selected
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Payment Method Selection */}
          {selectedMonths && !paymentMode && (
            <div className="bg-white dark:bg-wa-dark-panel rounded-2xl border border-wa-border dark:border-wa-dark-border p-6 shadow-sm">
              <h3 className="text-base font-bold text-wa-text-primary dark:text-white mb-4">Choose Payment Method</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={() => setPaymentMode('online')}
                  className="flex items-center gap-4 p-5 rounded-xl border-2 border-wa-border dark:border-wa-dark-border hover:border-wa-green transition-all group"
                >
                  <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center">
                    <CreditCard className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-wa-text-primary dark:text-white">Pay Online</p>
                    <p className="text-xs text-wa-text-secondary">Razorpay — UPI, Cards, NetBanking</p>
                  </div>
                  <ArrowRight className="w-5 h-5 ml-auto text-wa-text-secondary group-hover:text-wa-green transition-colors" />
                </button>
                <button
                  onClick={() => setPaymentMode('offline')}
                  className="flex items-center gap-4 p-5 rounded-xl border-2 border-wa-border dark:border-wa-dark-border hover:border-wa-green transition-all group"
                >
                  <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center">
                    <Upload className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-wa-text-primary dark:text-white">Pay via Cash / Bank Transfer</p>
                    <p className="text-xs text-wa-text-secondary">Upload screenshot & await verification</p>
                  </div>
                  <ArrowRight className="w-5 h-5 ml-auto text-wa-text-secondary group-hover:text-wa-green transition-colors" />
                </button>
              </div>
            </div>
          )}

          {/* Online Payment Confirmation */}
          {paymentMode === 'online' && (
            <div className="bg-white dark:bg-wa-dark-panel rounded-2xl border border-wa-border dark:border-wa-dark-border p-6 shadow-sm">
              <h3 className="text-base font-bold text-wa-text-primary dark:text-white mb-2">Confirm Online Payment</h3>
              <p className="text-sm text-wa-text-secondary mb-4">
                You are purchasing a <strong>{selectedMonths}-month</strong> plan for <strong>₹{plans.plans.find(p => p.months === selectedMonths)?.totalAmount.toLocaleString('en-IN')}</strong>
              </p>
              <button
                onClick={handleOnlinePayment}
                disabled={submitting}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <CreditCard className="w-5 h-5" />}
                {submitting ? 'Processing...' : 'Pay with Razorpay'}
              </button>
              <button onClick={() => setPaymentMode(null)} className="w-full mt-2 py-2 text-sm text-wa-text-secondary hover:text-wa-text-primary transition-colors">
                ← Back to payment methods
              </button>
            </div>
          )}

          {/* Offline Payment Form */}
          {paymentMode === 'offline' && (
            <div className="bg-white dark:bg-wa-dark-panel rounded-2xl border border-wa-border dark:border-wa-dark-border p-6 shadow-sm">
              <h3 className="text-base font-bold text-wa-text-primary dark:text-white mb-4">Offline Payment Details</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-wa-text-secondary mb-1.5">Payment Screenshot</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setOfflineForm(f => ({ ...f, screenshot: e.target.files?.[0] || null }))}
                    className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-wa-green/10 file:text-wa-green hover:file:bg-wa-green/20 text-wa-text-primary dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-wa-text-secondary mb-1.5">Transaction Reference Number</label>
                  <input
                    type="text"
                    value={offlineForm.transactionId}
                    onChange={(e) => setOfflineForm(f => ({ ...f, transactionId: e.target.value }))}
                    placeholder="e.g. UTR number, receipt ID"
                    className="w-full px-4 py-2.5 rounded-xl bg-wa-search dark:bg-wa-dark-search border border-wa-border dark:border-wa-dark-border text-sm text-wa-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-wa-green/30"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-wa-text-secondary mb-1.5">Notes (Optional)</label>
                  <textarea
                    value={offlineForm.notes}
                    onChange={(e) => setOfflineForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Additional details..."
                    rows={2}
                    className="w-full px-4 py-2.5 rounded-xl bg-wa-search dark:bg-wa-dark-search border border-wa-border dark:border-wa-dark-border text-sm text-wa-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-wa-green/30 resize-none"
                  />
                </div>
                <button
                  onClick={handleOfflinePayment}
                  disabled={submitting}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                  {submitting ? 'Submitting...' : 'Submit Offline Payment'}
                </button>
                <button onClick={() => setPaymentMode(null)} className="w-full py-2 text-sm text-wa-text-secondary hover:text-wa-text-primary transition-colors">
                  ← Back to payment methods
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========== TAB: Payment History ========== */}
      {tab === 'history' && (
        <div className="bg-white dark:bg-wa-dark-panel rounded-2xl border border-wa-border dark:border-wa-dark-border shadow-sm overflow-hidden">
          <div className="p-5 border-b border-wa-border dark:border-wa-dark-border">
            <h3 className="text-base font-bold text-wa-text-primary dark:text-white">Payment History</h3>
          </div>
          {payments.length === 0 ? (
            <div className="p-12 text-center text-wa-text-secondary dark:text-wa-dark-text-secondary">
              <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No payment history yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-wa-search dark:bg-wa-dark-search text-left text-xs font-semibold text-wa-text-secondary uppercase">
                    <th className="px-5 py-3">Invoice #</th>
                    <th className="px-5 py-3">Plan</th>
                    <th className="px-5 py-3">Date</th>
                    <th className="px-5 py-3">Amount</th>
                    <th className="px-5 py-3">Method</th>
                    <th className="px-5 py-3">Transaction ID</th>
                    <th className="px-5 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p._id} className="border-b border-wa-border dark:border-wa-dark-border hover:bg-wa-hover/50 dark:hover:bg-wa-dark-hover/50">
                      <td className="px-5 py-3 font-mono text-xs">{p.invoiceNumber || '-'}</td>
                      <td className="px-5 py-3">{p.planMonths} Month{p.planMonths > 1 ? 's' : ''}</td>
                      <td className="px-5 py-3 text-wa-text-secondary">{new Date(p.createdAt).toLocaleDateString('en-IN')}</td>
                      <td className="px-5 py-3 font-semibold">₹{p.totalAmount?.toLocaleString('en-IN')}</td>
                      <td className="px-5 py-3">
                        <span className="capitalize">{p.paymentMethod?.replace('_', ' ')}</span>
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-wa-text-secondary">{p.transactionId || p.razorpayPaymentId || '-'}</td>
                      <td className="px-5 py-3">{statusBadge(p.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
