'use client';
import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../../../lib/store';
import api from '../../../lib/api';
import toast from 'react-hot-toast';
import { formatDateOnly } from '../../../lib/utils';
import {
  CreditCard, Clock, CheckCircle, AlertTriangle, Upload, Download,
  IndianRupee, Calendar, FileText, ArrowRight, Loader2, XCircle,
  Shield, Zap, Bot, MessageSquare, Users, BarChart3, Megaphone, RefreshCw, Eye, Printer, X,
  Copy, Check, Building2, QrCode
} from 'lucide-react';
import Portal from '../../../components/Portal';
import { LOGO_BASE64 } from '../../../lib/logoBase64';

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
  const [rejectionModal, setRejectionModal] = useState({ open: false, reason: '', invoice: '' });
  const [viewInvoiceModal, setViewInvoiceModal] = useState({ open: false, payment: null });
  const [copiedField, setCopiedField] = useState(null);

  const handleCopy = (text, fieldName) => {
    if (!text) return;
    try {
      navigator.clipboard?.writeText(text);
      setCopiedField(fieldName);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopiedField(null), 2000);
    } catch {}
  };

  const handlePrintInvoice = (payment) => {
    if (!payment) return;
    const baseAmount = payment.amount || (payment.totalAmount ? (payment.totalAmount - (payment.taxAmount || 0)) : 0);
    const taxAmount = payment.taxAmount || 0;
    const cgst = Math.round(taxAmount / 2);
    const sgst = taxAmount - cgst;
    const totalAmount = payment.totalAmount || (baseAmount + taxAmount);
    const invoiceNo = payment.invoiceNumber || 'INV-PENDING';
    const invoiceDate = formatDateOnly(payment.createdAt);
    const customerName = user?.name || 'Customer';
    const companyName = current?.organizationName || 'Client Organization';
    const customerEmail = user?.email || '';
    const paymentMethod = (payment.paymentMethod || 'ONLINE').replace('_', ' ').toUpperCase();
    const txnId = payment.transactionId || payment.razorpayPaymentId || 'N/A';
    const status = (payment.status || 'PAID').toUpperCase();

    const printWindow = window.open('', '_blank', 'width=950,height=800');
    if (!printWindow) {
      window.print();
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Tax_Invoice_${invoiceNo}</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 12mm 15mm 12mm 15mm;
          }
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            color: #0f172a;
            background: #ffffff;
            font-size: 12px;
            line-height: 1.5;
            padding: 8px 0;
          }
          .invoice-box {
            width: 100%;
            max-width: 800px;
            margin: 0 auto;
          }
          .header-row {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #059669;
            padding-bottom: 16px;
            margin-bottom: 20px;
          }
          .brand-col {
            display: flex;
            align-items: center;
            gap: 14px;
          }
          .logo-img {
            height: 48px;
            width: auto;
            object-fit: contain;
          }
          .brand-title {
            font-size: 18px;
            font-weight: 900;
            color: #0f172a;
            letter-spacing: -0.3px;
          }
          .brand-subtitle {
            font-size: 11px;
            font-weight: 700;
            color: #059669;
          }
          .brand-meta {
            font-size: 10.5px;
            color: #64748b;
            margin-top: 2px;
          }
          .invoice-meta-col {
            text-align: right;
          }
          .invoice-title {
            font-size: 22px;
            font-weight: 900;
            color: #059669;
            letter-spacing: 0.5px;
          }
          .invoice-tag {
            display: inline-block;
            background: #ecfdf5;
            color: #047857;
            border: 1px solid #a7f3d0;
            font-size: 9.5px;
            font-weight: 800;
            padding: 2px 8px;
            border-radius: 4px;
            text-transform: uppercase;
            margin-top: 3px;
          }
          .meta-list {
            margin-top: 6px;
            font-size: 11px;
            color: #334155;
            line-height: 1.6;
          }
          .info-grid {
            display: flex;
            justify-content: space-between;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 14px 18px;
            margin-bottom: 22px;
            gap: 20px;
          }
          .info-col {
            flex: 1;
          }
          .info-col:first-child {
            border-right: 1px solid #e2e8f0;
            padding-right: 18px;
          }
          .info-label {
            font-size: 10px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            color: #64748b;
            margin-bottom: 4px;
          }
          .customer-name {
            font-size: 14px;
            font-weight: 800;
            color: #0f172a;
          }
          .customer-org {
            font-size: 12px;
            font-weight: 600;
            color: #059669;
            margin-top: 1px;
          }
          .customer-email {
            font-size: 11px;
            color: #64748b;
            margin-top: 2px;
          }
          .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
          }
          .items-table th {
            background: #f1f5f9;
            color: #334155;
            font-size: 10.5px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            padding: 10px 12px;
            border: 1px solid #cbd5e1;
            text-align: left;
          }
          .items-table td {
            padding: 12px;
            border: 1px solid #e2e8f0;
            vertical-align: top;
            font-size: 11.5px;
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .item-heading {
            font-size: 13px;
            font-weight: 800;
            color: #0f172a;
          }
          .item-desc {
            font-size: 10.5px;
            color: #64748b;
            margin-top: 3px;
            line-height: 1.4;
          }
          .calc-row {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 22px;
            gap: 20px;
          }
          .calc-left {
            flex: 1;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 12px 16px;
            font-size: 11px;
            color: #475569;
            line-height: 1.6;
          }
          .calc-right {
            width: 320px;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            background: #f8fafc;
            overflow: hidden;
          }
          .calc-table {
            width: 100%;
            border-collapse: collapse;
          }
          .calc-table td {
            padding: 8px 14px;
            font-size: 11.5px;
          }
          .grand-total-row {
            background: #ecfdf5;
            border-top: 2px solid #059669;
            color: #059669;
            font-weight: 900;
            font-size: 14px;
          }
          .signatory-row {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            margin-top: 30px;
            padding-top: 15px;
            border-top: 1px dashed #cbd5e1;
          }
          .terms-block {
            font-size: 9.5px;
            color: #94a3b8;
            line-height: 1.5;
            max-width: 480px;
          }
          .sign-block {
            text-align: right;
          }
          .sign-title {
            font-size: 11px;
            font-weight: 800;
            color: #0f172a;
          }
          .sign-badge {
            display: inline-block;
            margin-top: 8px;
            padding: 4px 12px;
            border: 1px solid #10b981;
            background: #ecfdf5;
            color: #047857;
            font-size: 9.5px;
            font-weight: 800;
            border-radius: 4px;
            text-transform: uppercase;
          }
        </style>
      </head>
      <body>
        <div class="invoice-box">
          <div class="header-row">
            <div class="brand-col">
              <img src="${LOGO_BASE64}" class="logo-img" alt="HK Automation" />
              <div>
                <div class="brand-title">HariKrushn DigiVerse LLP</div>
                <div class="brand-subtitle">HK Automation &bull; Enterprise Cloud Platform</div>
                <div class="brand-meta">
                  Surat, Gujarat - 395006, India<br/>
                  Email: support@hkdigiverse.com &bull; Web: https://automation.hkdigiverse.com<br/>
                  GSTIN / Tax ID: 24AAOFH1234A1Z5
                </div>
              </div>
            </div>
            <div class="invoice-meta-col">
              <div class="invoice-title">TAX INVOICE</div>
              <div class="invoice-tag">Original for Recipient</div>
              <div class="meta-list">
                <div><strong>Invoice No:</strong> ${invoiceNo}</div>
                <div><strong>Invoice Date:</strong> ${invoiceDate}</div>
                <div><strong>Place of Supply:</strong> Gujarat (24)</div>
                <div><strong>Status:</strong> <span style="color:#059669; font-weight:800;">${status}</span></div>
              </div>
            </div>
          </div>

          <div class="info-grid">
            <div class="info-col">
              <div class="info-label">Billed To (Customer Details)</div>
              <div class="customer-name">${customerName}</div>
              <div class="customer-org">${companyName}</div>
              <div class="customer-email">${customerEmail}</div>
            </div>
            <div class="info-col">
              <div class="info-label">Payment & Reference</div>
              <div style="font-size:12px; color:#0f172a;"><strong>Mode:</strong> ${paymentMethod}</div>
              <div style="font-size:11px; color:#475569; margin-top:2px; font-family:monospace;"><strong>Txn / Ref ID:</strong> ${txnId}</div>
              <div style="font-size:11px; color:#059669; font-weight:700; margin-top:3px;">Payment Status: Confirmed & Settled</div>
            </div>
          </div>

          <table class="items-table">
            <thead>
              <tr>
                <th style="width: 5%;" class="text-center">#</th>
                <th style="width: 48%;">Service / Item Description</th>
                <th style="width: 14%;" class="text-center">SAC Code</th>
                <th style="width: 13%;" class="text-center">Duration</th>
                <th style="width: 20%;" class="text-right">Amount (INR)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="text-center" style="font-weight:700;">1</td>
                <td>
                  <div class="item-heading">Enterprise WhatsApp Marketing & Automation Platform</div>
                  <div class="item-desc">
                    Software Subscription License &bull; Full access to Official WhatsApp Cloud API integration, Visual AI Bot Flows, Broadcast Campaigns, Team Shared Inbox & CRM Contacts.
                  </div>
                </td>
                <td class="text-center" style="font-family:monospace; font-weight:600;">997331</td>
                <td class="text-center" style="font-weight:700;">${payment.planMonths} Month${payment.planMonths > 1 ? 's' : ''}</td>
                <td class="text-right" style="font-family:monospace; font-weight:700; font-size:13px;">₹${baseAmount.toLocaleString('en-IN')}</td>
              </tr>
            </tbody>
          </table>

          <div class="calc-row">
            <div class="calc-left">
              <div style="font-weight:700; color:#0f172a; margin-bottom:4px;">Billing Information</div>
              <div>Payment Mode: <strong>${paymentMethod}</strong></div>
              <div>Transaction ID: <span style="font-family:monospace;">${txnId}</span></div>
              <div style="margin-top:6px; font-size:10px; color:#64748b;">
                * WhatsApp conversation & template delivery charges are billed directly by Meta Platforms Inc. to your connected payment card.
              </div>
            </div>
            <div class="calc-right">
              <table class="calc-table">
                <tr>
                  <td>Subtotal (Taxable Value)</td>
                  <td class="text-right" style="font-family:monospace; font-weight:600;">₹${baseAmount.toLocaleString('en-IN')}</td>
                </tr>
                <tr>
                  <td>CGST (9%)</td>
                  <td class="text-right" style="font-family:monospace;">₹${cgst.toLocaleString('en-IN')}</td>
                </tr>
                <tr>
                  <td>SGST (9%)</td>
                  <td class="text-right" style="font-family:monospace;">₹${sgst.toLocaleString('en-IN')}</td>
                </tr>
                <tr class="grand-total-row">
                  <td><strong>Total Paid (INR)</strong></td>
                  <td class="text-right" style="font-family:monospace;">₹${totalAmount.toLocaleString('en-IN')}</td>
                </tr>
              </table>
            </div>
          </div>

          <div class="signatory-row">
            <div class="terms-block">
              <strong>Terms & Conditions:</strong><br/>
              1. This Tax Invoice is issued for software access license to HK Automation SaaS platform.<br/>
              2. This is a computer-generated tax invoice issued electronically pursuant to the Information Technology Act and requires no physical signature.<br/>
              3. For billing or invoice queries, contact support@hkdigiverse.com.
            </div>
            <div class="sign-block">
              <div class="sign-title">For HariKrushn DigiVerse LLP</div>
              <div class="sign-badge">&check; Digitally Verified & Authorized</div>
              <div style="font-size:10px; color:#64748b; margin-top:4px;">Authorized Signatory</div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 350);
  };


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
        const errMsg = err.response?.data?.error || err.response?.data?.details || err.message || 'Failed to load subscription data';
        toast.error(errMsg);
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
        name: 'HK Automation',
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

  const pendingPayment = payments?.find(p => p.status === 'pending');
  const selectedPlan = plans?.plans?.find(p => p.months === selectedMonths);
  const amountToPay = selectedPlan?.totalAmount || 0;
  const bankInfo = plans?.bankDetails || {
    companyName: 'Harikrushn DigiVerse LLP',
    accountHolder: 'Harikrushn DigiVerse LLP',
    bankName: 'HDFC Bank',
    accountNumber: '9240200573774150',
    ifscCode: 'UTIB00028912',
    branch: 'Kapodra, Surat',
    upiId: 'hkgigiverse@okhdfc'
  };

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
                  ? `Your subscription expired on ${formatDateOnly(current.subscriptionExpiryDate)}.`
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

      {/* Pending Payment Verification Alert Banner (Suggestion #2) */}
      {pendingPayment && (
        <div className="p-4 rounded-2xl border border-amber-300 dark:border-amber-800/80 bg-gradient-to-r from-amber-50 via-yellow-50/50 to-amber-50 dark:from-amber-950/30 dark:via-yellow-950/20 dark:to-amber-950/30 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-300/60 dark:border-amber-700/50 shadow-sm">
              <Clock className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <p className="font-bold text-sm text-amber-950 dark:text-amber-200 flex items-center gap-2">
                <span>Offline Payment Under Verification</span>
                <span className="font-mono text-[11px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                  {pendingPayment.invoiceNumber || 'INV-PENDING'}
                </span>
              </p>
              <p className="text-xs text-amber-800 dark:text-amber-300/90 mt-0.5">
                Your offline payment of ₹{pendingPayment.totalAmount?.toLocaleString('en-IN')} for {pendingPayment.planMonths} month{pendingPayment.planMonths > 1 ? 's' : ''} has been submitted for verification (Ref / UTR: <span className="font-mono font-bold text-amber-950 dark:text-amber-100">{pendingPayment.transactionId || 'Submitted'}</span>). Your subscription will be activated automatically once approved by the administrator.
              </p>
            </div>
          </div>
          <button
            onClick={() => setTab('history')}
            className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-95 text-white text-xs font-bold transition-all whitespace-nowrap cursor-pointer shadow-sm ml-auto sm:ml-0"
          >
            View Status in History ➔
          </button>
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
                  {current?.subscriptionExpiryDate ? formatDateOnly(current.subscriptionExpiryDate) : 'Not Set'}
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
                  className="flex items-center gap-4 p-5 rounded-xl border-2 border-wa-border dark:border-wa-dark-border hover:border-wa-green transition-all group text-left cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center">
                    <CreditCard className="w-6 h-6 text-wa-green" />
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-wa-text-primary dark:text-white flex items-center gap-2">
                      Pay Online (Instant)
                      <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold rounded-full uppercase tracking-wider">Fast UPI</span>
                    </p>
                    <p className="text-xs text-wa-text-secondary">Razorpay — Google Pay, PhonePe, Paytm, Cards</p>
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
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 disabled:opacity-50"
              >
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <CreditCard className="w-5 h-5" />}
                {submitting ? 'Processing...' : 'Pay with Razorpay'}
              </button>
              <button onClick={() => setPaymentMode(null)} className="w-full mt-2 py-2 text-sm text-wa-text-secondary hover:text-wa-text-primary transition-colors">
                ← Back to payment methods
              </button>
            </div>
          )}

          {/* Offline Payment with Official Company Bank & UPI Details Card */}
          {paymentMode === 'offline' && (
            <div className="space-y-6">
              {/* Official Company Bank & UPI Payment Details Card */}
              <div className="bg-gradient-to-br from-emerald-50/70 via-teal-50/40 to-slate-50 dark:from-emerald-950/20 dark:via-teal-950/10 dark:to-wa-dark-panel border-2 border-emerald-300/80 dark:border-emerald-800/60 rounded-2xl p-5 sm:p-6 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-200/60 dark:border-emerald-800/40 pb-4 mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-base text-wa-text-primary dark:text-white flex items-center gap-2">
                        <Building2 className="w-5 h-5 text-wa-green" />
                        Company Bank & UPI Payment Details
                      </h4>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                        Zero Gateway Fee
                      </span>
                    </div>
                    <p className="text-xs text-wa-text-secondary dark:text-wa-dark-text-secondary mt-1">
                      Transfer <strong className="text-emerald-700 dark:text-emerald-400">₹{amountToPay.toLocaleString('en-IN')}</strong> directly via UPI QR or NEFT / RTGS / IMPS. No additional convenience fees.
                    </p>
                  </div>
                  <div className="text-left sm:text-right">
                    <span className="text-[10px] uppercase font-bold text-wa-text-secondary">Payable Amount</span>
                    <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono leading-tight">
                      ₹{amountToPay.toLocaleString('en-IN')}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
                  {/* Left Column: Instant UPI QR Code */}
                  <div className="md:col-span-4 flex flex-col items-center justify-center p-4 bg-white dark:bg-wa-dark-search/60 rounded-xl border border-emerald-200/70 dark:border-emerald-800/40 text-center shadow-sm">
                    <div className="p-2 bg-white rounded-xl shadow-inner border border-slate-200">
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`upi://pay?pa=${bankInfo.upiId}&pn=${encodeURIComponent(bankInfo.companyName)}&am=${amountToPay}&cu=INR`)}`}
                        alt="UPI QR Code"
                        className="w-32 h-32 object-contain"
                      />
                    </div>
                    <span className="text-[11px] font-bold text-wa-text-primary dark:text-white mt-2 flex items-center gap-1">
                      <QrCode className="w-3.5 h-3.5 text-wa-green" /> Scan with Any UPI App
                    </span>
                    <span className="text-[10px] text-wa-text-secondary">Google Pay &bull; PhonePe &bull; Paytm &bull; BHIM</span>

                    {/* UPI ID with copy button */}
                    <div className="mt-3 w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-xs">
                      <span className="font-mono font-bold text-emerald-800 dark:text-emerald-300 truncate text-[11px]">{bankInfo.upiId}</span>
                      <button
                        type="button"
                        onClick={() => handleCopy(bankInfo.upiId, 'upi')}
                        className="p-1 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 rounded text-emerald-700 dark:text-emerald-300 transition-colors cursor-pointer"
                        title="Copy UPI ID"
                      >
                        {copiedField === 'upi' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Right Column: Bank Account Details for NEFT/IMPS/RTGS */}
                  <div className="md:col-span-8 space-y-2.5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                      <div className="p-3 bg-white dark:bg-wa-dark-search/60 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                        <div className="min-w-0 pr-2">
                          <span className="text-[10px] font-semibold text-wa-text-secondary uppercase">Account Name</span>
                          <p className="font-bold text-wa-text-primary dark:text-white truncate mt-0.5">{bankInfo.companyName}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopy(bankInfo.companyName, 'name')}
                          className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 hover:text-wa-green transition-colors cursor-pointer shrink-0"
                          title="Copy Account Name"
                        >
                          {copiedField === 'name' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>

                      <div className="p-3 bg-white dark:bg-wa-dark-search/60 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                        <div className="min-w-0 pr-2">
                          <span className="text-[10px] font-semibold text-wa-text-secondary uppercase">Bank Name</span>
                          <p className="font-bold text-wa-text-primary dark:text-white truncate mt-0.5">{bankInfo.bankName}</p>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded font-semibold shrink-0">{bankInfo.branch}</span>
                      </div>

                      <div className="p-3 bg-white dark:bg-wa-dark-search/60 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                        <div className="min-w-0 pr-2">
                          <span className="text-[10px] font-semibold text-wa-text-secondary uppercase">Account Number</span>
                          <p className="font-mono font-bold text-wa-text-primary dark:text-white text-sm mt-0.5">{bankInfo.accountNumber}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopy(bankInfo.accountNumber, 'acc')}
                          className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 hover:text-wa-green transition-colors cursor-pointer shrink-0"
                          title="Copy Account Number"
                        >
                          {copiedField === 'acc' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>

                      <div className="p-3 bg-white dark:bg-wa-dark-search/60 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                        <div className="min-w-0 pr-2">
                          <span className="text-[10px] font-semibold text-wa-text-secondary uppercase">IFSC Code</span>
                          <p className="font-mono font-bold text-wa-text-primary dark:text-white text-sm mt-0.5">{bankInfo.ifscCode}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopy(bankInfo.ifscCode, 'ifsc')}
                          className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 hover:text-wa-green transition-colors cursor-pointer shrink-0"
                          title="Copy IFSC Code"
                        >
                          {copiedField === 'ifsc' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-emerald-100/70 dark:bg-emerald-950/40 text-[11px] text-emerald-900 dark:text-emerald-300 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>After completing the transfer, enter your <strong>12-digit UTR / Reference Number</strong> below and attach the payment screenshot as proof.</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Offline Proof Submission Form */}
              <div className="bg-white dark:bg-wa-dark-panel rounded-2xl border border-wa-border dark:border-wa-dark-border p-6 shadow-sm">
                <h3 className="text-base font-bold text-wa-text-primary dark:text-white mb-4">Submit Payment Verification Proof</h3>
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
                      <td className="px-5 py-3 font-mono text-xs">
                        <button
                          onClick={() => setViewInvoiceModal({ open: true, payment: p })}
                          className="font-bold text-wa-green hover:underline flex items-center gap-1.5 group cursor-pointer"
                          title="Click to view / print Tax Invoice"
                        >
                          <FileText className="w-3.5 h-3.5 text-wa-green group-hover:scale-110 transition-transform" />
                          {p.invoiceNumber || 'INV-PENDING'}
                        </button>
                      </td>
                      <td className="px-5 py-3">{p.planMonths} Month{p.planMonths > 1 ? 's' : ''}</td>
                      <td className="px-5 py-3 text-wa-text-secondary">{formatDateOnly(p.createdAt)}</td>
                      <td className="px-5 py-3 font-semibold">₹{p.totalAmount?.toLocaleString('en-IN')}</td>
                      <td className="px-5 py-3">
                        <span className="capitalize">{p.paymentMethod?.replace('_', ' ')}</span>
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-wa-text-secondary">{p.transactionId || p.razorpayPaymentId || '-'}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          {statusBadge(p.status)}
                          {p.status === 'rejected' && (
                            <button
                              onClick={() => setRejectionModal({ open: true, reason: p.rejectionReason, invoice: p.invoiceNumber || 'Offline Payment' })}
                              className="p-1 text-wa-text-secondary hover:text-wa-green transition-all rounded-full hover:bg-wa-hover dark:hover:bg-wa-dark-hover"
                              title="Click to view rejection reason"
                              aria-label="View rejection reason"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      
      {/* Official Tax Invoice Modal */}
      {viewInvoiceModal.open && viewInvoiceModal.payment && (
        <Portal>
          <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 overflow-y-auto animate-fadeIn print:bg-white print:p-0 print:static">
            {/* Print Isolation CSS */}
            <style>{`
              @media print {
                @page { size: A4 portrait; margin: 12mm 15mm; }
                body * { visibility: hidden !important; }
                #invoice-print-area, #invoice-print-area * { visibility: visible !important; }
                #invoice-print-area {
                  position: absolute !important;
                  left: 0 !important;
                  top: 0 !important;
                  width: 100% !important;
                  max-width: 100% !important;
                  margin: 0 !important;
                  padding: 10px !important;
                  background: #ffffff !important;
                  color: #0f172a !important;
                  box-shadow: none !important;
                  border: none !important;
                  border-radius: 0 !important;
                }
                .no-print { display: none !important; }
              }
            `}</style>

            <div
              id="invoice-print-area"
              className="bg-white dark:bg-wa-dark-panel rounded-3xl border border-wa-border dark:border-wa-dark-border max-w-2xl w-full p-6 sm:p-8 shadow-2xl animate-zoomIn my-6 text-slate-900 dark:text-white print:text-black print:bg-white print:border-none print:shadow-none print:max-w-none print:p-0"
            >
              {/* Top Header with Real Official Logo */}
              <div className="flex items-start justify-between border-b border-slate-200 dark:border-slate-800 pb-5">
                <div className="flex items-center gap-4">
                  <img
                    src={LOGO_BASE64}
                    alt="HK Automation"
                    className="h-12 w-auto object-contain shrink-0"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-black text-slate-900 dark:text-white tracking-tight">HK Automation</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                        TAX INVOICE
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 font-medium">HariKrushn DigiVerse LLP &bull; Enterprise Cloud Platform</p>
                    <p className="text-[11px] text-slate-400 font-mono">Surat, Gujarat &bull; support@hkdigiverse.com</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setViewInvoiceModal({ open: false, payment: null })}
                  className="no-print p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  title="Close Invoice"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Invoice Meta Grid */}
              <div className="grid grid-cols-2 gap-6 py-5 border-b border-slate-200 dark:border-slate-800 text-xs">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Invoice Details</span>
                  <p className="font-mono font-bold text-base text-slate-900 dark:text-white print:text-black mt-1">
                    {viewInvoiceModal.payment.invoiceNumber || 'INV-PENDING'}
                  </p>
                  <p className="text-slate-500 mt-1 font-medium">
                    Date: <span className="font-semibold text-slate-700 dark:text-slate-300 print:text-black">{formatDateOnly(viewInvoiceModal.payment.createdAt)}</span>
                  </p>
                  <div className="mt-2.5 flex items-center gap-2">
                    <span className="text-slate-500 font-medium">Payment Status:</span>
                    <div>
                      {statusBadge(viewInvoiceModal.payment.status)}
                    </div>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Billed To (Customer)</span>
                  <p className="font-bold text-sm text-slate-900 dark:text-white print:text-black mt-1">
                    {user?.name || 'Customer'}
                  </p>
                  <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 mt-0.5">
                    {current?.organizationName || 'Client Organization'}
                  </p>
                  <p className="text-slate-500 font-mono text-[11px] mt-0.5 truncate">{user?.email || ''}</p>
                </div>
              </div>

              {/* Line Items Table */}
              <div className="py-5">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b-2 border-slate-200 dark:border-slate-700 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                      <th className="text-left py-2.5">Item Description</th>
                      <th className="text-center py-2.5">Plan Duration</th>
                      <th className="text-right py-2.5">Amount (INR)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    <tr>
                      <td className="py-3.5 pr-2">
                        <p className="font-bold text-sm text-slate-900 dark:text-white print:text-black">
                          Enterprise WhatsApp Automation Subscription
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                          Full enterprise suite: AI Bot Flows, Broadcast Campaigns, Team Inbox, Meta API Integration & Contacts.
                        </p>
                      </td>
                      <td className="py-3.5 text-center font-bold text-slate-700 dark:text-slate-200 print:text-black whitespace-nowrap">
                        {viewInvoiceModal.payment.planMonths} Month{viewInvoiceModal.payment.planMonths > 1 ? 's' : ''}
                      </td>
                      <td className="py-3.5 text-right font-mono font-bold text-slate-900 dark:text-white print:text-black text-sm whitespace-nowrap">
                        ₹{(viewInvoiceModal.payment.amount || (viewInvoiceModal.payment.totalAmount - (viewInvoiceModal.payment.taxAmount || 0)))?.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Tax & Total Summary Card */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 print:bg-slate-50 space-y-2 text-xs border border-slate-200 dark:border-slate-700 mb-6">
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Subtotal (Base Platform Fee)</span>
                  <span className="font-mono font-semibold">₹{(viewInvoiceModal.payment.amount || (viewInvoiceModal.payment.totalAmount - (viewInvoiceModal.payment.taxAmount || 0)))?.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>GST / Tax (18%)</span>
                  <span className="font-mono font-semibold">₹{(viewInvoiceModal.payment.taxAmount || 0)?.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-sm font-black border-t border-slate-200 dark:border-slate-700 pt-2 text-slate-900 dark:text-white">
                  <span>Total Amount Paid</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400 text-lg">
                    ₹{viewInvoiceModal.payment.totalAmount?.toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-200/80 dark:border-slate-700/80 font-mono gap-1">
                  <span>Payment Method: <strong className="text-slate-700 dark:text-slate-300">{viewInvoiceModal.payment.paymentMethod?.replace('_', ' ').toUpperCase()}</strong></span>
                  <span>Transaction ID: <strong className="text-slate-700 dark:text-slate-300">{viewInvoiceModal.payment.transactionId || viewInvoiceModal.payment.razorpayPaymentId || 'N/A'}</strong></span>
                </div>
              </div>

              {/* Computer Generated Legal Footer */}
              <div className="text-center text-[10px] text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-4 mb-5">
                <p>This is an electronically generated Tax Invoice and requires no physical signature.</p>
                <p className="mt-0.5">Thank you for partnering with HariKrushn DigiVerse / HK Automation!</p>
              </div>

              {/* Action Buttons */}
              <div className="no-print flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handlePrintInvoice(viewInvoiceModal.payment)}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all shadow-md shadow-emerald-700/20 text-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Printer className="w-4 h-4" /> Print / Save as PDF
                </button>
                <button
                  type="button"
                  onClick={() => setViewInvoiceModal({ open: false, payment: null })}
                  className="px-6 py-3 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* Rejection Reason Modal */}
      {rejectionModal.open && (
        <Portal>
          <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-fadeIn">
            <div className="bg-white dark:bg-wa-dark-panel rounded-2xl border border-wa-border dark:border-wa-dark-border max-w-sm w-full p-6 shadow-2xl animate-zoomIn text-center">
              <div className="flex items-center gap-3 text-red-500 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-950/30 flex items-center justify-center">
                  <XCircle className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <h3 className="font-bold text-wa-text-primary dark:text-white">Payment Rejected</h3>
                  <p className="text-[10px] text-wa-text-secondary dark:text-wa-dark-text-secondary font-mono mt-0.5">{rejectionModal.invoice}</p>
                </div>
              </div>
              <div className="bg-wa-search dark:bg-wa-dark-search rounded-xl p-4 border border-wa-border dark:border-wa-dark-border mb-5 text-left">
                <p className="text-[10px] font-bold text-wa-text-secondary dark:text-wa-dark-text-secondary uppercase tracking-wider mb-1.5">Reason for Rejection</p>
                <p className="text-sm text-wa-text-primary dark:text-white leading-relaxed break-words font-medium">{rejectionModal.reason || 'No reason specified by administrator.'}</p>
              </div>
              <button
                onClick={() => setRejectionModal({ open: false, reason: '', invoice: '' })}
                className="w-full py-2.5 bg-wa-green hover:bg-wa-green-hover text-white font-semibold rounded-xl transition-colors text-sm shadow-sm"
              >
                Close
              </button>
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}
