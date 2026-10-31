'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuthStore, useConfirmStore } from '../../../lib/store';
import api from '../../../lib/api';
import toast from 'react-hot-toast';
import { formatDateOnly } from '../../../lib/utils';
import FeaturePermissionsTab from '../../../components/FeaturePermissionsTab';
import Portal from '../../../components/Portal';
import { LOGO_BASE64 } from '../../../lib/logoBase64';
import {
  Shield, Activity, Database, Cpu, Layers, UserX, UserCheck,
  RefreshCw, Play, Pause, Trash2, Search, Users, CheckCircle2,
  XCircle, AlertCircle, HardDrive, Clock, Plus, Edit2, Lock,
  Globe, Building, Mail, Phone, Calendar, Upload, ImageIcon, X, Loader2,
  CreditCard, IndianRupee, CheckCircle, Ban, Eye, Printer, FileText, ArrowUpRight,
  ChevronDown, ChevronUp, ChevronsUpDown, Building2,
  Download, TrendingUp, BarChart3, Filter
} from 'lucide-react';

export default function AdminPanel() {
  const { user } = useAuthStore();
  const confirm = useConfirmStore((state) => state.confirm);
  const [activeTab, setActiveTab] = useState('organizations'); // health, queues, organizations
  const [healthData, setHealthData] = useState(null);
  const [organizations, setOrganizations] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');

  // Logo upload states
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef(null);
  const [message, setMessage] = useState('');

  // Org modal states
  const [isOrgModalOpen, setIsOrgModalOpen] = useState(false);
  const [editingOrgId, setEditingOrgId] = useState(null);
  const [orgForm, setOrgForm] = useState({
    name: '',
    logo: '',
    businessType: '',
    industry: '',
    website: '',
    address: '',
    city: '',
    state: '',
    country: '',
    gstNumber: '',
    contactPerson: '',
    contactEmail: '',
    contactNumber: '',
    plan: 'free',
    maxTelecallers: 5,
    maxLeads: 1000,
    maxMonthlyConversations: 1000,
    adminName: '',
    adminEmail: '',
    adminUsername: '',
    adminPassword: '',
  });

  // Password reset modal states
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [resetUserId, setResetUserId] = useState(null);
  const [resetEmail, setResetEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // Subscription management states
  const [subDashboard, setSubDashboard] = useState(null);
  const [subOrgs, setSubOrgs] = useState([]);
  const [pendingPayments, setPendingPayments] = useState([]);
  const [planConfig, setPlanConfig] = useState(null);
  const [planForm, setPlanForm] = useState({ monthlyPrice: 2000, taxPercentage: 0, gracePeriodDays: 0 });
  const [subView, setSubView] = useState('dashboard'); // dashboard, history, config, payments, orgs
  const [allPayments, setAllPayments] = useState([]);
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [paymentSearch, setPaymentSearch] = useState('');
  const [viewInvoiceModal, setViewInvoiceModal] = useState({ open: false, payment: null });
  const [expandedClients, setExpandedClients] = useState({});
  const [historyLayout, setHistoryLayout] = useState('hierarchy'); // 'hierarchy' (grouped by client) | 'feed' (flat)
  const [dateFilter, setDateFilter] = useState('all'); // 'all' | 'this_month' | 'last_month' | 'custom'
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [rejectModal, setRejectModal] = useState({ open: false, paymentId: null, clientName: '', amount: 0, reason: '' });

  // Export to CSV Function for SuperAdmin Accounting & CA Filing
  const handleExportCSV = (paymentsToExport) => {
    if (!paymentsToExport || paymentsToExport.length === 0) {
      toast.error('No payments to export');
      return;
    }

    const headers = [
      'Invoice Number',
      'Date',
      'Client / Organization',
      'Contact Name',
      'Contact Email',
      'Contact Phone',
      'Plan Duration (Months)',
      'Payment Mode',
      'Transaction / UTR ID',
      'Taxable Base Amount (INR)',
      'Tax Amount (INR)',
      'Total Amount (INR)',
      'Status'
    ];

    const rows = paymentsToExport.map((p) => {
      const orgName = p.organizationId?.name || 'Unknown Client';
      const clientName = p.owner?.name || p.organizationId?.owner?.name || p.organizationId?.contactEmail?.split('@')[0] || '';
      const email = p.owner?.email || p.organizationId?.contactEmail || '';
      const phone = p.owner?.phone || p.organizationId?.contactNumber || '';
      const baseAmt = p.amount || (p.totalAmount ? (p.totalAmount - (p.taxAmount || 0)) : 0);
      const taxAmt = p.taxAmount || 0;
      const totalAmt = p.totalAmount || (baseAmt + taxAmt);
      const dateStr = formatDateOnly(p.createdAt);

      return [
        `"${p.invoiceNumber || 'INV-PENDING'}"`,
        `"${dateStr}"`,
        `"${orgName.replace(/"/g, '""')}"`,
        `"${clientName.replace(/"/g, '""')}"`,
        `"${email}"`,
        `"${phone}"`,
        p.planMonths || 1,
        `"${(p.paymentMethod || '').replace(/_/g, ' ').toUpperCase()}"`,
        `"${(p.transactionId || p.razorpayPaymentId || '').replace(/"/g, '""')}"`,
        baseAmt,
        taxAmt,
        totalAmt,
        `"${(p.status || '').toUpperCase()}"`
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    const today = new Date().toISOString().slice(0, 10);
    link.setAttribute('download', `HK_Platform_Collections_Report_${today}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${paymentsToExport.length} transactions to CSV`);
  };

  const toggleClientExpand = (orgId) => {
    setExpandedClients((prev) => ({
      ...prev,
      [orgId]: !(prev[orgId] ?? true),
    }));
  };

  const handleExpandAllClients = (groups) => {
    const all = {};
    groups.forEach((g) => { all[g.orgId] = true; });
    setExpandedClients(all);
  };

  const handleCollapseAllClients = (groups) => {
    const all = {};
    groups.forEach((g) => { all[g.orgId] = false; });
    setExpandedClients(all);
  };

  // Fetch health stats
  const fetchHealth = useCallback(async () => {
    try {
      const { data } = await api.get('/admin/health');
      if (data.success) {
        setHealthData(data.data);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch system health status.');
    }
  }, []);

  // Fetch all organizations
  const fetchOrganizations = useCallback(async () => {
    try {
      const { data } = await api.get('/admin/organizations');
      if (data.success) {
        setOrganizations(data.data);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch organizations.');
    }
  }, []);

  // Fetch subscription management data
  const fetchSubscriptionData = useCallback(async () => {
    try {
      const [dashRes, orgsRes, pendingRes, configRes, paymentsRes] = await Promise.all([
        api.get('/subscription/admin/dashboard').catch(err => { console.warn('Dashboard fetch error:', err.message); return null; }),
        api.get('/subscription/admin/organizations').catch(err => { console.warn('Orgs fetch error:', err.message); return null; }),
        api.get('/subscription/admin/pending-payments').catch(err => { console.warn('Pending fetch error:', err.message); return null; }),
        api.get('/subscription/plans').catch(err => { console.warn('Plans fetch error:', err.message); return null; }),
        api.get('/subscription/admin/payments').catch(err => { console.warn('Payments fetch error:', err.message); return null; })
      ]);
      if (dashRes?.data?.data) {
        setSubDashboard(dashRes.data.data);
      }
      if (orgsRes?.data?.data) {
        setSubOrgs(orgsRes.data.data);
      }
      if (pendingRes?.data?.data) {
        setPendingPayments(pendingRes.data.data);
      }
      if (paymentsRes?.data?.data) {
        setAllPayments(paymentsRes.data.data);
      }
      if (configRes?.data?.data) {
        setPlanConfig(configRes.data.data);
        setPlanForm({ monthlyPrice: configRes.data.data.monthlyPrice, taxPercentage: configRes.data.data.taxPercentage, gracePeriodDays: 0 });
      }
    } catch (err) {
      console.error('Failed to fetch subscription data:', err.message);
    }
  }, []);

  // Initial load
  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    setMessage('');
    if (user?.role === 'superadmin') {
      await Promise.all([fetchHealth(), fetchOrganizations(), fetchSubscriptionData()]);
    }
    setLoading(false);
  }, [user, fetchHealth, fetchOrganizations, fetchSubscriptionData]);

  // Read URL query params on mount to support direct linking from header badge or sidebar
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      const subParam = params.get('sub');
      if (tabParam) {
        setActiveTab(tabParam);
        if (tabParam === 'subscriptions') {
          fetchSubscriptionData();
        }
      }
      if (subParam) {
        setSubView(subParam);
      }
    }
  }, [fetchSubscriptionData]);

  useEffect(() => {
    loadData();
  }, [user, loadData]);

  // Queue actions
  const handleQueueControl = async (queueName, action, type = '') => {
    setActionLoading(true);
    setError('');
    setMessage('');
    try {
      const { data } = await api.post('/admin/queues/control', { queueName, action, type });
      if (data.success) {
        toast.success(data.message);
        await fetchHealth();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to execute queue command.');
    } finally {
      setActionLoading(false);
    }
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
    const customerName = payment.owner?.name || payment.organizationId?.owner?.name || payment.organizationId?.contactEmail?.split('@')[0] || 'Valued Customer';
    const companyName = payment.organizationId?.name || (typeof payment.organizationId === 'string' ? payment.organizationId : 'Client Organization');
    const customerEmail = payment.owner?.email || payment.organizationId?.contactEmail || '';
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
          @page { size: A4 portrait; margin: 12mm 15mm; }
          * { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0f172a; background: #ffffff; font-size: 12px; line-height: 1.5; padding: 8px 0; }
          .invoice-box { width: 100%; max-width: 800px; margin: 0 auto; }
          .header-row { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #059669; padding-bottom: 16px; margin-bottom: 20px; }
          .brand-col { display: flex; align-items: center; gap: 14px; }
          .logo-img { height: 48px; width: auto; object-fit: contain; }
          .brand-title { font-size: 18px; font-weight: 900; color: #0f172a; letter-spacing: -0.3px; }
          .brand-subtitle { font-size: 11px; font-weight: 700; color: #059669; }
          .brand-meta { font-size: 10.5px; color: #64748b; margin-top: 2px; }
          .invoice-meta-col { text-align: right; }
          .invoice-title { font-size: 22px; font-weight: 900; color: #059669; letter-spacing: 0.5px; }
          .invoice-tag { display: inline-block; background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; font-size: 9.5px; font-weight: 800; padding: 2px 8px; border-radius: 4px; text-transform: uppercase; margin-top: 3px; }
          .meta-list { margin-top: 6px; font-size: 11px; color: #334155; line-height: 1.6; }
          .info-grid { display: flex; justify-content: space-between; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 18px; margin-bottom: 22px; gap: 20px; }
          .info-col { flex: 1; }
          .info-col:first-child { border-right: 1px solid #e2e8f0; padding-right: 18px; }
          .info-label { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px; color: #64748b; margin-bottom: 4px; }
          .customer-name { font-size: 14px; font-weight: 800; color: #0f172a; }
          .customer-org { font-size: 12px; font-weight: 600; color: #059669; margin-top: 1px; }
          .customer-email { font-size: 11px; color: #64748b; margin-top: 2px; }
          .items-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          .items-table th { background: #f1f5f9; color: #334155; font-size: 10.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; padding: 10px 12px; border: 1px solid #cbd5e1; text-align: left; }
          .items-table td { padding: 12px; border: 1px solid #e2e8f0; vertical-align: top; font-size: 11.5px; }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .item-heading { font-size: 13px; font-weight: 800; color: #0f172a; }
          .item-desc { font-size: 10.5px; color: #64748b; margin-top: 3px; line-height: 1.4; }
          .calc-row { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 22px; gap: 20px; }
          .calc-left { flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; font-size: 11px; color: #475569; line-height: 1.6; }
          .calc-right { width: 320px; border: 1px solid #e2e8f0; border-radius: 8px; background: #f8fafc; overflow: hidden; }
          .calc-table { width: 100%; border-collapse: collapse; }
          .calc-table td { padding: 8px 14px; font-size: 11.5px; }
          .grand-total-row { background: #ecfdf5; border-top: 2px solid #059669; color: #059669; font-weight: 900; font-size: 14px; }
          .signatory-row { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 30px; padding-top: 15px; border-top: 1px dashed #cbd5e1; }
          .terms-block { font-size: 9.5px; color: #94a3b8; line-height: 1.5; max-width: 480px; }
          .sign-block { text-align: right; }
          .sign-title { font-size: 11px; font-weight: 800; color: #0f172a; }
          .sign-badge { display: inline-block; margin-top: 8px; padding: 4px 12px; border: 1px solid #10b981; background: #ecfdf5; color: #047857; font-size: 9.5px; font-weight: 800; border-radius: 4px; text-transform: uppercase; }
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


  const handleUpdatePlanConfig = async () => {
    try {
      await api.put('/subscription/admin/plan-config', planForm);
      toast.success('Plan configuration updated');
      fetchSubscriptionData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update config');
    }
  };

  const handleVerifyPayment = async (paymentId, action, rejectionReason = '') => {
    try {
      await api.post(`/subscription/admin/verify/${paymentId}`, { action, rejectionReason });
      toast.success(action === 'approve' ? 'Payment approved!' : 'Payment rejected');
      fetchSubscriptionData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to verify payment');
    }
  };

  // Handle logo file selection
  const handleLogoFileSelect = (file) => {
    if (!file) return;
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Only image files (JPG, PNG, GIF, WEBP, SVG) are allowed');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Logo file must be under 5MB');
      return;
    }
    setLogoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setLogoPreview(reader.result);
    reader.readAsDataURL(file);
  };

  // Upload logo to server and return URL
  const uploadLogo = async () => {
    if (!logoFile) return orgForm.logo;
    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append('logo', logoFile);
      const { data } = await api.post('/admin/upload-logo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (data.success) {
        return data.data.url;
      }
      throw new Error('Upload failed');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to upload logo');
      return orgForm.logo;
    } finally {
      setUploadingLogo(false);
    }
  };

  // Create or Update Organization
  const handleOrgSubmit = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      // Upload logo file first if a new file was selected
      let logoUrl = orgForm.logo;
      if (logoFile) {
        logoUrl = await uploadLogo();
      }
      const submitData = { ...orgForm, logo: logoUrl };

      let res;
      if (editingOrgId) {
        res = await api.put(`/admin/organizations/${editingOrgId}`, submitData);
      } else {
        res = await api.post('/admin/organizations', submitData);
      }

      if (res.data.success) {
        toast.success(editingOrgId ? 'Organization updated successfully' : 'Organization and Admin created successfully');
        setIsOrgModalOpen(false);
        setOrgForm({
          name: '', logo: '', businessType: '', industry: '', website: '',
          address: '', city: '', state: '', country: '', gstNumber: '',
          contactPerson: '', contactEmail: '', contactNumber: '', plan: 'free',
          maxTelecallers: 5, maxLeads: 1000, maxMonthlyConversations: 1000,
          adminName: '', adminEmail: '', adminUsername: '', adminPassword: '',
        });
        setEditingOrgId(null);
        setLogoFile(null);
        setLogoPreview('');
        await fetchOrganizations();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to submit organization details');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditOrg = (org) => {
    setEditingOrgId(org._id);
    setOrgForm({
      name: org.name || '',
      logo: org.logo || '',
      businessType: org.businessType || '',
      industry: org.industry || '',
      website: org.website || '',
      address: org.address || '',
      city: org.city || '',
      state: org.state || '',
      country: org.country || '',
      gstNumber: org.gstNumber || '',
      contactPerson: org.contactPerson || '',
      contactEmail: org.contactEmail || '',
      contactNumber: org.contactNumber || '',
      plan: org.plan || 'free',
      maxTelecallers: org.maxTelecallers ?? 5,
      maxLeads: org.maxLeads ?? 1000,
      maxMonthlyConversations: org.maxMonthlyConversations ?? 1000,
      adminName: org.adminName || '',
      adminEmail: org.adminEmail || '',
      adminUsername: '',
      adminPassword: '',
      status: org.status || 'active'
    });
    setIsOrgModalOpen(true);
    setLogoFile(null);
    setLogoPreview('');
  };

  const handleToggleOrgSuspension = async (orgId, currentStatus) => {
    const confirmed = await confirm(`Are you sure you want to ${currentStatus === 'active' ? 'suspend' : 'activate'} this organization?`, 'Toggle Organization Status');
    if (!confirmed) return;
    setActionLoading(true);
    try {
      const nextStatus = currentStatus === 'active' ? 'suspended' : 'active';
      const { data } = await api.put(`/admin/organizations/${orgId}`, { status: nextStatus });
      if (data.success) {
        toast.success(`Organization has been ${nextStatus === 'suspended' ? 'suspended' : 'activated'}`);
        await fetchOrganizations();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to toggle suspension');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteOrg = async (orgId) => {
    const confirmed = await confirm('Are you sure you want to permanently delete this organization? All related user accounts will be suspended.', 'Delete Organization');
    if (!confirmed) return;
    setActionLoading(true);
    try {
      const { data } = await api.delete(`/admin/organizations/${orgId}`);
      if (data.success) {
        toast.success('Organization deleted successfully');
        await fetchOrganizations();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete organization');
    } finally {
      setActionLoading(false);
    }
  };

  // Reset Admin Password
  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 8) {
      toast.error('Password must be at least 8 characters long');
      return;
    }
    setActionLoading(true);
    try {
      const { data } = await api.post(`/admin/users/${resetUserId}/reset-password`, { newPassword });
      if (data.success) {
        toast.success('Admin password reset successfully');
        setIsPasswordModalOpen(false);
        setNewPassword('');
        setResetUserId(null);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to reset password');
    } finally {
      setActionLoading(false);
    }
  };

  const openResetPasswordModal = (org) => {
    // 1. Prioritize direct adminId matching if present
    if (org.adminId && org.adminId !== 'None' && org.adminEmail && org.adminEmail !== 'N/A') {
      setResetUserId(org.adminId);
      setResetEmail(org.adminEmail);
      setIsPasswordModalOpen(true);
      return;
    }

    // Fallback: Find the Admin user _id for resetting by querying user list
    api.get('/admin/users').then(({ data }) => {
      const users = data.data || [];
      
      // 1. Try to find by matching adminEmail case-insensitively
      let admin = users.find(u => 
        u.email && org.adminEmail && 
        u.email.trim().toLowerCase() === org.adminEmail.trim().toLowerCase()
      );
      
      // 2. Try to find by matching contactEmail case-insensitively (fallback)
      if (!admin) {
        admin = users.find(u => 
          u.email && org.contactEmail && 
          u.email.trim().toLowerCase() === org.contactEmail.trim().toLowerCase()
        );
      }
      
      // 3. Try to find by organization ID and administrative role (fallback)
      if (!admin && org._id) {
        admin = users.find(u => 
          u.organizationId === org._id && 
          ['superadmin', 'owner', 'admin'].includes(u.role)
        );
      }
      
      // 4. Try to find any user belonging to the organization (fallback)
      if (!admin && org._id) {
        admin = users.find(u => u.organizationId === org._id);
      }

      if (admin) {
        setResetUserId(admin._id);
        setResetEmail(admin.email);
        setIsPasswordModalOpen(true);
      } else {
        toast.error('Admin user account not found for password reset');
      }
    }).catch(() => {
      toast.error('Failed to load user accounts for validation');
    });
  };

  // Format bytes helper
  const formatBytes = (bytes, decimals = 2) => {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  // Format uptime helper
  const formatUptime = (seconds) => {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const parts = [];
    if (d > 0) parts.push(`${d}d`);
    if (h > 0) parts.push(`${h}h`);
    if (m > 0 || parts.length === 0) parts.push(`${m}m`);
    return parts.join(' ');
  };

  // Filtered organizations
  const filteredOrgs = organizations.filter((o) =>
    o.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    o.contactEmail?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    o.adminName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Access check
  if (user?.role !== 'superadmin') {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-red-550/10 rounded-2xl border border-red-500/20 text-red-500 max-w-xl mx-auto mt-20">
        <AlertCircle className="w-12 h-12 mb-4" />
        <h3 className="text-xl font-bold mb-2">Access Denied</h3>
        <p className="text-sm text-center">You do not have administrative permissions to view this panel.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-dark-200 dark:border-dark-700 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-brand-500/10 dark:bg-brand-500/20 text-brand-500 rounded-2xl flex items-center justify-center">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold dark:text-white">Admin & Operations Control</h2>
            <p className="text-sm text-dark-500 dark:text-dark-400 font-medium">SaaS Multi-tenant organizations management, limits, health monitoring</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setEditingOrgId(null);
              setOrgForm({
                name: '', logo: '', businessType: '', industry: '', website: '',
                address: '', city: '', state: '', country: '', gstNumber: '',
                contactPerson: '', contactEmail: '', contactNumber: '', plan: 'free',
                maxTelecallers: 5, maxLeads: 1000, maxMonthlyConversations: 1000,
                adminName: '', adminEmail: '', adminUsername: '', adminPassword: '',
              });
              setIsOrgModalOpen(true);
            }}
            className="btn-primary py-2.5 px-4 text-xs font-bold flex items-center gap-1.5 shadow-md"
          >
            <Plus className="w-4 h-4" /> Create Organization
          </button>
          <button
            onClick={loadData}
            disabled={loading || actionLoading}
            className="btn-secondary flex items-center gap-2 py-2.5 px-4 shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${(loading || actionLoading) ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Navigation tabs */}
      <div className="flex border-b border-dark-200 dark:border-dark-700">
        <button
          onClick={() => setActiveTab('organizations')}
          className={`px-5 py-3 font-semibold text-sm transition-colors border-b-2 -mb-[2px] flex items-center gap-2 ${
            activeTab === 'organizations'
              ? 'border-brand-500 text-brand-600 dark:text-brand-400'
              : 'border-transparent text-dark-500 hover:text-dark-800 dark:hover:text-dark-200'
          }`}
        >
          <Building className="w-4 h-4" />
          <span>Organizations ({organizations.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('health')}
          className={`px-5 py-3 font-semibold text-sm transition-colors border-b-2 -mb-[2px] flex items-center gap-2 ${
            activeTab === 'health'
              ? 'border-brand-500 text-brand-600 dark:text-brand-400'
              : 'border-transparent text-dark-500 hover:text-dark-800 dark:hover:text-dark-200'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>System Health</span>
        </button>
        <button
          onClick={() => setActiveTab('queues')}
          className={`px-5 py-3 font-semibold text-sm transition-colors border-b-2 -mb-[2px] flex items-center gap-2 ${
            activeTab === 'queues'
              ? 'border-brand-500 text-brand-600 dark:text-brand-400'
              : 'border-transparent text-dark-500 hover:text-dark-800 dark:hover:text-dark-200'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Queues & Tasks</span>
        </button>
        <button
          onClick={() => { setActiveTab('subscriptions'); fetchSubscriptionData(); }}
          className={`px-5 py-3 font-semibold text-sm transition-colors border-b-2 -mb-[2px] flex items-center gap-2 ${
            activeTab === 'subscriptions'
              ? 'border-brand-500 text-brand-600 dark:text-brand-400'
              : 'border-transparent text-dark-500 hover:text-dark-800 dark:hover:text-dark-200'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>Subscriptions{pendingPayments.length > 0 ? ` (${pendingPayments.length})` : ''}</span>
        </button>
        <button
          onClick={() => setActiveTab('permissions')}
          className={`px-5 py-3 font-semibold text-sm transition-colors border-b-2 -mb-[2px] flex items-center gap-2 ${
            activeTab === 'permissions'
              ? 'border-brand-500 text-brand-600 dark:text-brand-400'
              : 'border-transparent text-dark-500 hover:text-dark-800 dark:hover:text-dark-200'
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>Feature Permissions</span>
        </button>
      </div>

      {/* Tabs Content */}
      <div className="pt-2">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-24">
            <RefreshCw className="w-8 h-8 animate-spin text-brand-500 mb-2" />
            <p className="text-sm text-dark-500 dark:text-dark-400 font-medium">Fetching platform metrics...</p>
          </div>
        ) : (
          <>
            {/* 1. ORGANIZATIONS TAB */}
            {activeTab === 'organizations' && (
              <div className="card overflow-hidden">
                {/* Search Bar */}
                <div className="p-4 border-b border-dark-200 dark:border-dark-800 bg-dark-50/50 dark:bg-dark-900 flex items-center gap-3">
                  <Search className="w-5 h-5 text-dark-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search organizations by name, admin email, or contact..."
                    className="bg-transparent border-0 ring-0 focus:ring-0 outline-none w-full text-sm dark:text-white placeholder-dark-400"
                  />
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-dark-200 dark:divide-dark-800 text-xs">
                    <thead className="bg-dark-50 dark:bg-dark-800/60 font-bold uppercase text-[10px] tracking-wider text-dark-500 dark:text-dark-400">
                      <tr>
                        <th className="px-5 py-3 text-left">Company Details</th>
                        <th className="px-5 py-3 text-left">Admin Info</th>
                        <th className="px-5 py-3 text-center">Subscription Plan</th>
                        <th className="px-5 py-3 text-center">Telecallers</th>
                        <th className="px-5 py-3 text-center">Leads</th>
                        <th className="px-5 py-3 text-center">Conversations (Monthly)</th>
                        <th className="px-5 py-3 className='text-center'">Created Date</th>
                        <th className="px-5 py-3 text-center">Status</th>
                        <th className="px-5 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-dark-900 divide-y divide-dark-200 dark:divide-dark-800">
                      {filteredOrgs.length === 0 ? (
                        <tr>
                          <td colSpan="9" className="px-5 py-12 text-center text-sm text-dark-500 dark:text-dark-400">
                            No matching organizations found.
                          </td>
                        </tr>
                      ) : (
                        filteredOrgs.map((org) => (
                          <tr key={org._id} className="hover:bg-dark-50/50 dark:hover:bg-dark-800/10">
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-3">
                                {org.logo ? (
                                  <img 
                                    src={org.logo?.startsWith('/uploads') ? (typeof window !== 'undefined' ? `/api${org.logo}` : `${(process.env.NEXT_PUBLIC_API_URL || '/api').replace(/\/api\/?$/, '')}${org.logo}`) : org.logo} 
                                    alt="logo" 
                                    className="w-9 h-9 rounded-xl object-cover border border-dark-200" 
                                  />
                                ) : (
                                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-400 to-indigo-500 flex items-center justify-center text-white text-sm font-bold shadow-sm">
                                    {org.name?.[0]?.toUpperCase() || 'O'}
                                  </div>
                                )}
                                <div>
                                  <p className="text-sm font-bold dark:text-white leading-tight">{org.name}</p>
                                  <p className="text-[10px] text-dark-400 mt-0.5">{org.industry || 'General'} · {org.businessType || 'SaaS'}</p>
                                  {org.website && <span className="text-[10px] text-brand-500 font-semibold truncate hover:underline block">{org.website}</span>}
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-4">
                              <p className="font-semibold dark:text-white leading-tight">{org.adminName}</p>
                              <p className="text-[10px] text-dark-400 mt-0.5">{org.adminEmail}</p>
                              {org.adminPhone && <p className="text-[10px] text-dark-400 font-mono mt-0.5">{org.adminPhone}</p>}
                            </td>
                            <td className="px-5 py-4 text-center">
                              <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border uppercase ${
                                org.plan === 'enterprise' ? 'bg-purple-500/10 text-purple-500 border-purple-500/25' :
                                org.plan === 'pro' ? 'bg-pink-500/10 text-pink-500 border-pink-500/25' :
                                org.plan === 'starter' ? 'bg-indigo-500/10 text-indigo-500 border-indigo-500/25' :
                                'bg-dark-500/10 text-dark-500 dark:text-dark-350 border-dark-500/25'
                              }`}>
                                {org.plan}
                              </span>
                            </td>
                            <td className="px-5 py-4 text-center">
                              <span className="font-bold dark:text-white text-sm">{org.activeTelecallers}</span>
                              <span className="text-dark-400 text-[10px] block">Limit: {org.maxTelecallers}</span>
                            </td>
                            <td className="px-5 py-4 text-center">
                              <span className="font-bold dark:text-white text-sm">{org.totalLeads}</span>
                              <span className="text-dark-400 text-[10px] block">Limit: {org.maxLeads}</span>
                            </td>
                            <td className="px-5 py-4 text-center">
                              <span className="font-bold dark:text-white text-sm">{org.monthlyUsage}</span>
                              <span className="text-dark-400 text-[10px] block">Limit: {org.maxMonthlyConversations}</span>
                            </td>
                            <td className="px-5 py-4 text-center text-dark-400 font-mono">
                              {formatDateOnly(org.createdAt)}
                            </td>
                            <td className="px-5 py-4 text-center">
                              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${
                                org.status === 'active' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                                org.status === 'suspended' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                                'bg-amber-500/10 text-amber-500 border-amber-500/20'
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${org.status === 'active' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                <span>{org.status}</span>
                              </span>
                            </td>
                            <td className="px-5 py-4 text-right">
                              <div className="flex items-center gap-2 justify-end">
                                <button onClick={() => handleEditOrg(org)} className="p-1.5 text-dark-500 hover:text-brand-500 dark:hover:text-white hover:bg-dark-100 dark:hover:bg-dark-800 rounded-lg transition-colors" title="Edit Plan Limits">
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => openResetPasswordModal(org)} className="p-1.5 text-dark-500 hover:text-amber-500 dark:hover:text-white hover:bg-dark-100 dark:hover:bg-dark-800 rounded-lg transition-colors" title="Reset Admin Password">
                                  <Lock className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => handleToggleOrgSuspension(org._id, org.status)} className={`p-1.5 rounded-lg transition-colors ${org.status === 'active' ? 'text-red-500 hover:bg-red-550/10' : 'text-emerald-500 hover:bg-emerald-550/10'}`} title={org.status === 'active' ? 'Suspend Organization' : 'Activate Organization'}>
                                  {org.status === 'active' ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                                </button>
                                <button onClick={() => handleDeleteOrg(org._id)} className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-500/10 rounded-lg transition-colors" title="Delete Organization">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 2. HEALTH TAB */}
            {activeTab === 'health' && healthData && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Services Connection Status */}
                <div className="card p-6 flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-lg dark:text-white flex items-center gap-2 mb-4">
                      <Database className="w-5 h-5 text-brand-500" />
                      <span>Connections</span>
                    </h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between border-b border-dark-100 dark:border-dark-800 pb-2">
                        <span className="text-sm font-semibold dark:text-dark-300">MongoDB Atlas</span>
                        <div className="flex items-center gap-2">
                          <div className={`w-2.5 h-2.5 rounded-full ${healthData.database.status === 'connected' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                          <span className="text-xs font-bold uppercase dark:text-white">{healthData.database.status}</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold dark:text-dark-300">Redis Broker</span>
                        <div className="flex items-center gap-2">
                          <div className={`w-2.5 h-2.5 rounded-full ${healthData.redis.status === 'ready' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                          <span className="text-xs font-bold uppercase dark:text-white">{healthData.redis.status === 'ready' ? 'connected' : 'disconnected'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-6 text-xs text-dark-500 dark:text-dark-400 border-t border-dark-100 dark:border-dark-800 pt-3">
                    Redis Ping: <span className="font-semibold text-brand-500">{healthData.redis.ping || 'N/A'}</span>
                  </div>
                </div>

                {/* System Hardware Stats */}
                <div className="card p-6">
                  <h3 className="font-bold text-lg dark:text-white flex items-center gap-2 mb-4">
                    <Cpu className="w-5 h-5 text-brand-500" />
                    <span>CPU / Processes</span>
                  </h3>
                  <div className="space-y-4">
                    <div className="flex justify-between border-b border-dark-100 dark:border-dark-800 pb-2">
                      <span className="text-sm text-dark-500 dark:text-dark-300">CPU Cores</span>
                      <span className="text-sm font-bold dark:text-white">{healthData.cpu.cores} Core(s)</span>
                    </div>
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-xs text-dark-500 dark:text-dark-400">Load Average (1m / 5m / 15m)</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="px-2 py-0.5 rounded bg-dark-100 dark:bg-dark-800 text-xs font-bold dark:text-white">{healthData.cpu.load1m}</span>
                        <span className="px-2 py-0.5 rounded bg-dark-100 dark:bg-dark-800 text-xs font-bold dark:text-white">{healthData.cpu.load5m}</span>
                        <span className="px-2 py-0.5 rounded bg-dark-100 dark:bg-dark-800 text-xs font-bold dark:text-white">{healthData.cpu.load15m}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Memory Hardware Stats */}
                <div className="card p-6">
                  <h3 className="font-bold text-lg dark:text-white flex items-center gap-2 mb-4">
                    <HardDrive className="w-5 h-5 text-brand-500" />
                    <span>Memory Usage</span>
                  </h3>
                  <div className="space-y-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-dark-500 dark:text-dark-300">Used Memory</span>
                      <span className="font-bold dark:text-white">{formatBytes(healthData.memory.used)}</span>
                    </div>
                    <div className="w-full bg-dark-100 dark:bg-dark-800 rounded-full h-2">
                      <div
                        className="bg-brand-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${healthData.memory.percentage}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-dark-500 dark:text-dark-400">
                      <span>Total: {formatBytes(healthData.memory.total)}</span>
                      <span>{healthData.memory.percentage}% Used</span>
                    </div>
                  </div>
                </div>

                {/* Uptime and Processes */}
                <div className="card p-6 md:col-span-2 lg:col-span-3">
                  <h3 className="font-bold text-lg dark:text-white flex items-center gap-2 mb-4">
                    <Clock className="w-5 h-5 text-brand-500" />
                    <span>Server Uptime</span>
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="flex items-center gap-4 bg-dark-50 dark:bg-dark-800/40 p-4 rounded-xl border border-dark-100 dark:border-dark-800">
                      <div className="p-3 bg-brand-500/10 dark:bg-brand-500/20 text-brand-500 rounded-xl">
                        <Clock className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-xs text-dark-500 dark:text-dark-400 font-semibold uppercase">API Service Uptime</p>
                        <p className="text-lg font-bold dark:text-white mt-0.5">{formatUptime(healthData.uptime.process)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 bg-dark-50 dark:bg-dark-800/40 p-4 rounded-xl border border-dark-100 dark:border-dark-800">
                      <div className="p-3 bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-500 rounded-xl">
                        <Clock className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-xs text-dark-550 dark:text-dark-400 font-semibold uppercase">System OS Uptime</p>
                        <p className="text-lg font-bold dark:text-white mt-0.5">{formatUptime(healthData.uptime.system)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 3. QUEUES TAB */}
            {activeTab === 'queues' && healthData && (
              <div className="space-y-6">
                {/* Campaign Messages Queue */}
                <div className="card p-6">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-dark-200 dark:border-dark-800 pb-4 mb-4">
                    <div>
                      <h3 className="font-bold text-lg dark:text-white flex items-center gap-2">
                        <Layers className="w-5 h-5 text-brand-500" />
                        <span>Campaign Messages Queue (`campaign-messages`)</span>
                      </h3>
                      <p className="text-xs text-dark-500 dark:text-dark-400">Processes bulk campaign dispatches. Rates are capped at 10 msgs/sec.</p>
                    </div>
                    <div className="flex gap-2">
                      {healthData.queues.campaign.paused ? (
                        <button
                          onClick={() => handleQueueControl('campaign-messages', 'resume')}
                          disabled={actionLoading}
                          className="px-3 py-1.5 text-xs font-semibold bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg flex items-center gap-1.5 shadow-sm transition-all"
                        >
                          <Play className="w-3.5 h-3.5" />
                          <span>Resume Queue</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleQueueControl('campaign-messages', 'pause')}
                          disabled={actionLoading}
                          className="px-3 py-1.5 text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white rounded-lg flex items-center gap-1.5 shadow-sm transition-all"
                        >
                          <Pause className="w-3.5 h-3.5" />
                          <span>Pause Queue</span>
                        </button>
                      )}
                      <button
                        onClick={() => handleQueueControl('campaign-messages', 'clean', 'failed')}
                        disabled={actionLoading || healthData.queues.campaign.failed === 0}
                        className="px-3 py-1.5 text-xs font-semibold bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-lg flex items-center gap-1.5 transition-all disabled:opacity-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Clear Failed</span>
                      </button>
                      <button
                        onClick={() => handleQueueControl('campaign-messages', 'clean', 'completed')}
                        disabled={actionLoading || healthData.queues.campaign.completed === 0}
                        className="px-3 py-1.5 text-xs font-semibold bg-dark-500/10 hover:bg-dark-500/20 dark:hover:bg-dark-800 text-dark-600 dark:text-dark-300 border border-dark-500/20 rounded-lg flex items-center gap-1.5 transition-all disabled:opacity-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Clear Completed</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                    <div className="bg-dark-50 dark:bg-dark-800/40 p-4 rounded-xl text-center border border-dark-100 dark:border-dark-800">
                      <span className="text-xs text-dark-500 dark:text-dark-400 font-semibold uppercase">Active</span>
                      <p className="text-2xl font-bold dark:text-white mt-1">{healthData.queues.campaign.active}</p>
                    </div>
                    <div className="bg-dark-50 dark:bg-dark-800/40 p-4 rounded-xl text-center border border-dark-100 dark:border-dark-800">
                      <span className="text-xs text-dark-500 dark:text-dark-400 font-semibold uppercase">Waiting</span>
                      <p className="text-2xl font-bold text-brand-500 mt-1">{healthData.queues.campaign.waiting}</p>
                    </div>
                    <div className="bg-dark-50 dark:bg-dark-800/40 p-4 rounded-xl text-center border border-dark-100 dark:border-dark-800">
                      <span className="text-xs text-dark-500 dark:text-dark-400 font-semibold uppercase">Delayed</span>
                      <p className="text-2xl font-bold dark:text-white mt-1">{healthData.queues.campaign.delayed}</p>
                    </div>
                    <div className="bg-dark-50 dark:bg-dark-800/40 p-4 rounded-xl text-center border border-dark-100 dark:border-dark-800">
                      <span className="text-xs text-dark-500 dark:text-dark-400 font-semibold uppercase">Completed</span>
                      <p className="text-2xl font-bold text-emerald-500 mt-1">{healthData.queues.campaign.completed}</p>
                    </div>
                    <div className="bg-dark-50 dark:bg-dark-800/40 p-4 rounded-xl text-center border border-dark-100 dark:border-dark-800">
                      <span className="text-xs text-dark-500 dark:text-dark-400 font-semibold uppercase">Failed</span>
                      <p className="text-2xl font-bold text-red-500 mt-1">{healthData.queues.campaign.failed}</p>
                    </div>
                  </div>
                </div>

                {/* Scheduled Campaigns Queue */}
                <div className="card p-6">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-dark-200 dark:border-dark-800 pb-4 mb-4">
                    <div>
                      <h3 className="font-bold text-lg dark:text-white flex items-center gap-2">
                        <Layers className="w-5 h-5 text-brand-500" />
                        <span>Scheduled Campaigns Clock Queue (`scheduled-campaigns`)</span>
                      </h3>
                      <p className="text-xs text-dark-500 dark:text-dark-400">Triggers pending scheduled blasts. Evaluates database schedules once per minute.</p>
                    </div>
                    <div className="flex gap-2">
                      {healthData.queues.schedule.paused ? (
                        <button
                          onClick={() => handleQueueControl('scheduled-campaigns', 'resume')}
                          disabled={actionLoading}
                          className="px-3 py-1.5 text-xs font-semibold bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg flex items-center gap-1.5 shadow-sm transition-all"
                        >
                          <Play className="w-3.5 h-3.5" />
                          <span>Resume Queue</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleQueueControl('scheduled-campaigns', 'pause')}
                          disabled={actionLoading}
                          className="px-3 py-1.5 text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white rounded-lg flex items-center gap-1.5 shadow-sm transition-all"
                        >
                          <Pause className="w-3.5 h-3.5" />
                          <span>Pause Queue</span>
                        </button>
                      )}
                      <button
                        onClick={() => handleQueueControl('scheduled-campaigns', 'clean', 'failed')}
                        disabled={actionLoading || healthData.queues.schedule.failed === 0}
                        className="px-3 py-1.5 text-xs font-semibold bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-lg flex items-center gap-1.5 transition-all disabled:opacity-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Clear Failed</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                    <div className="bg-dark-50 dark:bg-dark-800/40 p-4 rounded-xl text-center border border-dark-100 dark:border-dark-800">
                      <span className="text-xs text-dark-500 dark:text-dark-400 font-semibold uppercase">Active</span>
                      <p className="text-2xl font-bold dark:text-white mt-1">{healthData.queues.schedule.active}</p>
                    </div>
                    <div className="bg-dark-50 dark:bg-dark-800/40 p-4 rounded-xl text-center border border-dark-100 dark:border-dark-800">
                      <span className="text-xs text-dark-500 dark:text-dark-400 font-semibold uppercase">Waiting</span>
                      <p className="text-2xl font-bold text-brand-500 mt-1">{healthData.queues.schedule.waiting}</p>
                    </div>
                    <div className="bg-dark-50 dark:bg-dark-800/40 p-4 rounded-xl text-center border border-dark-100 dark:border-dark-800">
                      <span className="text-xs text-dark-500 dark:text-dark-400 font-semibold uppercase">Delayed</span>
                      <p className="text-2xl font-bold dark:text-white mt-1">{healthData.queues.schedule.delayed}</p>
                    </div>
                    <div className="bg-dark-50 dark:bg-dark-800/40 p-4 rounded-xl text-center border border-dark-100 dark:border-dark-800">
                      <span className="text-xs text-dark-500 dark:text-dark-400 font-semibold uppercase">Completed</span>
                      <p className="text-2xl font-bold text-emerald-500 mt-1">{healthData.queues.schedule.completed}</p>
                    </div>
                    <div className="bg-dark-50 dark:bg-dark-800/40 p-4 rounded-xl text-center border border-dark-100 dark:border-dark-800">
                      <span className="text-xs text-dark-500 dark:text-dark-400 font-semibold uppercase">Failed</span>
                      <p className="text-2xl font-bold text-red-500 mt-1">{healthData.queues.schedule.failed}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 4. SUBSCRIPTIONS TAB */}
            {activeTab === 'subscriptions' && (
              <div className="space-y-6">
                {/* Sub-navigation */}
                <div className="flex gap-2 flex-wrap">
                  {[{ id: 'dashboard', label: 'Dashboard' }, { id: 'history', label: 'Payment History' }, { id: 'orgs', label: 'Organizations' }, { id: 'config', label: 'Plan Config' }, { id: 'payments', label: `Pending (${pendingPayments.length})` }].map(v => (
                    <button key={v.id} onClick={() => setSubView(v.id)}
                      className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${subView === v.id ? 'bg-wa-green text-white' : 'bg-wa-search dark:bg-wa-dark-search text-wa-text-secondary hover:text-wa-text-primary'}`}
                    >{v.label}</button>
                  ))}
                </div>

                {/* Dashboard Stats & Analytics */}
                {subView === 'dashboard' && (() => {
                  const paidPayments = allPayments.filter(p => p.status === 'paid');
                  const totalPaidRevenue = paidPayments.reduce((acc, p) => acc + (p.totalAmount || 0), 0);
                  const totalTaxAmount = paidPayments.reduce((acc, p) => acc + (p.taxAmount || 0), 0);
                  const taxableBase = totalPaidRevenue - totalTaxAmount;
                  const cgst = Math.round(totalTaxAmount / 2);
                  const sgst = totalTaxAmount - cgst;

                  const dailyRevenueData = subDashboard?.dailyRevenue || [];
                  const maxDayRevenue = Math.max(...dailyRevenueData.map(d => d.total || 0), 1);

                  return (
                    <div className="space-y-6">
                      {/* 8 Stats Metrics Grid */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                          { label: 'Total Orgs', value: subDashboard?.totalOrgs ?? 0, color: 'text-blue-600' },
                          { label: 'Active Plans', value: subDashboard?.activePlans ?? 0, color: 'text-emerald-600' },
                          { label: 'Expired', value: subDashboard?.expiredPlans ?? 0, color: 'text-red-600' },
                          { label: 'Pending Payments', value: subDashboard?.pendingPayments ?? 0, color: 'text-amber-600' },
                          { label: 'Total Collections (All-time)', value: `₹${(subDashboard?.totalRevenue || subDashboard?.yearlyRevenue || 0).toLocaleString('en-IN')}`, color: 'text-emerald-600' },
                          { label: 'Monthly Revenue', value: `₹${(subDashboard?.monthlyRevenue || 0).toLocaleString('en-IN')}`, color: 'text-teal-600' },
                          { label: 'Yearly Revenue', value: `₹${(subDashboard?.yearlyRevenue || 0).toLocaleString('en-IN')}`, color: 'text-blue-600' },
                          { label: 'Expiring Soon', value: subDashboard?.expiringPlans ?? 0, color: 'text-amber-600' },
                        ].map((stat, i) => (
                          <div key={i} className="bg-white dark:bg-wa-dark-panel rounded-xl border border-wa-border dark:border-wa-dark-border p-4">
                            <p className="text-xs text-wa-text-secondary font-medium mb-1">{stat.label}</p>
                            <p className={`text-xl font-extrabold ${stat.color}`}>{stat.value}</p>
                          </div>
                        ))}
                      </div>

                      {/* Revenue & Growth Trend Chart (Last 30 Days) */}
                      <div className="bg-white dark:bg-wa-dark-panel rounded-2xl border border-wa-border dark:border-wa-dark-border p-5 sm:p-6 shadow-sm">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center shrink-0">
                              <TrendingUp className="w-5 h-5" />
                            </div>
                            <div>
                              <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                                <span>Collections & Revenue Growth</span>
                                <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 px-2 py-0.5 rounded-full">
                                  Last 30 Days
                                </span>
                              </h3>
                              <p className="text-xs text-slate-500 mt-0.5">Daily subscription payments received from client organizations</p>
                            </div>
                          </div>

                          <div className="text-left sm:text-right">
                            <span className="text-[10px] uppercase font-bold text-slate-400">30-Day Inflow</span>
                            <p className="text-lg font-black font-mono text-emerald-600 dark:text-emerald-400">
                              ₹{dailyRevenueData.reduce((acc, d) => acc + (d.total || 0), 0).toLocaleString('en-IN')}
                            </p>
                          </div>
                        </div>

                        {dailyRevenueData.length === 0 ? (
                          <div className="text-center py-10 text-slate-400">
                            <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-40" />
                            <p className="text-xs">No payment collections recorded in the last 30 days.</p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <div className="h-44 flex items-end gap-2 sm:gap-4 pt-6 pb-2 border-b border-slate-100 dark:border-slate-800">
                              {dailyRevenueData.map((d, idx) => {
                                const heightPercent = Math.max(15, Math.round((d.total / maxDayRevenue) * 100));
                                return (
                                  <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group relative min-w-[32px]">
                                    {/* Tooltip */}
                                    <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none bg-slate-900 text-white text-[10px] font-bold py-1 px-2 rounded shadow-lg whitespace-nowrap z-10">
                                      ₹{d.total.toLocaleString('en-IN')} ({d.count} payment{d.count > 1 ? 's' : ''})
                                    </div>
                                    {/* Bar */}
                                    <div
                                      style={{ height: `${heightPercent}%` }}
                                      className="w-full max-w-[42px] bg-gradient-to-t from-emerald-600 to-teal-400 rounded-t-lg group-hover:from-emerald-500 group-hover:to-teal-300 transition-all shadow-sm"
                                    />
                                    <span className="text-[10px] font-mono text-slate-400 mt-2 truncate w-full text-center">
                                      {d._id.slice(5)}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* GST & Tax Compliance Breakdown Card */}
                      <div className="bg-white dark:bg-wa-dark-panel rounded-2xl border border-wa-border dark:border-wa-dark-border p-5 sm:p-6 shadow-sm">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5 border-b border-slate-100 dark:border-slate-800 pb-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs uppercase font-extrabold tracking-wider bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 px-2.5 py-0.5 rounded-full">
                                GST Tax Compliance (SAC 997331)
                              </span>
                              <span className="text-xs text-slate-400 font-semibold">• GSTIN: 24AAOFH1234A1Z5</span>
                            </div>
                            <h3 className="text-base font-extrabold text-slate-900 dark:text-white mt-1.5">
                              Platform Tax Audit & Filing Breakdown
                            </h3>
                            <p className="text-xs text-slate-500 mt-0.5">
                              18% GST (CGST 9% + SGST 9%) collected on enterprise software subscriptions. Ready for GSTR-1 & GSTR-3B filing.
                            </p>
                          </div>

                          <div className="text-left sm:text-right">
                            <span className="text-[10px] uppercase font-bold text-slate-400">Total Tax Collected</span>
                            <p className="text-2xl font-black font-mono text-blue-600 dark:text-blue-400">
                              ₹{totalTaxAmount.toLocaleString('en-IN')}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800">
                            <span className="text-[11px] font-bold text-slate-500 uppercase">Total Settled (Gross)</span>
                            <p className="text-lg font-black font-mono text-slate-900 dark:text-white mt-1">₹{totalPaidRevenue.toLocaleString('en-IN')}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">{paidPayments.length} Paid Invoices</p>
                          </div>
                          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800">
                            <span className="text-[11px] font-bold text-slate-500 uppercase">Taxable Value (Base)</span>
                            <p className="text-lg font-black font-mono text-emerald-600 dark:text-emerald-400 mt-1">₹{taxableBase.toLocaleString('en-IN')}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">Net Software License</p>
                          </div>
                          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800">
                            <span className="text-[11px] font-bold text-slate-500 uppercase">CGST @ 9%</span>
                            <p className="text-lg font-black font-mono text-blue-600 dark:text-blue-400 mt-1">₹{cgst.toLocaleString('en-IN')}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">Central Goods & Service Tax</p>
                          </div>
                          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800">
                            <span className="text-[11px] font-bold text-slate-500 uppercase">SGST @ 9%</span>
                            <p className="text-lg font-black font-mono text-indigo-600 dark:text-indigo-400 mt-1">₹{sgst.toLocaleString('en-IN')}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">State Goods & Service Tax</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* GPay Style Payment History & Invoices Feed */}
                {subView === 'history' && (() => {
                  // 1. Filter payments according to status, date range, and search
                  const filteredPayments = allPayments
                    .filter((p) => {
                      if (paymentFilter === 'paid') return p.status === 'paid';
                      if (paymentFilter === 'pending') return p.status === 'pending';
                      if (paymentFilter === 'razorpay') return p.paymentMethod === 'razorpay';
                      if (paymentFilter === 'bank_transfer') return p.paymentMethod === 'bank_transfer' || p.paymentMethod === 'cash';
                      return true;
                    })
                    .filter((p) => {
                      if (dateFilter === 'all') return true;
                      const pDate = new Date(p.createdAt);
                      const now = new Date();
                      if (dateFilter === 'this_month') {
                        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                        return pDate >= startOfMonth;
                      }
                      if (dateFilter === 'last_month') {
                        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
                        return pDate >= startOfLastMonth && pDate <= endOfLastMonth;
                      }
                      if (dateFilter === 'custom') {
                        if (customStartDate && pDate < new Date(customStartDate)) return false;
                        if (customEndDate) {
                          const endD = new Date(customEndDate);
                          endD.setHours(23, 59, 59, 999);
                          if (pDate > endD) return false;
                        }
                        return true;
                      }
                      return true;
                    })
                    .filter((p) => {
                      if (!paymentSearch) return true;
                      const q = paymentSearch.toLowerCase();
                      const orgName = (p.organizationId?.name || '').toLowerCase();
                      const ownerName = (p.owner?.name || p.organizationId?.owner?.name || '').toLowerCase();
                      const email = (p.owner?.email || p.organizationId?.contactEmail || '').toLowerCase();
                      const inv = (p.invoiceNumber || '').toLowerCase();
                      const ref = (p.transactionId || p.razorpayPaymentId || '').toLowerCase();
                      return orgName.includes(q) || ownerName.includes(q) || email.includes(q) || inv.includes(q) || ref.includes(q);
                    });

                  // 2. Group payments client-wise (hierarchy)
                  const clientGroups = [];
                  const groupMap = new Map();

                  filteredPayments.forEach((p) => {
                    const orgId = p.organizationId?._id?.toString() || (typeof p.organizationId === 'string' ? p.organizationId : 'unassigned');
                    if (!groupMap.has(orgId)) {
                      const orgName = p.organizationId?.name || (typeof p.organizationId === 'string' ? p.organizationId : 'Direct Client');
                      const clientName = p.owner?.name || p.organizationId?.owner?.name || p.organizationId?.contactEmail?.split('@')[0] || 'Client Admin';
                      const clientEmail = p.owner?.email || p.organizationId?.contactEmail || '';
                      const clientPhone = p.owner?.phone || p.organizationId?.contactNumber || '';
                      const entry = {
                        orgId,
                        orgName,
                        clientName,
                        clientEmail,
                        clientPhone,
                        payments: [],
                        totalPaid: 0,
                        paidCount: 0,
                        pendingCount: 0,
                        rejectedCount: 0
                      };
                      groupMap.set(orgId, entry);
                      clientGroups.push(entry);
                    }
                    const group = groupMap.get(orgId);
                    group.payments.push(p);
                    if (p.status === 'paid') {
                      group.totalPaid += (p.totalAmount || 0);
                      group.paidCount++;
                    } else if (p.status === 'pending') {
                      group.pendingCount++;
                    } else if (p.status === 'rejected') {
                      group.rejectedCount++;
                    }
                  });

                  // Sort client groups: pending first, then highest total paid
                  clientGroups.sort((a, b) => {
                    if (b.pendingCount !== a.pendingCount) return b.pendingCount - a.pendingCount;
                    return b.totalPaid - a.totalPaid;
                  });

                  return (
                    <div className="space-y-5">
                      {/* Top Summary Banner */}
                      <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white shadow-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs uppercase font-extrabold tracking-wider bg-white/20 px-2.5 py-0.5 rounded-full">
                              Platform Collections
                            </span>
                            <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse"></span>
                          </div>
                          <p className="text-3xl font-black mt-2 font-mono">
                            ₹{(subDashboard?.totalRevenue || subDashboard?.yearlyRevenue || 0).toLocaleString('en-IN')}
                          </p>
                          <p className="text-xs text-white/80 mt-0.5 font-medium">
                            Total Subscription Revenue Collected Across All Client Organizations
                          </p>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/20 text-center min-w-[100px]">
                            <p className="text-[10px] uppercase font-bold text-white/80">Total Payments</p>
                            <p className="text-xl font-extrabold mt-0.5">{allPayments.length}</p>
                          </div>
                          <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/20 text-center min-w-[100px]">
                            <p className="text-[10px] uppercase font-bold text-white/80">Pending Verify</p>
                            <p className="text-xl font-extrabold text-amber-200 mt-0.5">{pendingPayments.length}</p>
                          </div>
                        </div>
                      </div>

                      {/* Filter & Search Toolbar */}
                      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
                        {/* Search Input */}
                        <div className="relative flex-1 max-w-md">
                          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            type="text"
                            value={paymentSearch}
                            onChange={(e) => setPaymentSearch(e.target.value)}
                            placeholder="Search client, org name, email, invoice #, ref..."
                            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                          />
                        </div>

                        {/* Status Filter Chips */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {[
                            { id: 'all', label: `All (${allPayments.length})` },
                            { id: 'paid', label: `Paid (${allPayments.filter(p => p.status === 'paid').length})` },
                            { id: 'pending', label: `Pending (${allPayments.filter(p => p.status === 'pending').length})` },
                            { id: 'razorpay', label: `Online (${allPayments.filter(p => p.paymentMethod === 'razorpay').length})` },
                            { id: 'bank_transfer', label: `Bank Transfer (${allPayments.filter(p => p.paymentMethod === 'bank_transfer' || p.paymentMethod === 'cash').length})` },
                          ].map((chip) => (
                            <button
                              key={chip.id}
                              type="button"
                              onClick={() => setPaymentFilter(chip.id)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                                paymentFilter === chip.id
                                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                                  : 'bg-white dark:bg-wa-dark-panel border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                              }`}
                            >
                              {chip.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Date Range Presets & Custom Date Picker */}
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white dark:bg-wa-dark-panel p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1 mr-1">
                            <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Date Period:</span>
                          </span>
                          {[
                            { id: 'all', label: 'All Time' },
                            { id: 'this_month', label: 'This Month' },
                            { id: 'last_month', label: 'Last Month' },
                            { id: 'custom', label: 'Custom Dates' },
                          ].map((chip) => (
                            <button
                              key={chip.id}
                              type="button"
                              onClick={() => setDateFilter(chip.id)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                                dateFilter === chip.id
                                  ? 'bg-emerald-600 text-white shadow-sm'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                              }`}
                            >
                              {chip.label}
                            </button>
                          ))}
                        </div>

                        {/* Custom Date Inputs if Custom selected */}
                        {dateFilter === 'custom' && (
                          <div className="flex items-center gap-2 text-xs">
                            <span className="font-semibold text-slate-500">From:</span>
                            <input
                              type="date"
                              value={customStartDate}
                              onChange={(e) => setCustomStartDate(e.target.value)}
                              className="px-2.5 py-1 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none"
                            />
                            <span className="font-semibold text-slate-500">To:</span>
                            <input
                              type="date"
                              value={customEndDate}
                              onChange={(e) => setCustomEndDate(e.target.value)}
                              className="px-2.5 py-1 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none"
                            />
                          </div>
                        )}
                      </div>

                      {/* Hierarchy Controls & View Mode Toggle Bar */}
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-1 py-1">
                        {/* Left: View Mode Toggle */}
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-500 dark:text-slate-400">View Mode:</span>
                          <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80">
                            <button
                              type="button"
                              onClick={() => setHistoryLayout('hierarchy')}
                              className={`px-3 py-1 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                                historyLayout === 'hierarchy'
                                  ? 'bg-emerald-600 text-white shadow-sm'
                                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                              }`}
                            >
                              <Building2 className="w-3.5 h-3.5" />
                              <span>Client Hierarchy</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setHistoryLayout('feed')}
                              className={`px-3 py-1 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer ${
                                historyLayout === 'feed'
                                  ? 'bg-emerald-600 text-white shadow-sm'
                                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                              }`}
                            >
                              <Layers className="w-3.5 h-3.5" />
                              <span>Flat Feed</span>
                            </button>
                          </div>
                          <span className="text-xs text-slate-400 font-medium hidden md:inline">
                            Showing {clientGroups.length} Client{clientGroups.length > 1 ? 's' : ''} ({filteredPayments.length} Invoices)
                          </span>
                        </div>

                        {/* Right: Action Buttons (CSV Export + Expand/Collapse) */}
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Export CSV Report Button */}
                          <button
                            type="button"
                            onClick={() => handleExportCSV(filteredPayments)}
                            className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                            title="Download Excel / CSV Collections Report for Accounting"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Export CSV Report</span>
                          </button>

                          {/* Expand / Collapse All (When in hierarchy mode) */}
                          {historyLayout === 'hierarchy' && clientGroups.length > 0 && (
                            <div className="flex items-center gap-1.5 border-l border-slate-200 dark:border-slate-800 pl-2">
                              <button
                                type="button"
                                onClick={() => handleExpandAllClients(clientGroups)}
                                className="px-2 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg transition-colors cursor-pointer"
                              >
                                Expand All
                              </button>
                              <span className="text-slate-300 dark:text-slate-700">|</span>
                              <button
                                type="button"
                                onClick={() => handleCollapseAllClients(clientGroups)}
                                className="px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                              >
                                Collapse All
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Main List Rendering */}
                      {filteredPayments.length === 0 ? (
                        <div className="text-center py-16 bg-white dark:bg-wa-dark-panel rounded-2xl border border-wa-border dark:border-wa-dark-border">
                          <CreditCard className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                          <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">No payment records found</h4>
                          <p className="text-xs text-slate-400 mt-1">
                            {allPayments.length === 0
                              ? 'Tenant subscription payments will appear here in Google Pay feed format.'
                              : 'No payments matched your search query or filter chip.'}
                          </p>
                        </div>
                      ) : historyLayout === 'hierarchy' ? (
                        /* ================= HIERARCHICAL CLIENT-WISE COLLAPSIBLE VIEW ================= */
                        <div className="space-y-4">
                          {clientGroups.map((client) => {
                            const isExpanded = expandedClients[client.orgId] ?? true;
                            const initials = (client.orgName.slice(0, 2) || 'CL').toUpperCase();

                            return (
                              <div
                                key={client.orgId}
                                className="bg-white dark:bg-wa-dark-panel rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm overflow-hidden transition-all duration-200 hover:border-emerald-500/40"
                              >
                                {/* Client Header (Clickable Dropdown Toggle) */}
                                <div
                                  onClick={() => toggleClientExpand(client.orgId)}
                                  className={`p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 cursor-pointer select-none transition-colors ${
                                    isExpanded
                                      ? 'bg-gradient-to-r from-emerald-50/60 via-teal-50/30 to-transparent dark:from-emerald-950/20 dark:via-teal-950/10 dark:to-transparent border-b border-slate-200/80 dark:border-slate-800'
                                      : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                                  }`}
                                >
                                  {/* Left Side: Avatar + Client Identity */}
                                  <div className="flex items-center gap-3.5 min-w-0">
                                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-sm shadow-emerald-600/20">
                                      {initials}
                                    </div>
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <h3 className="text-base font-extrabold text-slate-900 dark:text-white truncate">
                                          {client.orgName}
                                        </h3>
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                          {client.payments.length} {client.payments.length === 1 ? 'Record' : 'Records'}
                                        </span>
                                        {client.pendingCount > 0 && (
                                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 animate-pulse">
                                            ⏳ {client.pendingCount} Pending Verify
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2 flex-wrap text-xs text-slate-500 dark:text-slate-400 mt-1">
                                        <span className="font-semibold text-slate-700 dark:text-slate-200">
                                          👤 {client.clientName}
                                        </span>
                                        {client.clientEmail && (
                                          <>
                                            <span>&bull;</span>
                                            <span className="text-slate-500 truncate">{client.clientEmail}</span>
                                          </>
                                        )}
                                        {client.clientPhone && (
                                          <>
                                            <span>&bull;</span>
                                            <span className="font-mono text-slate-500">{client.clientPhone}</span>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Right Side: Total Revenue for Client + Dropdown Chevron */}
                                  <div className="flex items-center justify-between sm:justify-end gap-5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
                                    <div className="text-left sm:text-right">
                                      <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500">
                                        Client Total Revenue
                                      </p>
                                      <p className="text-xl font-black font-mono text-emerald-600 dark:text-emerald-400 leading-tight mt-0.5">
                                        ₹{client.totalPaid.toLocaleString('en-IN')}
                                      </p>
                                      <p className="text-[10px] text-slate-400 mt-0.5">
                                        {client.paidCount} Paid {client.pendingCount > 0 ? `• ${client.pendingCount} Pending` : ''}
                                      </p>
                                    </div>

                                    <div className="flex items-center gap-2">
                                      <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 transition-colors">
                                        <ChevronDown
                                          className={`w-4 h-4 transition-transform duration-200 ${
                                            isExpanded ? 'rotate-180 text-emerald-600 dark:text-emerald-400' : ''
                                          }`}
                                        />
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Collapsible Body: That specific client's payments list */}
                                {isExpanded && (
                                  <div className="p-4 sm:p-5 bg-slate-50/70 dark:bg-slate-900/40 border-t border-slate-100 dark:border-slate-800/80 space-y-3">
                                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">
                                      Payment History for {client.orgName}
                                    </div>

                                    {client.payments.map((p) => {
                                      const isPaid = p.status === 'paid';
                                      const isPending = p.status === 'pending';
                                      const isRejected = p.status === 'rejected';

                                      return (
                                        <div
                                          key={p._id}
                                          onClick={() => setViewInvoiceModal({ open: true, payment: p })}
                                          className="group bg-white dark:bg-wa-dark-panel rounded-xl border border-slate-200/80 dark:border-slate-800 p-4 hover:border-emerald-500/50 hover:shadow-sm transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3.5"
                                        >
                                          {/* Left Side: Invoice #, Date, Method, Txn Ref */}
                                          <div className="flex items-start gap-3">
                                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                                              isPaid ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300' :
                                              isPending ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300' :
                                              'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                                            }`}>
                                              {isPaid ? <CheckCircle className="w-4 h-4" /> : isPending ? <Clock className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                                            </div>

                                            <div>
                                              <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-mono text-xs font-black text-slate-800 dark:text-slate-100">
                                                  {p.invoiceNumber || 'INV-PENDING'}
                                                </span>
                                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                                  {p.planMonths} Month{p.planMonths > 1 ? 's' : ''} Plan
                                                </span>
                                                <span className="text-[10px] font-semibold text-slate-500">
                                                  {p.paymentMethod === 'razorpay' ? '⚡ UPI / Razorpay' : '🏦 Bank Transfer'}
                                                </span>
                                              </div>

                                              <div className="flex items-center gap-2 flex-wrap text-[11px] text-slate-500 mt-1">
                                                <span>{formatDateOnly(p.createdAt)}</span>
                                                {p.transactionId && (
                                                  <>
                                                    <span>&bull;</span>
                                                    <span className="font-mono text-[10px] text-slate-600 dark:text-slate-400">
                                                      Ref: {p.transactionId}
                                                    </span>
                                                  </>
                                                )}
                                                {p.notes && (
                                                  <>
                                                    <span>&bull;</span>
                                                    <span className="italic text-slate-400 max-w-xs truncate">{p.notes}</span>
                                                  </>
                                                )}
                                              </div>
                                            </div>
                                          </div>

                                          {/* Right Side: Amount & Tax Invoice Button */}
                                          <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
                                            <div className="text-left sm:text-right">
                                              <p className={`text-base sm:text-lg font-black font-mono leading-none ${
                                                isPaid ? 'text-emerald-600 dark:text-emerald-400' : isPending ? 'text-amber-600' : 'text-slate-400'
                                              }`}>
                                                + ₹{p.totalAmount?.toLocaleString('en-IN')}
                                              </p>
                                              <div className="flex items-center sm:justify-end gap-1.5 mt-1">
                                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider ${
                                                  isPaid
                                                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                                                    : isPending
                                                    ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                                                    : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                                                }`}>
                                                  {isPaid ? '✓ Paid' : isPending ? '⏳ Pending' : '✕ Rejected'}
                                                </span>
                                              </div>
                                            </div>

                                            <div className="flex items-center gap-2">
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setViewInvoiceModal({ open: true, payment: p });
                                                }}
                                                className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                                                title="View Official Tax Invoice"
                                              >
                                                <FileText className="w-3.5 h-3.5" />
                                                <span>Invoice</span>
                                              </button>

                                              {isPending && (
                                                <>
                                                  <button
                                                    type="button"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      handleVerifyPayment(p._id, 'approve');
                                                    }}
                                                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-sm"
                                                  >
                                                    Approve
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      setRejectModal({
                                                        open: true,
                                                        paymentId: p._id,
                                                        clientName: client.orgName,
                                                        amount: p.totalAmount || 0,
                                                        reason: ''
                                                      });
                                                    }}
                                                    className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-950/40 dark:hover:bg-red-900/60 rounded-xl text-xs font-bold transition-colors cursor-pointer border border-red-200 dark:border-red-800/60"
                                                  >
                                                    Reject
                                                  </button>
                                                </>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        /* ================= FLAT CHRONOLOGICAL FEED VIEW ================= */
                        <div className="space-y-3">
                          {filteredPayments.map((p) => {
                            const orgName = p.organizationId?.name || 'Organization';
                            const clientName = p.owner?.name || p.organizationId?.owner?.name || p.organizationId?.contactEmail?.split('@')[0] || 'Client Admin';
                            const isPaid = p.status === 'paid';
                            const isPending = p.status === 'pending';
                            const initials = (orgName.slice(0, 2) || 'HK').toUpperCase();

                            return (
                              <div
                                key={p._id}
                                onClick={() => setViewInvoiceModal({ open: true, payment: p })}
                                className="group bg-white dark:bg-wa-dark-panel rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 sm:p-5 hover:border-emerald-500/50 hover:shadow-md transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                              >
                                <div className="flex items-start sm:items-center gap-3.5">
                                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-sm shadow-emerald-500/20 group-hover:scale-105 transition-transform">
                                    {initials}
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <h4 className="text-sm font-extrabold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                                        {orgName}
                                      </h4>
                                      <span className="text-[10px] font-semibold text-slate-400">
                                        ({clientName})
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2 flex-wrap text-[11px] text-slate-500 mt-1">
                                      <span className="font-mono text-slate-600 dark:text-slate-400 font-bold">
                                        {p.invoiceNumber || 'INV-PENDING'}
                                      </span>
                                      <span>&bull;</span>
                                      <span>{formatDateOnly(p.createdAt)}</span>
                                      <span>&bull;</span>
                                      <span className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-mono text-slate-600 dark:text-slate-300 font-semibold">
                                        {p.paymentMethod === 'razorpay' ? '⚡ UPI / Razorpay' : '🏦 Bank Transfer'}
                                      </span>
                                      {p.transactionId && (
                                        <span className="text-slate-400 font-mono text-[10px]">
                                          Ref: {p.transactionId}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
                                  <div className="text-left sm:text-right">
                                    <p className={`text-lg sm:text-xl font-black font-mono leading-none ${
                                      isPaid ? 'text-emerald-600 dark:text-emerald-400' : isPending ? 'text-amber-600' : 'text-slate-400'
                                    }`}>
                                      + ₹{p.totalAmount?.toLocaleString('en-IN')}
                                    </p>
                                    <div className="flex items-center sm:justify-end gap-1.5 mt-1">
                                      <span className="text-[10px] font-bold text-slate-500">
                                        {p.planMonths} Month{p.planMonths > 1 ? 's' : ''} Plan
                                      </span>
                                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider ${
                                        isPaid
                                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                                          : isPending
                                          ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                                          : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                                      }`}>
                                        {isPaid ? '✓ Paid' : isPending ? '⏳ Pending' : '✕ Rejected'}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setViewInvoiceModal({ open: true, payment: p });
                                      }}
                                      className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                                      title="View Official Tax Invoice"
                                    >
                                      <FileText className="w-3.5 h-3.5" />
                                      <span className="hidden sm:inline">Tax Invoice</span>
                                    </button>

                                    {isPending && (
                                      <>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleVerifyPayment(p._id, 'approve');
                                          }}
                                          className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-sm"
                                        >
                                          Approve
                                        </button>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setRejectModal({
                                              open: true,
                                              paymentId: p._id,
                                              clientName: orgName,
                                              amount: p.totalAmount || 0,
                                              reason: ''
                                            });
                                          }}
                                          className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-950/40 dark:hover:bg-red-900/60 rounded-xl text-xs font-bold transition-colors cursor-pointer border border-red-200 dark:border-red-800/60"
                                        >
                                          Reject
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}

{/* Organizations with subscription details */}
                {subView === 'orgs' && (
                  <div className="bg-white dark:bg-wa-dark-panel rounded-xl border border-wa-border dark:border-wa-dark-border overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-wa-search dark:bg-wa-dark-search text-left text-xs font-semibold text-wa-text-secondary uppercase">
                            <th className="px-4 py-3">Organization</th>
                            <th className="px-4 py-3">Owner</th>
                            <th className="px-4 py-3">Plan</th>
                            <th className="px-4 py-3">Expiry</th>
                            <th className="px-4 py-3">Remaining</th>
                            <th className="px-4 py-3">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {subOrgs.map((org) => {
                            const statusMap = {
                              active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
                              expiring_soon: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
                              expired: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
                              pending: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
                              trial: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
                            };
                            return (
                              <tr key={org._id} className="border-b border-wa-border dark:border-wa-dark-border hover:bg-wa-hover/50 dark:hover:bg-wa-dark-hover/50">
                                <td className="px-4 py-3 font-semibold text-wa-text-primary dark:text-white">{org.name}</td>
                                <td className="px-4 py-3">
                                  <p className="text-wa-text-primary dark:text-white text-xs">{org.ownerName}</p>
                                  <p className="text-wa-text-secondary text-xs">{org.ownerEmail}</p>
                                </td>
                                <td className="px-4 py-3 text-xs">{org.currentPlan}</td>
                                <td className="px-4 py-3 text-xs text-wa-text-secondary">{org.subscriptionExpiryDate ? formatDateOnly(org.subscriptionExpiryDate) : '-'}</td>
                                <td className="px-4 py-3">
                                  <span className={`text-xs font-bold ${org.remainingDays > 7 ? 'text-emerald-600' : org.remainingDays > 0 ? 'text-amber-600' : 'text-red-600'}`}>
                                    {org.remainingDays} days
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${statusMap[org.subscriptionStatus] || statusMap.trial}`}>
                                    {(org.subscriptionStatus || 'trial').replace('_', ' ')}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Plan Configuration */}
                {subView === 'config' && (
                  <div className="bg-white dark:bg-wa-dark-panel rounded-xl border border-wa-border dark:border-wa-dark-border p-6 max-w-lg">
                    <h3 className="text-base font-bold text-wa-text-primary dark:text-white mb-4">Plan Pricing Configuration</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-wa-text-secondary mb-1">Monthly Price (₹)</label>
                        <input type="number" value={planForm.monthlyPrice} onChange={e => setPlanForm(f => ({ ...f, monthlyPrice: parseInt(e.target.value) || 0 }))} className="w-full px-4 py-2.5 rounded-xl bg-wa-search dark:bg-wa-dark-search border border-wa-border dark:border-wa-dark-border text-sm text-wa-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-wa-green/30" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-wa-text-secondary mb-1">Tax Percentage (%)</label>
                        <input type="number" value={planForm.taxPercentage} onChange={e => setPlanForm(f => ({ ...f, taxPercentage: parseFloat(e.target.value) || 0 }))} className="w-full px-4 py-2.5 rounded-xl bg-wa-search dark:bg-wa-dark-search border border-wa-border dark:border-wa-dark-border text-sm text-wa-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-wa-green/30" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-wa-text-secondary mb-1">Grace Period (Days after expiry)</label>
                        <input type="number" value={planForm.gracePeriodDays} onChange={e => setPlanForm(f => ({ ...f, gracePeriodDays: parseInt(e.target.value) || 0 }))} className="w-full px-4 py-2.5 rounded-xl bg-wa-search dark:bg-wa-dark-search border border-wa-border dark:border-wa-dark-border text-sm text-wa-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-wa-green/30" />
                      </div>

                      {/* Preview */}
                      <div className="mt-4 p-4 bg-wa-search dark:bg-wa-dark-search rounded-xl">
                        <p className="text-xs font-semibold text-wa-text-secondary mb-2">Auto-calculated Prices:</p>
                        <div className="grid grid-cols-2 gap-2">
                          {[1, 3, 6, 12].map(m => {
                            const base = planForm.monthlyPrice * m;
                            const tax = Math.round((base * planForm.taxPercentage) / 100);
                            return (
                              <div key={m} className="flex justify-between text-xs">
                                <span className="text-wa-text-secondary">{m} Month{m > 1 ? 's' : ''}</span>
                                <span className="font-bold text-wa-text-primary dark:text-white">₹{(base + tax).toLocaleString('en-IN')}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <button onClick={handleUpdatePlanConfig} className="w-full py-2.5 bg-wa-green hover:bg-wa-green-hover text-white font-semibold rounded-xl transition-colors text-sm">
                        Save Configuration
                      </button>
                    </div>
                  </div>
                )}

                {/* Pending Payments */}
                {subView === 'payments' && (
                  <div className="space-y-4">
                    {pendingPayments.length === 0 ? (
                      <div className="text-center py-12 text-wa-text-secondary">
                        <CheckCircle className="w-10 h-10 mx-auto mb-3 opacity-30" />
                        <p className="text-sm">No pending payments to verify</p>
                      </div>
                    ) : (
                      pendingPayments.map((p) => (
                        <div key={p._id} className="bg-white dark:bg-wa-dark-panel rounded-xl border border-wa-border dark:border-wa-dark-border p-5">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-bold text-wa-text-primary dark:text-white">{p.organizationId?.name || 'Unknown Org'}</p>
                              <p className="text-xs text-wa-text-secondary mt-1">{p.organizationId?.contactEmail} • {p.paymentMethod?.replace('_', ' ')}</p>
                              <div className="mt-2 flex items-center gap-4 text-xs text-wa-text-secondary">
                                <span>Plan: <strong>{p.planMonths} Month{p.planMonths > 1 ? 's' : ''}</strong></span>
                                <span>Amount: <strong className="text-wa-text-primary dark:text-white">₹{p.totalAmount?.toLocaleString('en-IN')}</strong></span>
                                <span>Ref: <strong>{p.transactionId || 'N/A'}</strong></span>
                                <span>{formatDateOnly(p.createdAt)}</span>
                              </div>
                              {p.notes && <p className="text-xs text-wa-text-secondary mt-1 italic">Notes: {p.notes}</p>}
                            </div>
                            <div className="flex gap-2">
                              {p.screenshot && (
                                <a href={p.screenshot} target="_blank" rel="noopener noreferrer" className="px-3 py-2 bg-blue-50 dark:bg-blue-950/30 text-blue-600 rounded-lg text-xs font-semibold flex items-center gap-1 hover:bg-blue-100 transition-colors">
                                  <Eye className="w-3.5 h-3.5" /> View Screenshot
                                </a>
                              )}
                              <button onClick={() => handleVerifyPayment(p._id, 'approve')} className="px-3 py-2 bg-emerald-550 dark:bg-emerald-950/30 text-emerald-600 rounded-lg text-xs font-semibold flex items-center gap-1 hover:bg-emerald-100 transition-colors">
                                <CheckCircle className="w-3.5 h-3.5" /> Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => setRejectModal({
                                  open: true,
                                  paymentId: p._id,
                                  clientName: p.organizationId?.name || 'Client',
                                  amount: p.totalAmount || 0,
                                  reason: ''
                                })}
                                className="px-3 py-2 bg-red-50 dark:bg-red-950/30 text-red-600 rounded-lg text-xs font-semibold flex items-center gap-1 hover:bg-red-100 transition-colors cursor-pointer"
                              >
                                <Ban className="w-3.5 h-3.5" /> Reject
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 5. FEATURE PERMISSIONS TAB */}
            {activeTab === 'permissions' && (
              <FeaturePermissionsTab />
            )}
          </>
        )}
      </div>


      
      {/* Official Tax Invoice Modal for SuperAdmin */}
      {viewInvoiceModal.open && viewInvoiceModal.payment && (
        <Portal>
          <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 overflow-y-auto animate-fadeIn print:bg-white print:p-0 print:static">
            <style>{`
              @media print {
                @page { size: A4 portrait; margin: 12mm 15mm; }
                body * { visibility: hidden !important; }
                #superadmin-invoice-print-area, #superadmin-invoice-print-area * { visibility: visible !important; }
                #superadmin-invoice-print-area {
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
              id="superadmin-invoice-print-area"
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
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-700">
                        {viewInvoiceModal.payment.status}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Billed To (Customer)</span>
                  <p className="font-bold text-sm text-slate-900 dark:text-white print:text-black mt-1">
                    {viewInvoiceModal.payment.owner?.name || viewInvoiceModal.payment.organizationId?.owner?.name || viewInvoiceModal.payment.organizationId?.contactEmail?.split('@')[0] || 'Valued Customer'}
                  </p>
                  <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 mt-0.5">
                    {viewInvoiceModal.payment.organizationId?.name || (typeof viewInvoiceModal.payment.organizationId === 'string' ? viewInvoiceModal.payment.organizationId : 'Client Organization')}
                  </p>
                  <p className="text-slate-500 font-mono text-[11px] mt-0.5 truncate">
                    {viewInvoiceModal.payment.owner?.email || viewInvoiceModal.payment.organizationId?.contactEmail || ''}
                  </p>
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
                <p className="mt-0.5">HariKrushn DigiVerse / HK Automation Platform</p>
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

      {/* CREATE/EDIT ORG MODAL */}
      {isOrgModalOpen && (
        <Portal>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99999] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-dark-900 border border-dark-200 dark:border-dark-800 rounded-2xl w-full max-w-2xl overflow-hidden animate-slide-up flex flex-col shadow-2xl max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-dark-200 dark:border-dark-800 px-6 py-4">
              <h3 className="font-bold text-base text-dark-800 dark:text-white flex items-center gap-2">
                <Building className="w-5 h-5 text-brand-500" />
                <span>{editingOrgId ? 'Configure Organization Plan & Profile' : 'Register Organization & Tenant Admin'}</span>
              </h3>
              <button onClick={() => setIsOrgModalOpen(false)} className="p-1 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-800 text-dark-500">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleOrgSubmit} className="p-6 space-y-4 overflow-y-auto flex-1 scrollbar-thin text-xs">
              
              {/* SECTION: COMPANY PROFILE */}
              <div className="space-y-3">
                <h4 className="font-bold text-[10px] text-brand-500 uppercase tracking-widest border-b pb-1">Company Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-dark-500 mb-1">Company Name *</label>
                    <input
                      type="text" required
                      value={orgForm.name}
                      onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })}
                      className="w-full px-3 py-2 border rounded-xl bg-transparent dark:text-white dark:border-dark-700"
                      placeholder="e.g. Acme Corp"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-dark-500 mb-1">Company Logo</label>
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
                      onChange={(e) => handleLogoFileSelect(e.target.files?.[0])}
                      className="hidden"
                    />
                    {logoPreview || orgForm.logo ? (
                      <div className="relative group w-full h-[100px] rounded-xl border-2 border-dashed border-brand-300 dark:border-brand-700 overflow-hidden bg-gray-50 dark:bg-dark-800 flex items-center justify-center">
                        <img
                          src={logoPreview || (orgForm.logo?.startsWith('/uploads') ? (typeof window !== 'undefined' ? `/api${orgForm.logo}` : `${(process.env.NEXT_PUBLIC_API_URL || '/api').replace(/\/api\/?$/, '')}${orgForm.logo}`) : orgForm.logo)}
                          alt="Logo preview"
                          className="max-h-[90px] max-w-full object-contain"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => logoInputRef.current?.click()}
                            className="p-2 bg-white/90 rounded-lg text-dark-700 hover:bg-white transition-colors"
                            title="Change logo"
                          >
                            <Upload className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => { setLogoFile(null); setLogoPreview(''); setOrgForm({ ...orgForm, logo: '' }); if (logoInputRef.current) logoInputRef.current.value = ''; }}
                            className="p-2 bg-white/90 rounded-lg text-red-600 hover:bg-white transition-colors"
                            title="Remove logo"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        {uploadingLogo && (
                          <div className="absolute inset-0 bg-white/70 dark:bg-dark-900/70 flex items-center justify-center">
                            <Loader2 className="w-6 h-6 text-brand-500 animate-spin" />
                          </div>
                        )}
                      </div>
                    ) : (
                      <div
                        onClick={() => logoInputRef.current?.click()}
                        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                        onDrop={(e) => { e.preventDefault(); e.stopPropagation(); handleLogoFileSelect(e.dataTransfer.files?.[0]); }}
                        className="w-full h-[100px] rounded-xl border-2 border-dashed border-gray-300 dark:border-dark-600 hover:border-brand-400 dark:hover:border-brand-600 bg-gray-50 dark:bg-dark-800 flex flex-col items-center justify-center cursor-pointer transition-colors group"
                      >
                        <ImageIcon className="w-6 h-6 text-gray-400 group-hover:text-brand-500 mb-1 transition-colors" />
                        <span className="text-xs text-gray-500 dark:text-gray-400 group-hover:text-brand-500 transition-colors">Click or drag to upload</span>
                        <span className="text-[10px] text-gray-400 mt-0.5">JPG, PNG, GIF, WEBP, SVG (max 5MB)</span>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block font-bold text-dark-500 mb-1">Website URL</label>
                    <input
                      type="url"
                      value={orgForm.website}
                      onChange={(e) => setOrgForm({ ...orgForm, website: e.target.value })}
                      className="w-full px-3 py-2 border rounded-xl bg-transparent dark:text-white dark:border-dark-700"
                      placeholder="https://example.com"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-dark-500 mb-1">GST Number (Optional)</label>
                    <input
                      type="text"
                      value={orgForm.gstNumber}
                      onChange={(e) => setOrgForm({ ...orgForm, gstNumber: e.target.value })}
                      className="w-full px-3 py-2 border rounded-xl bg-transparent dark:text-white dark:border-dark-700"
                      placeholder="e.g. 22AAAAA0000A1Z5"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-dark-500 mb-1">Business Type</label>
                    <input
                      type="text"
                      value={orgForm.businessType}
                      onChange={(e) => setOrgForm({ ...orgForm, businessType: e.target.value })}
                      className="w-full px-3 py-2 border rounded-xl bg-transparent dark:text-white dark:border-dark-700"
                      placeholder="e.g. B2B, B2C"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-dark-500 mb-1">Industry</label>
                    <input
                      type="text"
                      value={orgForm.industry}
                      onChange={(e) => setOrgForm({ ...orgForm, industry: e.target.value })}
                      className="w-full px-3 py-2 border rounded-xl bg-transparent dark:text-white dark:border-dark-700"
                      placeholder="e.g. Technology, Retail"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="md:col-span-2">
                    <label className="block font-bold text-dark-500 mb-1">Street Address</label>
                    <input
                      type="text"
                      value={orgForm.address}
                      onChange={(e) => setOrgForm({ ...orgForm, address: e.target.value })}
                      className="w-full px-3 py-2 border rounded-xl bg-transparent dark:text-white dark:border-dark-700"
                      placeholder="123 Main Street"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-dark-500 mb-1">City</label>
                    <input
                      type="text"
                      value={orgForm.city}
                      onChange={(e) => setOrgForm({ ...orgForm, city: e.target.value })}
                      className="w-full px-3 py-2 border rounded-xl bg-transparent dark:text-white dark:border-dark-700"
                      placeholder="Surat"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-dark-500 mb-1">Country</label>
                    <input
                      type="text"
                      value={orgForm.country}
                      onChange={(e) => setOrgForm({ ...orgForm, country: e.target.value })}
                      className="w-full px-3 py-2 border rounded-xl bg-transparent dark:text-white dark:border-dark-700"
                      placeholder="India"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION: PLAN LIMITS */}
              <div className="space-y-3 pt-2">
                <h4 className="font-bold text-[10px] text-brand-500 uppercase tracking-widest border-b pb-1">Subscription plan limits</h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block font-bold text-dark-500 mb-1">SaaS Plan *</label>
                    <select
                      value={orgForm.plan}
                      onChange={(e) => setOrgForm({ ...orgForm, plan: e.target.value })}
                      className="w-full px-3 py-2 border rounded-xl bg-transparent dark:text-white dark:border-dark-700 bg-white dark:bg-dark-900"
                    >
                      <option value="free">Free Plan</option>
                      <option value="starter">Starter</option>
                      <option value="pro">Pro Plan</option>
                      <option value="enterprise">Enterprise</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-dark-500 mb-1">Max Telecallers *</label>
                    <input
                      type="number" required min="1"
                      value={orgForm.maxTelecallers}
                      onChange={(e) => setOrgForm({ ...orgForm, maxTelecallers: parseInt(e.target.value, 10) })}
                      className="w-full px-3 py-2 border rounded-xl bg-transparent dark:text-white dark:border-dark-700"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-dark-500 mb-1">Max Leads Allowed *</label>
                    <input
                      type="number" required min="1"
                      value={orgForm.maxLeads}
                      onChange={(e) => setOrgForm({ ...orgForm, maxLeads: parseInt(e.target.value, 10) })}
                      className="w-full px-3 py-2 border rounded-xl bg-transparent dark:text-white dark:border-dark-700"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-dark-500 mb-1">Max Monthly Chats *</label>
                    <input
                      type="number" required min="1"
                      value={orgForm.maxMonthlyConversations}
                      onChange={(e) => setOrgForm({ ...orgForm, maxMonthlyConversations: parseInt(e.target.value, 10) })}
                      className="w-full px-3 py-2 border rounded-xl bg-transparent dark:text-white dark:border-dark-700"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION: ADMIN CONFIG (Only when creating) */}
              {!editingOrgId && (
                <div className="space-y-3 pt-2">
                  <h4 className="font-bold text-[10px] text-brand-500 uppercase tracking-widest border-b pb-1">Primary Organization Admin Credential</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-bold text-dark-500 mb-1">Admin Full Name *</label>
                      <input
                        type="text" required
                        value={orgForm.adminName}
                        onChange={(e) => setOrgForm({ ...orgForm, adminName: e.target.value })}
                        className="w-full px-3 py-2 border rounded-xl bg-transparent dark:text-white dark:border-dark-700"
                        placeholder="Parth Devani"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-dark-500 mb-1">Admin Email Address *</label>
                      <input
                        type="email" required
                        value={orgForm.adminEmail}
                        onChange={(e) => setOrgForm({ ...orgForm, adminEmail: e.target.value })}
                        className="w-full px-3 py-2 border rounded-xl bg-transparent dark:text-white dark:border-dark-700"
                        placeholder="admin@company.com"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-dark-500 mb-1">Admin Phone Number</label>
                      <input
                        type="text"
                        value={orgForm.contactNumber}
                        onChange={(e) => setOrgForm({ ...orgForm, contactNumber: e.target.value, contactPerson: orgForm.adminName })}
                        className="w-full px-3 py-2 border rounded-xl bg-transparent dark:text-white dark:border-dark-700"
                        placeholder="+91 99999 88888"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-dark-500 mb-1">Admin Default Password *</label>
                      <input
                        type="password" required
                        value={orgForm.adminPassword}
                        onChange={(e) => setOrgForm({ ...orgForm, adminPassword: e.target.value })}
                        className="w-full px-3 py-2 border rounded-xl bg-transparent dark:text-white dark:border-dark-700"
                        placeholder="Minimum 8 characters"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3 justify-end pt-4 border-t border-dark-200 dark:border-dark-800">
                <button type="button" onClick={() => setIsOrgModalOpen(false)} className="btn-secondary py-2 px-4" disabled={actionLoading}>Cancel</button>
                <button type="submit" disabled={actionLoading} className="btn-primary py-2 px-5 flex items-center gap-1.5">
                  {actionLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingOrgId ? 'Save Configuration' : 'Register SaaS Tenant'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </Portal>
      )}

      {/* RESET ADMIN PASSWORD MODAL */}
      {isPasswordModalOpen && (
        <Portal>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99999] flex items-center justify-center p-4">
            <div className="bg-white dark:bg-dark-900 border border-dark-200 dark:border-dark-800 rounded-2xl w-full max-w-sm overflow-hidden animate-slide-up shadow-2xl">
              <div className="flex items-center justify-between border-b border-dark-200 dark:border-dark-800 px-5 py-4">
                <h3 className="font-bold text-sm text-dark-800 dark:text-white flex items-center gap-1.5">
                  <Lock className="w-4.5 h-4.5 text-amber-500" />
                  <span>Reset Admin Password</span>
                </h3>
                <button onClick={() => setIsPasswordModalOpen(false)} className="p-1 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-800 text-dark-500">
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleResetPasswordSubmit} className="p-5 space-y-4 text-xs">
                <p className="text-dark-500 leading-normal">
                  You are resetting the password for organization admin: <strong className="dark:text-white font-semibold">{resetEmail}</strong>.
                </p>
                <div>
                  <label className="block font-bold text-dark-500 mb-1">New Password *</label>
                  <input
                    type="password" required
                    placeholder="Minimum 8 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl bg-transparent dark:text-white dark:border-dark-700"
                  />
                </div>

                <div className="flex gap-3 justify-end pt-3 border-t border-dark-200 dark:border-dark-800">
                  <button type="button" onClick={() => setIsPasswordModalOpen(false)} className="btn-secondary py-2 px-4" disabled={actionLoading}>Cancel</button>
                  <button type="submit" disabled={actionLoading} className="btn-primary py-2 px-4 flex items-center gap-1.5">
                    {actionLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    <span>Save Password</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </Portal>
      )}

      {/* Simple Clean Modal for Offline Payment Rejection */}
      {rejectModal.open && (
        <Portal>
          <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
            <div className="bg-white dark:bg-wa-dark-panel rounded-2xl border border-wa-border dark:border-wa-dark-border shadow-2xl w-full max-w-md p-6 space-y-4">
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-red-100 dark:bg-red-950/50 text-red-600 flex items-center justify-center shrink-0">
                    <Ban className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white">Reject Offline Payment</h3>
                    <p className="text-xs text-slate-500">{rejectModal.clientName} &bull; ₹{rejectModal.amount.toLocaleString('en-IN')}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setRejectModal({ open: false, paymentId: null, clientName: '', amount: 0, reason: '' })}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Input for Reason */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Rejection Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={rejectModal.reason}
                  onChange={(e) => setRejectModal(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder="e.g. Transaction UTR not credited in bank account, screenshot unclear, amount mismatch..."
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500/20 resize-none"
                  autoFocus
                />
                <p className="text-[11px] text-slate-400">This reason will be recorded and communicated to the client organization.</p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setRejectModal({ open: false, paymentId: null, clientName: '', amount: 0, reason: '' })}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!rejectModal.reason.trim()}
                  onClick={async () => {
                    if (!rejectModal.reason.trim()) return;
                    await handleVerifyPayment(rejectModal.paymentId, 'reject', rejectModal.reason.trim());
                    setRejectModal({ open: false, paymentId: null, clientName: '', amount: 0, reason: '' });
                  }}
                  className="px-4 py-2 text-xs font-bold bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl shadow-sm transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Ban className="w-3.5 h-3.5" />
                  <span>Confirm Rejection</span>
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}
