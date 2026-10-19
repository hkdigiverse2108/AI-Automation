'use client';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import api from '../../../lib/api';
import { toast } from 'react-hot-toast';
import Portal from '../../../components/Portal';
import { 
  Building2, Landmark, Receipt, FileText, Plus, Trash2, Save, Printer, 
  Search, Users, RefreshCw, Eye, CheckCircle2, Clock, AlertCircle, 
  ExternalLink, ArrowRight, Sparkles, MapPin, Phone, Mail, Globe, 
  ShieldCheck, CreditCard, ChevronDown, Check, X, Loader2, Upload,
  Image as ImageIcon, Percent, Calculator, CalendarDays, Download, Pencil
} from 'lucide-react';

const INDIAN_STATES = [
  'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar',
  'Chandigarh', 'Chhattisgarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa',
  'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir', 'Jharkhand', 'Karnataka',
  'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Puducherry', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh',
  'Uttarakhand', 'West Bengal'
];

function convertNumberToWords(num) {
  if (num === null || num === undefined || isNaN(num)) return 'Zero Rupees Only';
  const rounded = Math.round(Number(num));
  if (rounded === 0) return 'Zero Rupees Only';
  if (rounded === 1) return 'One Rupee Only';
  if (rounded < 0) return 'Minus ' + convertNumberToWords(Math.abs(rounded));

  const ones = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen'
  ];

  const tens = [
    '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'
  ];

  function convertBelowThousand(n) {
    let str = '';
    if (n >= 100) {
      str += ones[Math.floor(n / 100)] + ' Hundred ';
      n %= 100;
    }
    if (n >= 20) {
      str += tens[Math.floor(n / 10)] + ' ';
      n %= 10;
    }
    if (n > 0) {
      str += ones[n] + ' ';
    }
    return str.trim();
  }

  let words = '';
  let n = rounded;

  const crore = Math.floor(n / 10000000);
  n %= 10000000;

  const lakh = Math.floor(n / 100000);
  n %= 100000;

  const thousand = Math.floor(n / 1000);
  n %= 1000;

  const hundred = n;

  if (crore > 0) {
    words += convertBelowThousand(crore) + ' Crore ';
  }
  if (lakh > 0) {
    words += convertBelowThousand(lakh) + ' Lakh ';
  }
  if (thousand > 0) {
    words += convertBelowThousand(thousand) + ' Thousand ';
  }
  if (hundred > 0) {
    words += convertBelowThousand(hundred) + ' ';
  }

  words = words.trim();
  return words ? `${words} Rupees Only` : 'Zero Rupees Only';
}

export default function InvoiceSettingsPage() {
  const [activeTab, setActiveTab] = useState('settings'); // 'settings' | 'generate' | 'history'
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [generating, setGenerating] = useState(false);
  const logoFileInputRef = useRef(null);

  // 1. Settings State
  const [settings, setSettings] = useState({
    companyName: '',
    tagline: '',
    logo: '',
    address: '',
    city: '',
    state: 'Gujarat',
    country: 'India',
    pincode: '',
    contactEmail: '',
    contactNumber: '',
    website: '',
    gstin: '',
    pan: '',
    bankName: '',
    accountHolder: '',
    accountNumber: '',
    ifscCode: '',
    branch: '',
    upiId: '',
    upiQrCode: '',
    otherAccounts: [],
    currency: 'INR',
    currencySymbol: '₹',
    invoicePrefix: 'INV-',
    nextInvoiceNumber: 1001,
    defaultDueDays: 15,
    defaultInvoiceType: 'tax_invoice',
    defaultNotes: 'Thank you for choosing our services!',
    defaultTerms: '1. Payment is due within 15 days of the invoice date.\n2. Late payments may incur additional charges.\n3. All disputes are subject to Gujarat Jurisdiction.'
  });

  // 2. Customers List for dynamic dropdown
  const [customers, setCustomers] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');

  // 3. New Invoice Form State
  const [invoiceForm, setInvoiceForm] = useState({
    invoiceNumber: 'INV-1001',
    invoiceType: 'tax_invoice', // 'tax_invoice' | 'proforma_invoice'
    paymentMode: 'current_account', // tax: 'current_account', 'cash_with_gst' | proforma: 'cash', 'other_account'
    selectedOtherAccountId: '',
    invoiceDate: new Date().toISOString().split('T')[0],
    dueDays: 15,
    dueDate: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
    customerId: '',
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    customerCity: '',
    customerState: 'Gujarat',
    customerAddress: '',
    customerGstin: '',
    taxOption: 'cgst_sgst', // 'no_tax' | 'cgst_sgst' | 'igst'
    taxOptionOverridden: false,
    gstTypeOverride: '', // '' (auto) | 'intra_state' | 'inter_state'
    items: [
      { 
        description: 'Consulting & Solution Setup', 
        hsnSac: '998313', 
        quantity: 1, 
        unitPrice: 5000, 
        discountPerUnit: 0, 
        totalDiscount: 0, 
        amount: 5000 
      }
    ],
    taxPercent: 18,
    discount: 0, // overall discount
    notes: 'Thank you for choosing our services!',
    terms: '1. Payment is due within 15 days of the invoice date.\n2. Late payments may incur additional charges.\n3. All disputes are subject to Gujarat Jurisdiction.'
  });

  // 4. Invoices History State
  const [invoices, setInvoices] = useState([]);
  const [historySearch, setHistorySearch] = useState('');
  const [selectedInvoiceForView, setSelectedInvoiceForView] = useState(null);

  // 5. Form Inline Validation Errors State
  const [errors, setErrors] = useState({});

  // 6. Other Bank Accounts Modal & State
  const [showOtherAccountModal, setShowOtherAccountModal] = useState(false);
  const [editingOtherAccount, setEditingOtherAccount] = useState(null);
  const [otherAccountForm, setOtherAccountForm] = useState({
    id: '',
    accountTitle: '',
    bankName: '',
    accountHolder: '',
    accountNumber: '',
    ifscCode: '',
    branch: '',
    upiId: ''
  });
  const [savingOtherAccount, setSavingOtherAccount] = useState(false);

  const handleOpenAddOtherAccount = () => {
    setEditingOtherAccount(null);
    setOtherAccountForm({
      id: `acc_${Date.now()}`,
      accountTitle: '',
      bankName: '',
      accountHolder: '',
      accountNumber: '',
      ifscCode: '',
      branch: '',
      upiId: ''
    });
    setShowOtherAccountModal(true);
  };

  const handleOpenEditOtherAccount = (acc) => {
    setEditingOtherAccount(acc);
    setOtherAccountForm({
      id: acc.id,
      accountTitle: acc.accountTitle || '',
      bankName: acc.bankName || '',
      accountHolder: acc.accountHolder || '',
      accountNumber: acc.accountNumber || '',
      ifscCode: acc.ifscCode || '',
      branch: acc.branch || '',
      upiId: acc.upiId || ''
    });
    setShowOtherAccountModal(true);
  };

  const handleSaveOtherAccount = async (e) => {
    if (e) e.preventDefault();
    if (!otherAccountForm.bankName?.trim()) {
      toast.error('Bank Name is required');
      return;
    }
    if (!otherAccountForm.accountNumber?.trim()) {
      toast.error('Account Number is required');
      return;
    }

    setSavingOtherAccount(true);
    try {
      const existingAccounts = Array.isArray(settings.otherAccounts) ? [...settings.otherAccounts] : [];
      let updatedList = [];

      if (editingOtherAccount) {
        updatedList = existingAccounts.map((acc) =>
          acc.id === editingOtherAccount.id ? { ...otherAccountForm, id: acc.id } : acc
        );
      } else {
        const newAcc = {
          ...otherAccountForm,
          id: otherAccountForm.id || `acc_${Date.now()}`,
          accountTitle: otherAccountForm.accountTitle?.trim() || otherAccountForm.bankName
        };
        updatedList = [...existingAccounts, newAcc];
      }

      const updatedSettings = {
        ...settings,
        otherAccounts: updatedList
      };

      const { data } = await api.put('/invoices/settings', updatedSettings);
      if (data.success) {
        setSettings(data.data.settings);
        toast.success(editingOtherAccount ? 'Other bank account updated!' : 'Other bank account added!');
        
        setInvoiceForm((prev) => ({
          ...prev,
          selectedOtherAccountId: prev.selectedOtherAccountId || otherAccountForm.id || updatedList[0]?.id || ''
        }));
        
        setShowOtherAccountModal(false);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save other account');
    } finally {
      setSavingOtherAccount(false);
    }
  };

  const handleDeleteOtherAccount = async (accId) => {
    if (!confirm('Are you sure you want to delete this bank account?')) return;
    try {
      const existingAccounts = Array.isArray(settings.otherAccounts) ? [...settings.otherAccounts] : [];
      const updatedList = existingAccounts.filter((acc) => acc.id !== accId);

      const updatedSettings = {
        ...settings,
        otherAccounts: updatedList
      };

      const { data } = await api.put('/invoices/settings', updatedSettings);
      if (data.success) {
        setSettings(data.data.settings);
        toast.success('Bank account deleted');

        setInvoiceForm((prev) => ({
          ...prev,
          selectedOtherAccountId: prev.selectedOtherAccountId === accId ? (updatedList[0]?.id || '') : prev.selectedOtherAccountId
        }));
      }
    } catch (err) {
      toast.error('Failed to delete account');
    }
  };

  const clearError = (field) => {
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const copy = { ...prev };
      delete copy[field];
      return copy;
    });
  };

  const validateInvoiceForm = () => {
    const errs = {};

    // 1. Invoice Number (Strictly Mandatory)
    if (!invoiceForm.invoiceNumber?.trim()) {
      errs.invoiceNumber = 'Invoice Number is required';
    }

    // 2. Invoice Date (Strictly Mandatory)
    if (!invoiceForm.invoiceDate) {
      errs.invoiceDate = 'Invoice Date is required';
    }

    // 3. Due in Days & Due Date
    if (invoiceForm.dueDays === '' || isNaN(Number(invoiceForm.dueDays)) || Number(invoiceForm.dueDays) < 0) {
      errs.dueDays = 'Due days must be 0 or more';
    }
    if (!invoiceForm.dueDate) {
      errs.dueDate = 'Due Date is required';
    }

    // 4. Client / Customer Name (Strictly Mandatory)
    if (!invoiceForm.customerName?.trim()) {
      errs.customerName = 'Customer / Client Name is required';
    }

    // 5. Customer Phone Number (Required for CRM follow-ups & communication)
    if (!invoiceForm.customerPhone?.trim()) {
      errs.customerPhone = 'Contact Phone Number is required';
    } else {
      const cleanPhone = invoiceForm.customerPhone.replace(/[^0-9]/g, '');
      if (cleanPhone.length < 10) {
        errs.customerPhone = 'Enter a valid 10-digit phone number';
      }
    }

    // 6. Customer State (Required for GST Tax Type determination)
    if (!invoiceForm.customerState?.trim()) {
      errs.customerState = 'State is required to determine GST type';
    }

    // 7. Customer GSTIN (Strictly Mandatory for Tax Invoice, Optional for Proforma)
    if (invoiceForm.invoiceType === 'tax_invoice') {
      if (!invoiceForm.customerGstin?.trim()) {
        errs.customerGstin = 'GSTIN is required for Tax Invoice';
      } else {
        const cleanGst = invoiceForm.customerGstin.trim().toUpperCase();
        if (cleanGst.length !== 15) {
          errs.customerGstin = 'GSTIN must be 15 characters (e.g. 24AAXFN3372M1ZK)';
        }
      }
    } else {
      // Optional for Proforma Invoice; validate length only if entered
      if (invoiceForm.customerGstin?.trim()) {
        const cleanGst = invoiceForm.customerGstin.trim().toUpperCase();
        if (cleanGst.length !== 15) {
          errs.customerGstin = 'GSTIN must be 15 characters';
        }
      }
    }

    // 8. Line Items (Must have at least 1 valid item)
    if (!invoiceForm.items || invoiceForm.items.length === 0) {
      errs.items = 'At least one line item is required';
    } else {
      invoiceForm.items.forEach((item, idx) => {
        if (!item.description?.trim()) {
          errs[`item_${idx}_description`] = 'Item name is required';
        }
        const qtyNum = Number(item.quantity);
        if (item.quantity === '' || item.quantity === null || isNaN(qtyNum) || qtyNum <= 0) {
          errs[`item_${idx}_quantity`] = 'Qty must be ≥ 1';
        }
        const rateNum = Number(item.unitPrice);
        if (item.unitPrice === '' || item.unitPrice === null || isNaN(rateNum) || rateNum < 0) {
          errs[`item_${idx}_unitPrice`] = 'Rate is required';
        }
        const discNum = Number(item.discountPerUnit || 0);
        if (discNum > rateNum && rateNum > 0) {
          errs[`item_${idx}_discountPerUnit`] = 'Discount cannot exceed rate';
        }
      });
    }

    setErrors(errs);
    return errs;
  };

  // Fetch Settings
  const fetchSettings = useCallback(async () => {
    try {
      const { data } = await api.get('/invoices/settings');
      if (data.success && data.data?.settings) {
        const loaded = data.data.settings;
        setSettings((prev) => ({ ...prev, ...loaded }));
        const prefix = loaded.invoicePrefix || 'INV-';
        const nextNum = loaded.nextInvoiceNumber || 1001;
        const dueD = loaded.defaultDueDays || 15;
        const invType = loaded.defaultInvoiceType || 'tax_invoice';
        const defaultTaxOpt = invType === 'proforma_invoice' ? 'no_tax' : 'cgst_sgst';
        
        setInvoiceForm((f) => ({
          ...f,
          invoiceNumber: `${prefix}${nextNum}`,
          invoiceType: invType,
          paymentMode: invType === 'tax_invoice' ? 'current_account' : 'cash',
          selectedOtherAccountId: f.selectedOtherAccountId || loaded.otherAccounts?.[0]?.id || '',
          dueDays: dueD,
          customerState: loaded.state || 'Gujarat',
          taxOption: defaultTaxOpt,
          taxOptionOverridden: false,
          notes: loaded.defaultNotes || f.notes,
          terms: loaded.defaultTerms || f.terms
        }));
      }
    } catch (err) {
      toast.error('Failed to load invoice settings');
    }
  }, []);

  // Fetch Customers (Contacts/Leads)
  const fetchCustomers = useCallback(async () => {
    try {
      const { data } = await api.get('/invoices/customers');
      if (data.success) {
        setCustomers(data.data?.customers || []);
      }
    } catch (_) {}
  }, []);

  // Fetch Invoices History
  const fetchInvoices = useCallback(async () => {
    try {
      const { data } = await api.get('/invoices');
      if (data.success) {
        setInvoices(data.data?.invoices || []);
      }
    } catch (_) {}
  }, []);

  const searchParams = useSearchParams();

  useEffect(() => {
    async function init() {
      setLoading(true);
      await Promise.all([fetchSettings(), fetchCustomers(), fetchInvoices()]);
      setLoading(false);
    }
    init();
  }, [fetchSettings, fetchCustomers, fetchInvoices]);

  // Handle URL Query Params
  useEffect(() => {
    const tabParam = searchParams?.get('tab');
    if (tabParam && ['settings', 'generate', 'history'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
    const custId = searchParams?.get('customerId');
    if (custId && customers.length > 0) {
      handleSelectCustomer(custId);
      setActiveTab('generate');
    }
  }, [searchParams, customers]);

  // Logo file selection and direct upload handler
  const handleLogoFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file (PNG, JPG, WebP, SVG)');
      return;
    }

    // Immediate local preview via FileReader
    const reader = new FileReader();
    reader.onload = (event) => {
      const localUrl = event.target?.result;
      setSettings((prev) => ({ ...prev, logo: localUrl }));
    };
    reader.readAsDataURL(file);

    // Upload to server
    const formData = new FormData();
    formData.append('logo', file);

    setUploadingLogo(true);
    try {
      const { data } = await api.post('/invoices/upload-logo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (data.success && data.url) {
        setSettings((prev) => ({ ...prev, logo: data.url }));
        toast.success('Company logo uploaded successfully!');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to upload logo image');
    } finally {
      setUploadingLogo(false);
      if (logoFileInputRef.current) {
        logoFileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveLogo = () => {
    setSettings((prev) => ({ ...prev, logo: '' }));
    toast.success('Company logo removed');
  };

  // Handle Customer Selection (Auto-Fetch Details)
  const handleSelectCustomer = (custId) => {
    setSelectedCustomerId(custId);
    clearError('customerName');
    clearError('customerPhone');
    clearError('customerState');
    clearError('customerGstin');

    if (!custId) {
      setInvoiceForm((prev) => ({
        ...prev,
        customerId: '',
        customerName: '',
        customerPhone: '',
        customerEmail: '',
        customerCity: '',
        customerState: settings.state || 'Gujarat',
        customerAddress: '',
        customerGstin: ''
      }));
      return;
    }

    const c = customers.find((item) => item._id === custId);
    if (c) {
      // Infer state from city if state is not explicitly set
      let derivedState = c.state || '';
      if (!derivedState && c.city) {
        const cityLower = c.city.toLowerCase();
        if (cityLower.includes('surat') || cityLower.includes('ahmedabad') || cityLower.includes('vadodara') || cityLower.includes('rajkot')) {
          derivedState = 'Gujarat';
        } else if (cityLower.includes('mumbai') || cityLower.includes('pune') || cityLower.includes('nagpur')) {
          derivedState = 'Maharashtra';
        } else if (cityLower.includes('delhi')) {
          derivedState = 'Delhi';
        } else if (cityLower.includes('bangalore') || cityLower.includes('bengaluru')) {
          derivedState = 'Karnataka';
        } else if (cityLower.includes('jaipur')) {
          derivedState = 'Rajasthan';
        }
      }

      setInvoiceForm((prev) => {
        const targetState = derivedState || prev.customerState || settings.state || 'Gujarat';
        let autoTaxOption = prev.taxOption;
        if (!prev.taxOptionOverridden) {
          if (prev.invoiceType === 'proforma_invoice') {
            autoTaxOption = 'no_tax';
          } else {
            const compState = (settings.state || 'Gujarat').trim().toLowerCase();
            const isIntra = !targetState || compState === targetState.trim().toLowerCase();
            autoTaxOption = isIntra ? 'cgst_sgst' : 'igst';
          }
        }

        return {
          ...prev,
          customerId: c._id,
          customerName: c.name || '',
          customerPhone: c.phone || '',
          customerEmail: c.email || '',
          customerCity: c.city || '',
          customerState: targetState,
          taxOption: autoTaxOption,
          customerAddress: c.address || c.city || '',
          customerGstin: c.gstin || '',
          items: c.serviceRequired
            ? [
                {
                  description: `${c.serviceRequired} Package`,
                  hsnSac: '998313',
                  quantity: 1,
                  unitPrice: prev.items[0]?.unitPrice || 5000,
                  discountPerUnit: 0,
                  totalDiscount: 0,
                  amount: prev.items[0]?.unitPrice || 5000
                }
              ]
            : prev.items
        };
      });
      toast.success(`Loaded customer details: ${c.name || c.phone}`);
    }
  };

  // Due Days & Date Handlers - Preserve user's custom terms!
  const handleDueDaysChange = (days) => {
    const invDate = new Date(invoiceForm.invoiceDate || Date.now());
    if (days === '' || days === null) {
      setInvoiceForm((prev) => ({
        ...prev,
        dueDays: ''
      }));
      return;
    }
    const d = parseInt(days) || 0;
    const newDueDate = new Date(invDate.getTime() + d * 86400000).toISOString().split('T')[0];
    setInvoiceForm((prev) => ({
      ...prev,
      dueDays: d,
      dueDate: newDueDate
    }));
  };

  const handleInvoiceDateChange = (date) => {
    const invDate = new Date(date || Date.now());
    const d = invoiceForm.dueDays === '' ? 15 : Number(invoiceForm.dueDays) || 0;
    const newDueDate = new Date(invDate.getTime() + d * 86400000).toISOString().split('T')[0];
    setInvoiceForm((prev) => ({
      ...prev,
      invoiceDate: date,
      dueDate: newDueDate
    }));
  };

  const handleDueDateChange = (date) => {
    if (!date) {
      setInvoiceForm((prev) => ({
        ...prev,
        dueDate: ''
      }));
      return;
    }
    const invDate = new Date(invoiceForm.invoiceDate || Date.now());
    const dDate = new Date(date);
    const diffDays = Math.max(0, Math.round((dDate.getTime() - invDate.getTime()) / 86400000));
    setInvoiceForm((prev) => ({
      ...prev,
      dueDate: date,
      dueDays: isNaN(diffDays) ? prev.dueDays : diffDays
    }));
  };

  // Invoice Type change handler
  const handleInvoiceTypeChange = (type) => {
    if (type === 'proforma_invoice') {
      clearError('customerGstin');
    }
    setInvoiceForm((prev) => {
      let mode = prev.paymentMode;
      let newTaxOpt;

      if (type === 'tax_invoice') {
        if (mode !== 'current_account' && mode !== 'cash_with_gst') {
          mode = 'current_account';
        }
        // When switching to Tax Invoice: default auto-decided based on customer state vs company state
        const compState = (settings.state || 'Gujarat').trim().toLowerCase();
        const custState = (prev.customerState || '').trim().toLowerCase();
        const isIntra = !custState || compState === custState;
        newTaxOpt = isIntra ? 'cgst_sgst' : 'igst';
      } else {
        // proforma_invoice: default is NO TAX and no GST calculated
        if (mode !== 'cash' && mode !== 'other_account') {
          mode = 'cash';
        }
        newTaxOpt = 'no_tax';
      }

      return {
        ...prev,
        invoiceType: type,
        paymentMode: mode,
        selectedOtherAccountId: (mode === 'other_account' && !prev.selectedOtherAccountId)
          ? (settings.otherAccounts?.[0]?.id || '')
          : prev.selectedOtherAccountId,
        taxOption: newTaxOpt,
        taxOptionOverridden: false
      };
    });
  };

  // Tax Option manual change handler (No Tax, SGST+CGST, IGST)
  const handleTaxOptionChange = (option) => {
    setInvoiceForm((prev) => {
      let updatedTaxPercent = prev.taxPercent;
      if (option !== 'no_tax' && (prev.taxPercent === 0 || !prev.taxPercent)) {
        updatedTaxPercent = 18;
      }
      return {
        ...prev,
        taxOption: option,
        taxOptionOverridden: true,
        taxPercent: updatedTaxPercent
      };
    });
  };

  // Customer State change handler
  const handleCustomerStateChange = (newState) => {
    setInvoiceForm((prev) => {
      let updatedTaxOption = prev.taxOption;
      if (!prev.taxOptionOverridden) {
        if (prev.invoiceType === 'proforma_invoice') {
          updatedTaxOption = 'no_tax';
        } else {
          const compState = (settings.state || 'Gujarat').trim().toLowerCase();
          const custState = (newState || '').trim().toLowerCase();
          const isIntra = !custState || compState === custState;
          updatedTaxOption = isIntra ? 'cgst_sgst' : 'igst';
        }
      }
      return {
        ...prev,
        customerState: newState,
        taxOption: updatedTaxOption
      };
    });
    clearError('customerState');
  };

  // GST State Detection & Tax Option Handling
  const isIntraState = useMemo(() => {
    if (invoiceForm.taxOption === 'cgst_sgst') return true;
    if (invoiceForm.taxOption === 'igst') return false;
    const compState = (settings.state || 'Gujarat').trim().toLowerCase();
    const custState = (invoiceForm.customerState || '').trim().toLowerCase();
    if (!custState) return true; // default same state
    return compState === custState;
  }, [settings.state, invoiceForm.customerState, invoiceForm.taxOption]);

  const taxOption = invoiceForm.taxOption || (invoiceForm.invoiceType === 'proforma_invoice' ? 'no_tax' : (isIntraState ? 'cgst_sgst' : 'igst'));
  const isNoTax = taxOption === 'no_tax';

  const gstType = isNoTax ? 'no_tax' : (taxOption === 'igst' ? 'inter_state' : 'intra_state');

  // Item Calculations
  const itemsSubtotal = useMemo(() => {
    return invoiceForm.items.reduce((acc, item) => acc + (Number(item.amount) || 0), 0);
  }, [invoiceForm.items]);

  const totalItemDiscount = useMemo(() => {
    return invoiceForm.items.reduce((acc, item) => {
      const qty = Number(item.quantity) || 0;
      const disc = Number(item.discountPerUnit) || 0;
      return acc + (qty * disc);
    }, 0);
  }, [invoiceForm.items]);

  const overallDiscount = Number(invoiceForm.discount) || 0;
  const taxableAmount = useMemo(() => {
    return Math.max(0, itemsSubtotal - overallDiscount);
  }, [itemsSubtotal, overallDiscount]);

  const taxPercent = isNoTax ? 0 : (Number(invoiceForm.taxPercent) || 0);

  const totalTaxAmount = useMemo(() => {
    if (isNoTax) return 0;
    return (taxableAmount * taxPercent) / 100;
  }, [isNoTax, taxableAmount, taxPercent]);

  // Tax Breakdown (CGST+SGST vs IGST vs No Tax)
  const taxBreakdown = useMemo(() => {
    if (isNoTax) {
      return {
        type: 'no_tax',
        label: 'No Tax (0% / Exempt)',
        cgstRate: 0,
        cgstAmount: 0,
        sgstRate: 0,
        sgstAmount: 0,
        igstRate: 0,
        igstAmount: 0
      };
    }

    if (taxOption === 'cgst_sgst' || (taxOption !== 'igst' && isIntraState)) {
      const halfRate = taxPercent / 2;
      const halfAmt = (taxableAmount * halfRate) / 100;
      return {
        type: 'intra_state',
        label: 'Intra-State (CGST + SGST)',
        cgstRate: halfRate,
        cgstAmount: halfAmt,
        sgstRate: halfRate,
        sgstAmount: halfAmt,
        igstRate: 0,
        igstAmount: 0
      };
    } else {
      return {
        type: 'inter_state',
        label: 'Inter-State (IGST)',
        cgstRate: 0,
        cgstAmount: 0,
        sgstRate: 0,
        sgstAmount: 0,
        igstRate: taxPercent,
        igstAmount: totalTaxAmount
      };
    }
  }, [isNoTax, taxOption, isIntraState, taxPercent, taxableAmount, totalTaxAmount]);

  // Round off calculation
  const unroundedTotal = taxableAmount + totalTaxAmount;
  const roundedGrandTotal = Math.round(unroundedTotal);
  const roundOffAmount = Number((roundedGrandTotal - unroundedTotal).toFixed(2));

  // Amount in Words (Indian Currency Standard)
  const amountInWords = useMemo(() => {
    if (selectedInvoiceForView?.amountInWords) {
      return selectedInvoiceForView.amountInWords;
    }
    return convertNumberToWords(roundedGrandTotal);
  }, [selectedInvoiceForView, roundedGrandTotal]);

  // Active Bank Details (Primary vs Other Account based on paymentMode)
  const activeBankDetails = useMemo(() => {
    if (invoiceForm.paymentMode === 'other_account') {
      const list = settings.otherAccounts || [];
      const selected = list.find((acc) => acc.id === invoiceForm.selectedOtherAccountId) || list[0];
      if (selected) {
        return {
          bankName: selected.bankName || '',
          accountHolder: selected.accountHolder || '',
          accountNumber: selected.accountNumber || '',
          ifscCode: selected.ifscCode || '',
          branch: selected.branch || '',
          upiId: selected.upiId || '',
          accountTitle: selected.accountTitle || selected.bankName || 'Other Account'
        };
      }
      if (selectedInvoiceForView?.bankSnapshot?.bankName) {
        return selectedInvoiceForView.bankSnapshot;
      }
    }

    if (selectedInvoiceForView?.bankSnapshot?.bankName && invoiceForm.paymentMode !== 'other_account') {
      return selectedInvoiceForView.bankSnapshot;
    }

    return {
      bankName: settings.bankName || '',
      accountHolder: settings.accountHolder || '',
      accountNumber: settings.accountNumber || '',
      ifscCode: settings.ifscCode || '',
      branch: settings.branch || '',
      upiId: settings.upiId || '',
      accountTitle: 'Primary Bank Account'
    };
  }, [
    selectedInvoiceForView,
    invoiceForm.paymentMode,
    invoiceForm.selectedOtherAccountId,
    settings.otherAccounts,
    settings.bankName,
    settings.accountHolder,
    settings.accountNumber,
    settings.ifscCode,
    settings.branch,
    settings.upiId
  ]);

  // Line item handlers
  const handleItemChange = (index, field, value) => {
    setInvoiceForm((prev) => {
      const newItems = [...prev.items];
      newItems[index] = { ...newItems[index], [field]: value };
      const qty = Math.max(0, Number(newItems[index].quantity) || 0);
      const price = Math.max(0, Number(newItems[index].unitPrice) || 0);
      const discPerUnit = Math.max(0, Number(newItems[index].discountPerUnit) || 0);
      
      const netPrice = Math.max(0, price - discPerUnit);
      newItems[index].totalDiscount = discPerUnit * qty;
      newItems[index].amount = netPrice * qty;
      return { ...prev, items: newItems };
    });
  };

  const handleAddItem = () => {
    setInvoiceForm((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        { 
          description: 'New Service Item', 
          hsnSac: '998313', 
          quantity: 1, 
          unitPrice: 1000, 
          discountPerUnit: 0, 
          totalDiscount: 0, 
          amount: 1000 
        }
      ]
    }));
    clearError('items');
  };

  const handleRemoveItem = (index) => {
    if (invoiceForm.items.length <= 1) {
      toast.error('Invoice must have at least one item');
      return;
    }
    setInvoiceForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
    // Clean up or shift error keys
    setErrors((prev) => {
      const copy = {};
      Object.keys(prev).forEach((key) => {
        if (!key.startsWith('item_')) {
          copy[key] = prev[key];
        } else {
          const match = key.match(/^item_(\d+)_(.+)$/);
          if (match) {
            const itemIdx = parseInt(match[1]);
            const field = match[2];
            if (itemIdx < index) {
              copy[key] = prev[key];
            } else if (itemIdx > index) {
              copy[`item_${itemIdx - 1}_${field}`] = prev[key];
            }
          }
        }
      });
      return copy;
    });
  };

  // Save Settings
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const { data } = await api.put('/invoices/settings', settings);
      if (data.success) {
        toast.success('Company profile & bank details saved successfully!');
        setSettings(data.data.settings);
        // Synchronize default terms and notes into current invoice form state!
        setInvoiceForm((prev) => ({
          ...prev,
          terms: data.data.settings.defaultTerms || prev.terms,
          notes: data.data.settings.defaultNotes || prev.notes
        }));
      }
    } catch (err) {
      toast.error('Failed to save settings');
    } finally {
      setSavingSettings(false);
    }
  };

  // Create & Save Invoice (With option to download PDF immediately)
  const handleCreateInvoice = async (e, andDownloadPdf = false) => {
    if (e) e.preventDefault();

    // 1. Run Comprehensive Form Validation
    const validationErrors = validateInvoiceForm();
    if (Object.keys(validationErrors).length > 0) {
      toast.error('Please fill all required fields marked in red');
      const firstKey = Object.keys(validationErrors)[0];
      const el = document.getElementById(`field-${firstKey}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.focus();
      }
      return;
    }

    setGenerating(true);
    try {
      const payload = {
        ...invoiceForm,
        dueDays: Number(invoiceForm.dueDays) || 15,
        subtotal: itemsSubtotal,
        totalItemDiscount,
        discount: overallDiscount,
        taxableAmount,
        gstType: isNoTax ? 'no_tax' : gstType,
        taxOption,
        taxPercent: isNoTax ? 0 : taxPercent,
        taxAmount: totalTaxAmount,
        cgstRate: taxBreakdown.cgstRate,
        cgstAmount: taxBreakdown.cgstAmount,
        sgstRate: taxBreakdown.sgstRate,
        sgstAmount: taxBreakdown.sgstAmount,
        igstRate: taxBreakdown.igstRate,
        igstAmount: taxBreakdown.igstAmount,
        unroundedTotal,
        roundOffAmount,
        grandTotal: roundedGrandTotal,
        amountInWords,
        companyState: settings.state,
        companySnapshot: {
          companyName: settings.companyName,
          tagline: settings.tagline,
          logo: settings.logo,
          address: settings.address,
          city: settings.city,
          state: settings.state,
          country: settings.country,
          pincode: settings.pincode,
          contactEmail: settings.contactEmail,
          contactNumber: settings.contactNumber,
          website: settings.website,
          gstin: settings.gstin,
          pan: settings.pan
        },
        bankSnapshot: {
          bankName: activeBankDetails.bankName,
          accountHolder: activeBankDetails.accountHolder,
          accountNumber: activeBankDetails.accountNumber,
          ifscCode: activeBankDetails.ifscCode,
          branch: activeBankDetails.branch,
          upiId: activeBankDetails.upiId,
          accountTitle: activeBankDetails.accountTitle || ''
        }
      };

      const { data } = await api.post('/invoices', payload);
      if (data.success) {
        toast.success(`Invoice ${invoiceForm.invoiceNumber} generated & saved!`);
        fetchInvoices();
        fetchSettings();
        setSelectedInvoiceForView(data.data.invoice);
        
        if (andDownloadPdf) {
          toast.success('Opening Save as PDF / Print dialog...');
          setTimeout(() => {
            triggerPrintCleanly();
          }, 350);
        } else {
          setActiveTab('history');
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to generate invoice');
    } finally {
      setGenerating(false);
    }
  };

  // Quick Status Update
  const handleUpdateInvoiceStatus = async (invId, newStatus) => {
    try {
      const { data } = await api.put(`/invoices/${invId}/status`, { status: newStatus });
      if (data.success) {
        toast.success(`Invoice status updated to ${newStatus}`);
        setInvoices((prev) => prev.map((inv) => (inv._id === invId ? data.data.invoice : inv)));
      }
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  // Delete Invoice
  const handleDeleteInvoice = async (invId) => {
    if (!confirm('Are you sure you want to delete this invoice?')) return;
    try {
      const { data } = await api.delete(`/invoices/${invId}`);
      if (data.success) {
        toast.success('Invoice deleted');
        setInvoices((prev) => prev.filter((i) => i._id !== invId));
        if (selectedInvoiceForView?._id === invId) setSelectedInvoiceForView(null);
      }
    } catch (err) {
      toast.error('Failed to delete invoice');
    }
  };

  // Print Invoice helper that clears document title so browser headers/footers stay empty
  const triggerPrintCleanly = () => {
    const origTitle = document.title;
    document.title = '';
    window.print();
    setTimeout(() => {
      document.title = origTitle;
    }, 1000);
  };

  // Print Invoice handler
  const handlePrint = () => {
    triggerPrintCleanly();
  };

  // Load and Print existing Invoice from History
  const handlePrintHistoryInvoice = (inv) => {
    setSelectedInvoiceForView(inv);
    const resolvedTaxOpt = inv.taxOption || (inv.taxPercent > 0 ? (inv.gstType === 'inter_state' ? 'igst' : 'cgst_sgst') : 'no_tax');
    setInvoiceForm({
      invoiceNumber: inv.invoiceNumber,
      invoiceType: inv.invoiceType || 'tax_invoice',
      paymentMode: inv.paymentMode || 'current_account',
      selectedOtherAccountId: inv.selectedOtherAccountId || '',
      invoiceDate: inv.invoiceDate?.split('T')[0] || '',
      dueDays: inv.dueDays || 15,
      dueDate: inv.dueDate?.split('T')[0] || '',
      customerId: inv.customerId || '',
      customerName: inv.customerName,
      customerPhone: inv.customerPhone,
      customerEmail: inv.customerEmail,
      customerCity: inv.customerCity,
      customerState: inv.customerState || settings.state || 'Gujarat',
      customerAddress: inv.customerAddress,
      customerGstin: inv.customerGstin,
      taxOption: resolvedTaxOpt,
      taxOptionOverridden: true,
      items: inv.items?.map((it) => ({
        description: it.description,
        hsnSac: it.hsnSac || '',
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        discountPerUnit: it.discountPerUnit || 0,
        totalDiscount: it.totalDiscount || 0,
        amount: it.amount
      })) || [],
      taxPercent: inv.taxPercent || 0,
      discount: inv.discount || 0,
      notes: inv.notes || '',
      terms: inv.terms || settings.defaultTerms || ''
    });
    setActiveTab('generate');
    toast.success(`Loaded invoice ${inv.invoiceNumber} for printing`);
    setTimeout(() => {
      triggerPrintCleanly();
    }, 400);
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in max-w-7xl mx-auto print:p-0 print:m-0 print:max-w-full print:w-full print:space-y-0">
      
      {/* Global Print Style: Eliminates outer whitespace and makes #printable-invoice match preview width on A4 */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            size: A4 portrait;
            margin: 0mm !important; /* Suppresses browser default header (date, title) & footer (URL, 1/1) */
          }

          /* Reset root and body to full width without margins */
          html, body {
            width: 100% !important;
            min-width: 100% !important;
            height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            overflow: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Disable all animations, transitions, and transforms that can break layout or trap elements */
          *, *::before, *::after {
            animation: none !important;
            transition: none !important;
            transform: none !important;
            filter: none !important;
            backdrop-filter: none !important;
            box-shadow: none !important;
          }

          /* Hide all non-printable UI: Sidebar, Header, Modals, Left Form, Buttons */
          nav, aside, header, button, .no-print, [role="status"] {
            display: none !important;
          }

          /* Reset all parent containers of #printable-invoice to full-width block */
          body,
          main,
          .max-w-7xl,
          .mx-auto,
          .space-y-6,
          .p-6,
          .p-4, .sm\\:p-6, .lg\\:p-8,
          .flex-1,
          .overflow-y-auto,
          .grid,
          .lg\\:grid-cols-12,
          .lg\\:col-span-6,
          .sticky {
            display: block !important;
            position: static !important;
            width: 100% !important;
            max-width: 100% !important;
            min-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            overflow: visible !important;
            box-shadow: none !important;
          }

          /* Hide everything except #printable-invoice */
          body * {
            visibility: hidden;
          }

          #printable-invoice,
          #printable-invoice * {
            visibility: visible !important;
          }

          /* Printable invoice document formatting: full-width, clean padding matching preview without browser headers/footers */
          #printable-invoice {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            min-width: 100% !important;
            box-sizing: border-box !important;
            margin: 0 !important;
            padding: 12mm 15mm !important;
            border: none !important;
            border-radius: 0 !important;
            box-shadow: none !important;
            background: #ffffff !important;
            color: #0f172a !important;
            min-height: auto !important;
          }
        }
      `}} />

      {/* Header section with Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-wa-border dark:border-wa-dark-border pb-4 no-print">
        <div>
          <h2 className="text-xl font-bold text-wa-text-primary dark:text-wa-dark-text-primary flex items-center gap-2">
            <Receipt className="w-5 h-5 text-wa-green animate-pulse" /> Invoice & Billing Management
          </h2>
          <p className="text-sm text-wa-text-secondary dark:text-wa-dark-text-secondary mt-0.5">
            Configure company branding, bank details, auto-fetch customer info, and generate GST-compliant invoices.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center p-1 bg-wa-panel-header dark:bg-wa-dark-panel-header border border-wa-border dark:border-wa-dark-border rounded-xl shadow-xs">
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-white dark:bg-wa-dark-panel text-wa-green shadow-xs'
                : 'text-wa-text-secondary hover:text-wa-text-primary dark:hover:text-white'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Company & Bank</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('generate')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 cursor-pointer ${
              activeTab === 'generate'
                ? 'bg-white dark:bg-wa-dark-panel text-wa-green shadow-xs'
                : 'text-wa-text-secondary hover:text-wa-text-primary dark:hover:text-white'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Invoice</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 cursor-pointer ${
              activeTab === 'history'
                ? 'bg-white dark:bg-wa-dark-panel text-wa-green shadow-xs'
                : 'text-wa-text-secondary hover:text-wa-text-primary dark:hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Invoices ({invoices.length})</span>
          </button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* TAB 1: COMPANY BRANDING & BANK DETAILS (INVOICE SETTINGS)       */}
      {/* ============================================================== */}
      {activeTab === 'settings' && (
        <form onSubmit={handleSaveSettings} className="space-y-6 no-print">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* 1. Company Profile Card */}
            <div className="glass-card p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-wa-border dark:border-wa-dark-border">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-wa-green/10 text-wa-green rounded-xl">
                    <Building2 className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-wa-text-primary dark:text-white">Business Branding & Details</h3>
                    <p className="text-[10px] text-wa-text-secondary">Printed on top header of every invoice</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3.5">
                {/* Logo Image Direct Selection */}
                <div>
                  <label className="block text-[10px] font-bold text-wa-text-secondary uppercase mb-1">Company Logo (Direct Image Upload)</label>
                  <input
                    type="file"
                    ref={logoFileInputRef}
                    onChange={handleLogoFileSelect}
                    accept="image/*"
                    className="hidden"
                  />

                  {settings.logo ? (
                    <div className="flex items-center gap-3 p-3 rounded-xl border border-wa-border dark:border-wa-dark-border bg-slate-50 dark:bg-wa-dark-header/40">
                      <div className="w-16 h-12 bg-white rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center p-1 overflow-hidden shrink-0">
                        <img src={settings.logo} alt="Company Logo" className="max-h-full max-w-full object-contain" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-wa-text-primary dark:text-white truncate">Logo Uploaded</p>
                        <p className="text-[10px] text-wa-text-secondary">Appears on top of printable invoice</p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => logoFileInputRef.current?.click()}
                          disabled={uploadingLogo}
                          className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-wa-border dark:border-wa-dark-border hover:bg-wa-hover dark:hover:bg-wa-dark-hover transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          {uploadingLogo ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                          Change
                        </button>
                        <button
                          type="button"
                          onClick={handleRemoveLogo}
                          className="p-1 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                          title="Remove Logo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => logoFileInputRef.current?.click()}
                      className="border-2 border-dashed border-wa-border dark:border-wa-dark-border hover:border-wa-green/60 p-4 rounded-xl text-center cursor-pointer hover:bg-wa-hover/40 dark:hover:bg-wa-dark-hover/20 transition-all flex flex-col items-center justify-center gap-1.5"
                    >
                      <div className="p-2 rounded-full bg-wa-green/10 text-wa-green">
                        {uploadingLogo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      </div>
                      <div>
                        <span className="text-xs font-bold text-wa-green">Click to select Logo Image</span>
                        <p className="text-[10px] text-wa-text-secondary mt-0.5">PNG, JPG, WebP, or SVG (Max 5MB)</p>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-wa-text-secondary uppercase mb-1">Company / Business Name *</label>
                  <input
                    type="text"
                    required
                    value={settings.companyName}
                    onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
                    className="input-field py-2 text-xs font-semibold"
                    placeholder="e.g. HK Digiverse Pvt Ltd"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-wa-text-secondary uppercase mb-1">Tagline / Subtitle</label>
                    <input
                      type="text"
                      value={settings.tagline}
                      onChange={(e) => setSettings({ ...settings, tagline: e.target.value })}
                      className="input-field py-2 text-xs"
                      placeholder="e.g. AI Automation & Web Solutions"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-wa-text-secondary uppercase mb-1">Website URL</label>
                    <input
                      type="text"
                      value={settings.website}
                      onChange={(e) => setSettings({ ...settings, website: e.target.value })}
                      className="input-field py-2 text-xs"
                      placeholder="https://hkdigiverse.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-wa-text-secondary uppercase mb-1">Street Address</label>
                  <input
                    type="text"
                    value={settings.address}
                    onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                    className="input-field py-2 text-xs"
                    placeholder="e.g. 402, Titanium Business Hub, Dumas Road"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-wa-text-secondary uppercase mb-1">City</label>
                    <input
                      type="text"
                      value={settings.city}
                      onChange={(e) => setSettings({ ...settings, city: e.target.value })}
                      className="input-field py-2 text-xs"
                      placeholder="Surat"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-wa-text-secondary uppercase mb-1">State (Supply Origin)</label>
                    <select
                      value={settings.state}
                      onChange={(e) => setSettings({ ...settings, state: e.target.value })}
                      className="input-field py-2 text-xs font-semibold"
                    >
                      {INDIAN_STATES.map((st) => (
                        <option key={st} value={st}>{st}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-wa-text-secondary uppercase mb-1">Pincode</label>
                    <input
                      type="text"
                      value={settings.pincode}
                      onChange={(e) => setSettings({ ...settings, pincode: e.target.value })}
                      className="input-field py-2 text-xs font-mono"
                      placeholder="395007"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-wa-text-secondary uppercase mb-1">Contact Email</label>
                    <input
                      type="email"
                      value={settings.contactEmail}
                      onChange={(e) => setSettings({ ...settings, contactEmail: e.target.value })}
                      className="input-field py-2 text-xs"
                      placeholder="billing@hkdigiverse.com"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-wa-text-secondary uppercase mb-1">Contact Phone</label>
                    <input
                      type="text"
                      value={settings.contactNumber}
                      onChange={(e) => setSettings({ ...settings, contactNumber: e.target.value })}
                      className="input-field py-2 text-xs font-mono"
                      placeholder="+91 98765 43210"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-wa-text-secondary uppercase mb-1">Company GSTIN</label>
                    <input
                      type="text"
                      value={settings.gstin}
                      onChange={(e) => setSettings({ ...settings, gstin: e.target.value.toUpperCase() })}
                      className="input-field py-2 text-xs font-mono uppercase"
                      placeholder="24AAAAA0000A1Z5"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-wa-text-secondary uppercase mb-1">Company PAN</label>
                    <input
                      type="text"
                      value={settings.pan}
                      onChange={(e) => setSettings({ ...settings, pan: e.target.value.toUpperCase() })}
                      className="input-field py-2 text-xs font-mono uppercase"
                      placeholder="ABCDE1234F"
                    />
                  </div>
                </div>

              </div>
            </div>

            {/* 2. Bank Details & Payment Defaults Card */}
            <div className="glass-card p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-wa-border dark:border-wa-dark-border">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-blue-500/10 text-blue-500 rounded-xl">
                    <Landmark className="w-4.5 h-4.5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-wa-text-primary dark:text-white">Bank Details & Invoice Rules</h3>
                    <p className="text-[10px] text-wa-text-secondary">Printed on invoice for direct bank transfer</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3.5">
                <div>
                  <label className="block text-[10px] font-bold text-wa-text-secondary uppercase mb-1">Bank Name</label>
                  <input
                    type="text"
                    value={settings.bankName}
                    onChange={(e) => setSettings({ ...settings, bankName: e.target.value })}
                    className="input-field py-2 text-xs font-semibold"
                    placeholder="e.g. HDFC Bank Ltd"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-wa-text-secondary uppercase mb-1">Account Holder Name</label>
                  <input
                    type="text"
                    value={settings.accountHolder}
                    onChange={(e) => setSettings({ ...settings, accountHolder: e.target.value })}
                    className="input-field py-2 text-xs"
                    placeholder="HK Digiverse Private Limited"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-wa-text-secondary uppercase mb-1">Account Number</label>
                    <input
                      type="text"
                      value={settings.accountNumber}
                      onChange={(e) => setSettings({ ...settings, accountNumber: e.target.value })}
                      className="input-field py-2 text-xs font-mono font-bold"
                      placeholder="50200012345678"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-wa-text-secondary uppercase mb-1">IFSC Code</label>
                    <input
                      type="text"
                      value={settings.ifscCode}
                      onChange={(e) => setSettings({ ...settings, ifscCode: e.target.value.toUpperCase() })}
                      className="input-field py-2 text-xs font-mono font-bold uppercase"
                      placeholder="HDFC0001234"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-wa-text-secondary uppercase mb-1">Branch Name</label>
                    <input
                      type="text"
                      value={settings.branch}
                      onChange={(e) => setSettings({ ...settings, branch: e.target.value })}
                      className="input-field py-2 text-xs"
                      placeholder="Vesu Branch, Surat"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-wa-text-secondary uppercase mb-1">UPI ID (VPA)</label>
                    <input
                      type="text"
                      value={settings.upiId}
                      onChange={(e) => setSettings({ ...settings, upiId: e.target.value })}
                      className="input-field py-2 text-xs font-mono text-wa-green font-semibold"
                      placeholder="hkdigiverse@okhdfcbank"
                    />
                  </div>
                </div>

                <div className="h-px bg-wa-border dark:bg-wa-dark-border opacity-50 my-2" />

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-wa-text-secondary uppercase mb-1">Invoice Prefix</label>
                    <input
                      type="text"
                      value={settings.invoicePrefix}
                      onChange={(e) => setSettings({ ...settings, invoicePrefix: e.target.value })}
                      className="input-field py-2 text-xs font-mono"
                      placeholder="INV-"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-wa-text-secondary uppercase mb-1">Next Number</label>
                    <input
                      type="number"
                      value={settings.nextInvoiceNumber}
                      onChange={(e) => setSettings({ ...settings, nextInvoiceNumber: parseInt(e.target.value) || 1001 })}
                      className="input-field py-2 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-wa-text-secondary uppercase mb-1">Default Due Days</label>
                    <input
                      type="number"
                      min="0"
                      value={settings.defaultDueDays || 15}
                      onChange={(e) => {
                        const d = parseInt(e.target.value) || 0;
                        setSettings({ 
                          ...settings, 
                          defaultDueDays: d
                        });
                      }}
                      className="input-field py-2 text-xs font-mono font-bold"
                      placeholder="15"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-wa-text-secondary uppercase mb-1">Default Terms & Conditions</label>
                  <textarea
                    rows="3"
                    value={settings.defaultTerms}
                    onChange={(e) => setSettings({ ...settings, defaultTerms: e.target.value })}
                    className="input-field py-1.5 text-xs font-mono"
                    placeholder="1. Payment is due within 15 days of the invoice date.&#10;2. Late payments may incur additional charges.&#10;3. All disputes are subject to Gujarat Jurisdiction."
                  />
                  <p className="text-[10px] text-wa-text-secondary mt-1">
                    Press Enter to add numbered lines. Each line appears cleanly on the printed invoice.
                  </p>
                </div>
              </div>
            </div>

          </div>

          {/* 3. Other Bank Accounts Section */}
          <div className="glass-card p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-wa-border dark:border-wa-dark-border">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-xl">
                  <CreditCard className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-wa-text-primary dark:text-white flex items-center gap-2">
                    Other Bank Accounts (Alternate / Proforma)
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-wa-border dark:bg-wa-dark-border text-wa-text-secondary font-mono">
                      {settings.otherAccounts?.length || 0}
                    </span>
                  </h3>
                  <p className="text-[10px] text-wa-text-secondary">
                    Add multiple bank accounts. When you select &quot;Other Account&quot; in Proforma Invoice, details of the selected account will be fetched and printed on the invoice.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleOpenAddOtherAccount}
                className="btn-secondary px-3.5 py-1.5 text-xs font-bold flex items-center gap-1.5 text-wa-green border-wa-green/30 hover:bg-wa-green/10 self-start sm:self-auto cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Other Account
              </button>
            </div>

            {(!settings.otherAccounts || settings.otherAccounts.length === 0) ? (
              <div className="text-center py-8 border-2 border-dashed border-wa-border dark:border-wa-dark-border rounded-xl">
                <Landmark className="w-8 h-8 text-wa-text-secondary/40 mx-auto mb-2" />
                <p className="text-xs font-semibold text-wa-text-secondary">No other bank accounts added yet</p>
                <p className="text-[11px] text-wa-text-secondary/70 mt-1 max-w-md mx-auto">
                  Click &quot;Add Other Account&quot; above to configure alternate or personal bank accounts for proforma billing.
                </p>
                <button
                  type="button"
                  onClick={handleOpenAddOtherAccount}
                  className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-wa-green text-white text-xs font-bold hover:bg-wa-green-dark cursor-pointer transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add First Account
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {settings.otherAccounts.map((acc, idx) => (
                  <div
                    key={acc.id || idx}
                    className="p-3.5 rounded-xl border border-wa-border dark:border-wa-dark-border bg-wa-panel/40 dark:bg-wa-dark-panel/40 hover:border-wa-green/40 transition-all flex flex-col justify-between space-y-3"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-500/10 text-blue-500">
                          {acc.accountTitle || `Account #${idx + 1}`}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            title="Edit Account"
                            onClick={() => handleOpenEditOtherAccount(acc)}
                            className="p-1 rounded text-wa-text-secondary hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            title="Delete Account"
                            onClick={() => handleDeleteOtherAccount(acc.id)}
                            className="p-1 rounded text-wa-text-secondary hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 cursor-pointer transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="mt-2 text-xs font-bold text-wa-text-primary dark:text-white">
                        {acc.bankName}
                      </div>
                      {acc.accountHolder && (
                        <div className="text-[11px] text-wa-text-secondary">
                          {acc.accountHolder}
                        </div>
                      )}
                    </div>

                    <div className="space-y-1 pt-2 border-t border-wa-border/50 dark:border-wa-dark-border/50 font-mono text-[10px]">
                      <div className="text-wa-text-primary dark:text-white font-semibold">
                        A/C: {acc.accountNumber || '-'}
                      </div>
                      <div className="text-wa-text-secondary">
                        IFSC: {acc.ifscCode || '-'}
                      </div>
                      {acc.branch && (
                        <div className="text-wa-text-secondary font-sans truncate">
                          Branch: {acc.branch}
                        </div>
                      )}
                      {acc.upiId && (
                        <div className="text-wa-green font-semibold">
                          UPI: {acc.upiId}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingSettings}
              className="btn-primary px-6 py-2.5 flex items-center gap-2 text-xs font-bold shadow-md shadow-wa-green/20 cursor-pointer"
            >
              {savingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Company & Bank Settings
            </button>
          </div>
        </form>
      )}

      {/* ============================================================== */}
      {/* TAB 2: CREATE INVOICE (DYNAMIC CUSTOMER AUTO-FETCH + PREVIEW)   */}
      {/* ============================================================== */}
      {activeTab === 'generate' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start print:block print:w-full print:m-0 print:p-0">
          
          {/* Left Column: Invoice Form (6 cols) */}
          <form onSubmit={(e) => handleCreateInvoice(e, false)} className="lg:col-span-6 space-y-5 no-print">
            
            {/* Warning Banner if Company Profile is Incomplete */}
            {!settings.companyName?.trim() && (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-500" />
                  <div>
                    <p className="font-bold">Company Profile Incomplete</p>
                    <p className="text-[11px] opacity-90">Please configure your Company Name & Bank Details in Settings so they print properly on your invoices.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('settings')}
                  className="px-3 py-1 bg-amber-500 text-white rounded-lg text-[11px] font-bold hover:bg-amber-600 transition-colors flex-shrink-0 cursor-pointer"
                >
                  Configure
                </button>
              </div>
            )}

            {/* Invoice Meta Configuration Card */}
            <div className="glass-card p-5 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-wa-border dark:border-wa-dark-border">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-wa-green/10 text-wa-green rounded-lg">
                    <Receipt className="w-4 h-4" />
                  </div>
                  <h3 className="text-xs font-bold text-wa-text-primary dark:text-white uppercase tracking-wider">
                    Invoice Type & Payment Details
                  </h3>
                </div>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-wa-green/15 text-wa-green">
                  {invoiceForm.invoiceNumber}
                </span>
              </div>

              {/* Row 1: Invoice Type & Payment Mode */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-wa-text-secondary uppercase mb-1">
                    Invoice Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={invoiceForm.invoiceType}
                    onChange={(e) => handleInvoiceTypeChange(e.target.value)}
                    className="input-field py-2 text-xs font-bold cursor-pointer"
                  >
                    <option value="tax_invoice">🧾 Tax Invoice</option>
                    <option value="proforma_invoice">📄 Proforma Invoice</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-wa-text-secondary uppercase mb-1">
                    Payment Mode <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={invoiceForm.paymentMode}
                    onChange={(e) => {
                      const mode = e.target.value;
                      setInvoiceForm((prev) => ({
                        ...prev,
                        paymentMode: mode,
                        selectedOtherAccountId: mode === 'other_account' && !prev.selectedOtherAccountId
                          ? (settings.otherAccounts?.[0]?.id || '')
                          : prev.selectedOtherAccountId
                      }));
                    }}
                    className="input-field py-2 text-xs font-semibold cursor-pointer"
                  >
                    {invoiceForm.invoiceType === 'tax_invoice' ? (
                      <>
                        <option value="current_account">🏦 Current Account</option>
                        <option value="cash_with_gst">💵 Cash with GST</option>
                      </>
                    ) : (
                      <>
                        <option value="cash">💵 Cash</option>
                        <option value="other_account">🏛️ Other Account</option>
                      </>
                    )}
                  </select>
                </div>

                {/* If Other Account is selected, show Select Other Account dropdown & preview */}
                {invoiceForm.paymentMode === 'other_account' && (
                  <div className="col-span-2 animate-fade-in p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="block text-[10px] font-bold text-blue-700 dark:text-blue-300 uppercase">
                        Select Other Bank Account <span className="text-red-500">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={handleOpenAddOtherAccount}
                        className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add New Account
                      </button>
                    </div>

                    {(!settings.otherAccounts || settings.otherAccounts.length === 0) ? (
                      <div className="flex items-center justify-between p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs">
                        <span>No other bank accounts configured yet.</span>
                        <button
                          type="button"
                          onClick={handleOpenAddOtherAccount}
                          className="px-2.5 py-1 rounded bg-amber-500 text-white text-[11px] font-bold cursor-pointer hover:bg-amber-600 transition-all"
                        >
                          + Add Account Now
                        </button>
                      </div>
                    ) : (
                      <>
                        <select
                          value={invoiceForm.selectedOtherAccountId || settings.otherAccounts[0]?.id || ''}
                          onChange={(e) => {
                            setInvoiceForm((prev) => ({
                              ...prev,
                              selectedOtherAccountId: e.target.value
                            }));
                          }}
                          className="input-field py-2 text-xs font-bold cursor-pointer bg-white dark:bg-slate-900 border-blue-300 dark:border-blue-800"
                        >
                          {settings.otherAccounts.map((acc) => (
                            <option key={acc.id} value={acc.id}>
                              {acc.accountTitle || acc.bankName} — {acc.bankName} (A/C: {acc.accountNumber || '-'})
                            </option>
                          ))}
                        </select>

                        {/* Quick Bank Details Badge */}
                        {activeBankDetails && activeBankDetails.bankName && (
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px] text-slate-700 dark:text-slate-300">
                            <div>
                              <span className="text-[9px] uppercase font-bold text-slate-400 block">Bank</span>
                              <span className="font-semibold truncate block">{activeBankDetails.bankName}</span>
                            </div>
                            <div>
                              <span className="text-[9px] uppercase font-bold text-slate-400 block">A/C Number</span>
                              <span className="font-mono font-bold truncate block">{activeBankDetails.accountNumber || '-'}</span>
                            </div>
                            <div>
                              <span className="text-[9px] uppercase font-bold text-slate-400 block">IFSC</span>
                              <span className="font-mono font-bold uppercase truncate block">{activeBankDetails.ifscCode || '-'}</span>
                            </div>
                            <div>
                              <span className="text-[9px] uppercase font-bold text-slate-400 block">Branch / Holder</span>
                              <span className="truncate block">{activeBankDetails.branch || activeBankDetails.accountHolder || '-'}</span>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Row 2: Invoice No, Invoice Date, Due Days & Due Date as regular form fields */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-wa-text-secondary uppercase mb-1">
                    Invoice No. <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="field-invoiceNumber"
                    type="text"
                    value={invoiceForm.invoiceNumber}
                    onChange={(e) => {
                      setInvoiceForm({ ...invoiceForm, invoiceNumber: e.target.value });
                      clearError('invoiceNumber');
                    }}
                    className={`input-field py-1.5 text-xs font-mono font-bold ${
                      errors.invoiceNumber ? 'border-red-500 bg-red-50/10 focus:ring-red-500/20' : ''
                    }`}
                    placeholder="INV-1001"
                  />
                  {errors.invoiceNumber && (
                    <p className="text-[11px] text-red-500 mt-1 flex items-center gap-1 font-medium">
                      <AlertCircle className="w-3 h-3 flex-shrink-0" />
                      {errors.invoiceNumber}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-wa-text-secondary uppercase mb-1">
                    Invoice Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="field-invoiceDate"
                    type="date"
                    value={invoiceForm.invoiceDate}
                    onChange={(e) => {
                      handleInvoiceDateChange(e.target.value);
                      clearError('invoiceDate');
                      clearError('dueDate');
                    }}
                    className={`input-field py-1.5 text-xs font-medium ${
                      errors.invoiceDate ? 'border-red-500 bg-red-50/10 focus:ring-red-500/20' : ''
                    }`}
                  />
                  {errors.invoiceDate && (
                    <p className="text-[11px] text-red-500 mt-1 flex items-center gap-1 font-medium">
                      <AlertCircle className="w-3 h-3 flex-shrink-0" />
                      {errors.invoiceDate}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-wa-text-secondary uppercase mb-1">
                    Due in (Days) <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="field-dueDays"
                    type="number"
                    min="0"
                    value={invoiceForm.dueDays}
                    onChange={(e) => {
                      handleDueDaysChange(e.target.value);
                      clearError('dueDays');
                      clearError('dueDate');
                    }}
                    className={`input-field py-1.5 text-xs font-mono font-bold ${
                      errors.dueDays ? 'border-red-500 bg-red-50/10 focus:ring-red-500/20' : ''
                    }`}
                    placeholder="15"
                  />
                  {errors.dueDays && (
                    <p className="text-[11px] text-red-500 mt-1 flex items-center gap-1 font-medium">
                      <AlertCircle className="w-3 h-3 flex-shrink-0" />
                      {errors.dueDays}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-wa-text-secondary uppercase mb-1">
                    Due Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="field-dueDate"
                    type="date"
                    value={invoiceForm.dueDate}
                    onChange={(e) => {
                      handleDueDateChange(e.target.value);
                      clearError('dueDate');
                      clearError('dueDays');
                    }}
                    className={`input-field py-1.5 text-xs font-medium font-mono ${
                      errors.dueDate ? 'border-red-500 bg-red-50/10 focus:ring-red-500/20' : ''
                    }`}
                  />
                  {errors.dueDate && (
                    <p className="text-[11px] text-red-500 mt-1 flex items-center gap-1 font-medium">
                      <AlertCircle className="w-3 h-3 flex-shrink-0" />
                      {errors.dueDate}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Customer Selection Card */}
            <div className="glass-card p-5 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-wa-border dark:border-wa-dark-border">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-wa-green/10 text-wa-green rounded-lg">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-wa-text-primary dark:text-white uppercase tracking-wider">
                      Customer / Lead Selection (Auto-Fetch)
                    </h3>
                  </div>
                </div>
                <span className="text-[10px] text-wa-text-secondary">{customers.length} contacts loaded</span>
              </div>

              {/* Dynamic Customer Select */}
              <div>
                <label className="block text-[10px] font-bold text-wa-text-secondary uppercase mb-1">
                  Choose Customer from CRM Database
                </label>
                <div className="relative">
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => handleSelectCustomer(e.target.value)}
                    className="input-field py-2 text-xs font-semibold appearance-none pr-8 cursor-pointer"
                  >
                    <option value="">-- Choose Customer / Lead to Auto-Fill --</option>
                    {customers.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name} ({c.phone}) {c.city ? `- ${c.city}` : ''}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-wa-text-secondary absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* Editable / Auto-fetched fields */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[10px] font-bold text-wa-text-secondary uppercase mb-1">
                    Client Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="field-customerName"
                    type="text"
                    value={invoiceForm.customerName}
                    onChange={(e) => {
                      setInvoiceForm({ ...invoiceForm, customerName: e.target.value });
                      clearError('customerName');
                    }}
                    className={`input-field py-1.5 text-xs font-semibold ${
                      errors.customerName ? 'border-red-500 bg-red-50/10 focus:ring-red-500/20' : ''
                    }`}
                    placeholder="Client or Company Name"
                  />
                  {errors.customerName && (
                    <p className="text-[11px] text-red-500 mt-1 flex items-center gap-1 font-medium">
                      <AlertCircle className="w-3 h-3 flex-shrink-0" />
                      {errors.customerName}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-wa-text-secondary uppercase mb-1">
                    Phone Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="field-customerPhone"
                    type="text"
                    value={invoiceForm.customerPhone}
                    onChange={(e) => {
                      setInvoiceForm({ ...invoiceForm, customerPhone: e.target.value });
                      clearError('customerPhone');
                    }}
                    className={`input-field py-1.5 text-xs font-mono ${
                      errors.customerPhone ? 'border-red-500 bg-red-50/10 focus:ring-red-500/20' : ''
                    }`}
                    placeholder="10-digit mobile number"
                  />
                  {errors.customerPhone && (
                    <p className="text-[11px] text-red-500 mt-1 flex items-center gap-1 font-medium">
                      <AlertCircle className="w-3 h-3 flex-shrink-0" />
                      {errors.customerPhone}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-wa-text-secondary uppercase mb-1">Email</label>
                  <input
                    type="email"
                    value={invoiceForm.customerEmail}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, customerEmail: e.target.value })}
                    className="input-field py-1.5 text-xs"
                    placeholder="client@gmail.com"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-wa-text-secondary uppercase mb-1">City</label>
                  <input
                    type="text"
                    value={invoiceForm.customerCity}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, customerCity: e.target.value })}
                    className="input-field py-1.5 text-xs"
                    placeholder="Surat"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-wa-text-secondary uppercase mb-1">
                    State (Destination) <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="field-customerState"
                    value={invoiceForm.customerState}
                    onChange={(e) => handleCustomerStateChange(e.target.value)}
                    className={`input-field py-1.5 text-xs font-semibold ${
                      errors.customerState ? 'border-red-500 bg-red-50/10 focus:ring-red-500/20' : ''
                    }`}
                  >
                    <option value="">-- Select State --</option>
                    {INDIAN_STATES.map((st) => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                  {errors.customerState && (
                    <p className="text-[11px] text-red-500 mt-1 flex items-center gap-1 font-medium">
                      <AlertCircle className="w-3 h-3 flex-shrink-0" />
                      {errors.customerState}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-wa-text-secondary uppercase mb-1">Address</label>
                  <input
                    type="text"
                    value={invoiceForm.customerAddress}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, customerAddress: e.target.value })}
                    className="input-field py-1.5 text-xs"
                    placeholder="Street or Building address"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-wa-text-secondary uppercase mb-1 flex items-center justify-between">
                    <span>
                      Customer GSTIN {invoiceForm.invoiceType === 'tax_invoice' ? <span className="text-red-500">*</span> : <span className="text-wa-text-secondary font-normal lowercase">(optional)</span>}
                    </span>
                    {invoiceForm.invoiceType === 'tax_invoice' && (
                      <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-semibold lowercase">required for tax invoice</span>
                    )}
                  </label>
                  <input
                    id="field-customerGstin"
                    type="text"
                    maxLength={15}
                    value={invoiceForm.customerGstin}
                    onChange={(e) => {
                      setInvoiceForm({ ...invoiceForm, customerGstin: e.target.value.toUpperCase() });
                      clearError('customerGstin');
                    }}
                    className={`input-field py-1.5 text-xs font-mono uppercase ${
                      errors.customerGstin ? 'border-red-500 bg-red-50/10 focus:ring-red-500/20' : ''
                    }`}
                    placeholder="24AAXFN3372M1ZK"
                  />
                  {errors.customerGstin && (
                    <p className="text-[11px] text-red-500 mt-1 flex items-center gap-1 font-medium">
                      <AlertCircle className="w-3 h-3 flex-shrink-0" />
                      {errors.customerGstin}
                    </p>
                  )}
                </div>
              </div>

              {/* GST Auto-Detection Chip */}
              <div className="flex items-center justify-between p-2.5 rounded-xl border border-wa-border/50 bg-slate-50 dark:bg-wa-dark-header/30 text-xs">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                    isIntraState 
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20' 
                      : 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/20'
                  }`}>
                    {isIntraState ? 'Intra-State Supply' : 'Inter-State Supply'}
                  </span>
                  <span className="text-[11px] text-wa-text-secondary">
                    {isIntraState 
                      ? `Both in ${settings.state || 'Gujarat'} → Split into CGST & SGST` 
                      : `${settings.state || 'Gujarat'} to ${invoiceForm.customerState || 'Other'} → Single IGST`}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const current = isIntraState ? 'intra_state' : 'inter_state';
                    const next = current === 'intra_state' ? 'inter_state' : 'intra_state';
                    setInvoiceForm({ ...invoiceForm, gstTypeOverride: next });
                    toast.success(`GST forced to ${next === 'intra_state' ? 'CGST + SGST' : 'IGST'}`);
                  }}
                  className="text-[10px] font-bold text-wa-text-secondary hover:text-wa-green transition-colors cursor-pointer"
                >
                  Override GST
                </button>
              </div>

            </div>

            {/* Line Items & Services Card */}
            <div className="glass-card p-5 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-wa-border dark:border-wa-dark-border">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-blue-500/10 text-blue-500 rounded-lg">
                    <Receipt className="w-4 h-4" />
                  </div>
                  <h3 className="text-xs font-bold text-wa-text-primary dark:text-white uppercase tracking-wider">
                    Line Items & Services
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="flex items-center gap-1 text-[11px] font-bold text-wa-green hover:underline cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Item
                </button>
              </div>

              {/* Global Items error if no items */}
              {errors.items && (
                <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 text-xs flex items-center gap-1.5 font-medium">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {errors.items}
                </div>
              )}

              {/* Table Column Titles */}
              <div className="overflow-x-auto">
                <div className="min-w-[620px] space-y-2">
                  <div className="grid grid-cols-12 gap-2 px-2 text-[10px] font-bold uppercase text-wa-text-secondary tracking-wider">
                    <div className="col-span-3">Item / Service <span className="text-red-500">*</span></div>
                    <div className="col-span-2 text-center">HSN / SAC</div>
                    <div className="col-span-2 text-center">Qty <span className="text-red-500">*</span></div>
                    <div className="col-span-2 text-right">Rate (₹) <span className="text-red-500">*</span></div>
                    <div className="col-span-2 text-right">Disc/Qty (₹)</div>
                    <div className="col-span-1 text-center">Action</div>
                  </div>

                  {invoiceForm.items.map((item, idx) => (
                    <div 
                      key={idx} 
                      className="p-2.5 rounded-xl bg-wa-bg/60 dark:bg-wa-dark-header/40 border border-wa-border/50 dark:border-wa-dark-border/40 space-y-1.5"
                    >
                      <div className="grid grid-cols-12 gap-2 items-start">
                        {/* 1. Item Description */}
                        <div className="col-span-3">
                          <input
                            id={`field-item_${idx}_description`}
                            type="text"
                            placeholder="Service / Product name..."
                            value={item.description}
                            onChange={(e) => {
                              handleItemChange(idx, 'description', e.target.value);
                              clearError(`item_${idx}_description`);
                            }}
                            className={`input-field py-1 px-2.5 text-xs font-medium text-wa-text-primary dark:text-white ${
                              errors[`item_${idx}_description`] ? 'border-red-500 bg-red-50/10 focus:ring-red-500/20' : ''
                            }`}
                          />
                          {errors[`item_${idx}_description`] && (
                            <p className="text-[10px] text-red-500 mt-0.5 font-medium leading-tight flex items-center gap-0.5">
                              <span>⚠</span> {errors[`item_${idx}_description`]}
                            </p>
                          )}
                        </div>

                        {/* 2. HSN / SAC */}
                        <div className="col-span-2">
                          <input
                            type="text"
                            placeholder="HSN/SAC"
                            value={item.hsnSac || ''}
                            onChange={(e) => handleItemChange(idx, 'hsnSac', e.target.value)}
                            className="input-field py-1 px-2 text-xs font-mono text-center text-wa-text-primary dark:text-white"
                          />
                        </div>

                        {/* 3. Quantity (Fixed visible width, no spinner crowding) */}
                        <div className="col-span-2">
                          <input
                            id={`field-item_${idx}_quantity`}
                            type="number"
                            min="1"
                            placeholder="1"
                            value={item.quantity ?? ''}
                            onChange={(e) => {
                              handleItemChange(idx, 'quantity', e.target.value);
                              clearError(`item_${idx}_quantity`);
                            }}
                            className={`input-field py-1 px-2 text-xs text-center font-mono font-bold text-wa-text-primary dark:text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                              errors[`item_${idx}_quantity`] ? 'border-red-500 bg-red-50/10 focus:ring-red-500/20' : ''
                            }`}
                          />
                          {errors[`item_${idx}_quantity`] && (
                            <p className="text-[10px] text-red-500 mt-0.5 font-medium text-center leading-tight flex items-center justify-center gap-0.5">
                              <span>⚠</span> {errors[`item_${idx}_quantity`]}
                            </p>
                          )}
                        </div>

                        {/* 4. Unit Price / Rate */}
                        <div className="col-span-2">
                          <input
                            id={`field-item_${idx}_unitPrice`}
                            type="number"
                            min="0"
                            placeholder="0"
                            value={item.unitPrice ?? ''}
                            onChange={(e) => {
                              handleItemChange(idx, 'unitPrice', e.target.value);
                              clearError(`item_${idx}_unitPrice`);
                            }}
                            className={`input-field py-1 px-2 text-xs text-right font-mono text-wa-text-primary dark:text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                              errors[`item_${idx}_unitPrice`] ? 'border-red-500 bg-red-50/10 focus:ring-red-500/20' : ''
                            }`}
                          />
                          {errors[`item_${idx}_unitPrice`] && (
                            <p className="text-[10px] text-red-500 mt-0.5 font-medium text-right leading-tight flex items-center justify-end gap-0.5">
                              <span>⚠</span> {errors[`item_${idx}_unitPrice`]}
                            </p>
                          )}
                        </div>

                        {/* 5. Discount per unit */}
                        <div className="col-span-2">
                          <input
                            id={`field-item_${idx}_discountPerUnit`}
                            type="number"
                            min="0"
                            placeholder="₹ off"
                            value={item.discountPerUnit || ''}
                            onChange={(e) => {
                              handleItemChange(idx, 'discountPerUnit', e.target.value);
                              clearError(`item_${idx}_discountPerUnit`);
                            }}
                            className={`input-field py-1 px-2 text-xs text-right font-mono text-amber-600 dark:text-amber-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                              errors[`item_${idx}_discountPerUnit`] ? 'border-red-500 bg-red-50/10' : ''
                            }`}
                          />
                          {errors[`item_${idx}_discountPerUnit`] && (
                            <p className="text-[10px] text-red-500 mt-0.5 font-medium text-right leading-tight flex items-center justify-end gap-0.5">
                              <span>⚠</span> {errors[`item_${idx}_discountPerUnit`]}
                            </p>
                          )}
                        </div>

                        {/* 6. Action */}
                        <div className="col-span-1 flex items-center justify-center pt-1">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="p-1 text-red-400 hover:text-red-600 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                            title="Remove item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Item Sub-calc breakdown */}
                      <div className="flex items-center justify-between px-1 text-[10px] text-wa-text-secondary border-t border-wa-border/30 pt-1">
                        <div className="flex items-center gap-2">
                          {Number(item.discountPerUnit) > 0 ? (
                            <span className="text-amber-600 dark:text-amber-400 font-semibold">
                              Disc: ₹{item.discountPerUnit} × {item.quantity} = -₹{(Number(item.discountPerUnit) * Number(item.quantity)).toLocaleString('en-IN')}
                            </span>
                          ) : (
                            <span>No item discount</span>
                          )}
                          <span className="opacity-40">•</span>
                          <span>Net Rate: ₹{(Number(item.unitPrice) - Number(item.discountPerUnit || 0)).toLocaleString('en-IN')}</span>
                        </div>
                        <div className="font-mono font-bold text-wa-text-primary dark:text-white">
                          Taxable: ₹{item.amount?.toLocaleString('en-IN') || 0}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tax Option, GST Rate & Overall Discount Controls */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 border-t border-wa-border/50 dark:border-wa-dark-border/40">
                {/* 1. Tax Option Field (No tax, CGST+SGST, IGST) */}
                <div>
                  <label className="block text-[10px] font-bold text-wa-text-secondary uppercase mb-1 flex items-center justify-between">
                    <span>Tax Option</span>
                    {invoiceForm.taxOptionOverridden ? (
                      <span className="text-[9px] text-amber-500 font-semibold lowercase">(manual)</span>
                    ) : (
                      <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-semibold lowercase">(auto)</span>
                    )}
                  </label>
                  <select
                    id="field-taxOption"
                    value={taxOption}
                    onChange={(e) => handleTaxOptionChange(e.target.value)}
                    className="input-field py-1.5 text-xs font-semibold cursor-pointer"
                  >
                    <option value="no_tax">🚫 No Tax (0% / Exempt)</option>
                    <option value="cgst_sgst">🏛️ SGST + CGST (Intra-State)</option>
                    <option value="igst">🌐 IGST (Inter-State)</option>
                  </select>
                </div>

                {/* 2. GST Rate (% Total) */}
                <div>
                  <label className="block text-[10px] font-bold text-wa-text-secondary uppercase mb-1">
                    GST Rate (% Total)
                  </label>
                  <select
                    disabled={isNoTax}
                    value={isNoTax ? 0 : invoiceForm.taxPercent}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, taxPercent: Number(e.target.value) })}
                    className={`input-field py-1.5 text-xs font-semibold ${
                      isNoTax 
                        ? 'opacity-60 cursor-not-allowed bg-slate-100 dark:bg-slate-800' 
                        : 'cursor-pointer'
                    }`}
                  >
                    {isNoTax ? (
                      <option value={0}>0% (No Tax Applied)</option>
                    ) : (
                      <>
                        <option value={5}>5% GST</option>
                        <option value={12}>12% GST</option>
                        <option value={18}>18% GST (Standard Services)</option>
                        <option value={28}>28% GST</option>
                      </>
                    )}
                  </select>
                </div>

                {/* 3. Overall Extra Discount */}
                <div>
                  <label className="block text-[10px] font-bold text-wa-text-secondary uppercase mb-1">
                    Overall Extra Discount (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={invoiceForm.discount || ''}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, discount: Number(e.target.value) || 0 })}
                    className="input-field py-1.5 text-xs font-mono text-amber-600 dark:text-amber-400 font-semibold"
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Comprehensive Calculation Summary Breakdown */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-wa-dark-header/40 border border-wa-border/60 space-y-1.5 text-xs">
                <div className="flex justify-between text-wa-text-secondary">
                  <span>Items Gross Subtotal:</span>
                  <span className="font-mono font-semibold text-wa-text-primary dark:text-white">
                    ₹{itemsSubtotal.toLocaleString('en-IN')}
                  </span>
                </div>

                {totalItemDiscount > 0 && (
                  <div className="flex justify-between text-amber-600 dark:text-amber-400">
                    <span>Total Item Discounts Applied:</span>
                    <span className="font-mono font-semibold">-₹{totalItemDiscount.toLocaleString('en-IN')}</span>
                  </div>
                )}

                {overallDiscount > 0 && (
                  <div className="flex justify-between text-amber-600 dark:text-amber-400">
                    <span>Overall Invoice Discount:</span>
                    <span className="font-mono font-semibold">-₹{overallDiscount.toLocaleString('en-IN')}</span>
                  </div>
                )}

                <div className="flex justify-between font-semibold border-t border-wa-border/40 pt-1 text-wa-text-primary dark:text-white">
                  <span>Taxable Amount:</span>
                  <span className="font-mono">₹{taxableAmount.toLocaleString('en-IN')}</span>
                </div>

                {/* GST Details Breakdown */}
                {isNoTax ? (
                  <div className="flex justify-between items-center py-1.5 px-2.5 my-1 bg-slate-100/60 dark:bg-slate-800/40 rounded-lg border border-dashed border-slate-200 dark:border-slate-700 text-[11px] text-slate-500 dark:text-slate-400 italic">
                    <span>Tax Option:</span>
                    <span className="font-medium font-mono">No Tax (0% GST - Nil / Proforma)</span>
                  </div>
                ) : (
                  totalTaxAmount > 0 && (
                    <div className="space-y-1 py-1 border-y border-wa-border/30 my-1 bg-wa-bg/40 dark:bg-wa-dark-panel/40 p-2 rounded-lg">
                      <div className="text-[10px] uppercase font-bold text-wa-text-secondary">
                        GST Breakdown ({taxBreakdown.label}):
                      </div>
                      {taxOption === 'cgst_sgst' ? (
                        <>
                          <div className="flex justify-between text-slate-600 dark:text-slate-300">
                            <span>• CGST ({taxBreakdown.cgstRate}%):</span>
                            <span className="font-mono font-semibold">₹{taxBreakdown.cgstAmount.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-slate-600 dark:text-slate-300">
                            <span>• SGST ({taxBreakdown.sgstRate}%):</span>
                            <span className="font-mono font-semibold">₹{taxBreakdown.sgstAmount.toFixed(2)}</span>
                          </div>
                        </>
                      ) : (
                        <div className="flex justify-between text-slate-600 dark:text-slate-300">
                          <span>• IGST ({taxBreakdown.igstRate}%):</span>
                          <span className="font-mono font-semibold">₹{taxBreakdown.igstAmount.toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  )
                )}

                {/* Round Off Display */}
                <div className="flex justify-between items-center text-xs">
                  <span className="text-wa-text-secondary flex items-center gap-1">
                    <Calculator className="w-3 h-3 text-wa-green" /> Round Off Adjustment:
                  </span>
                  <span className={`font-mono font-bold ${
                    roundOffAmount < 0 
                      ? 'text-red-500' 
                      : roundOffAmount > 0 
                      ? 'text-emerald-600' 
                      : 'text-wa-text-secondary'
                  }`}>
                    {roundOffAmount < 0 
                      ? `-₹${Math.abs(roundOffAmount).toFixed(2)}` 
                      : roundOffAmount > 0 
                      ? `+₹${roundOffAmount.toFixed(2)}` 
                      : '₹0.00'}
                  </span>
                </div>

                <div className="pt-2 flex justify-between items-center text-sm font-black border-t-2 border-wa-border dark:border-wa-dark-border text-wa-text-primary dark:text-white">
                  <span>Grand Total:</span>
                  <span className="text-wa-green text-lg font-mono">₹{roundedGrandTotal.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>

            {/* Terms & Notes Card in Form */}
            <div className="glass-card p-5 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-wa-border dark:border-wa-dark-border">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-slate-500/10 text-slate-600 dark:text-slate-300 rounded-lg">
                    <FileText className="w-4 h-4" />
                  </div>
                  <h3 className="text-xs font-bold text-wa-text-primary dark:text-white uppercase tracking-wider">
                    Terms & Conditions and Notes
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setInvoiceForm((f) => ({
                      ...f,
                      terms: settings.defaultTerms,
                      notes: settings.defaultNotes
                    }));
                    toast.success('Reset terms from Default Settings');
                  }}
                  className="text-[10px] font-bold text-wa-green hover:underline cursor-pointer"
                >
                  Reload from Settings
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] font-bold text-wa-text-secondary uppercase mb-1">
                    Terms & Conditions (Printed on Invoice)
                  </label>
                  <textarea
                    rows="3"
                    value={invoiceForm.terms}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, terms: e.target.value })}
                    className="input-field py-1.5 text-xs font-mono"
                    placeholder="Enter numbered terms & conditions..."
                  />
                  <p className="text-[10px] text-wa-text-secondary mt-0.5">
                    Line breaks and numbered points are preserved in the printed invoice.
                  </p>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-wa-text-secondary uppercase mb-1">
                    Customer Notes / Remarks
                  </label>
                  <input
                    type="text"
                    value={invoiceForm.notes}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, notes: e.target.value })}
                    className="input-field py-1.5 text-xs"
                    placeholder="e.g. Thank you for your business!"
                  />
                </div>
              </div>
            </div>

            {/* Action Buttons: Save & Download PDF, Save Only, Print */}
            <div className="flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={(e) => handleCreateInvoice(e, true)}
                disabled={generating}
                className="btn-primary flex-1 py-2.5 text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-wa-green/25 cursor-pointer"
              >
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Generate, Save & Download PDF
              </button>

              <button
                type="button"
                onClick={(e) => handleCreateInvoice(e, false)}
                disabled={generating}
                className="px-4 py-2.5 rounded-xl border border-wa-border dark:border-wa-dark-border text-xs font-bold text-wa-text-primary dark:text-white hover:bg-wa-hover dark:hover:bg-wa-dark-hover transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Save className="w-4 h-4 text-wa-green" />
                Save Only
              </button>

              <button
                type="button"
                onClick={handlePrint}
                className="px-4 py-2.5 rounded-xl border border-wa-border dark:border-wa-dark-border text-xs font-bold text-wa-text-secondary hover:text-wa-text-primary hover:bg-wa-hover dark:hover:bg-wa-dark-hover transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                title="Print or Save as PDF"
              >
                <Printer className="w-4 h-4" /> Print / PDF
              </button>
            </div>
          </form>

          {/* Right Column: Live Printable Invoice Document Preview (6 cols) */}
          <div className="lg:col-span-6 sticky top-6 print:static print:w-full print:max-w-full print:m-0 print:p-0">
            <div 
              id="printable-invoice" 
              className="bg-white text-slate-800 rounded-2xl shadow-xl border border-slate-200 p-8 space-y-5 print:m-0 print:w-full print:max-w-full print:border-none print:shadow-none print:rounded-none min-h-[640px]"
            >
              
              {/* Document Header */}
              <div className="flex items-start justify-between border-b border-slate-200 pb-5">
                <div>
                  {settings.logo ? (
                    <img src={settings.logo} alt="Company Logo" className="h-10 mb-2 object-contain" />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white font-black text-lg flex items-center justify-center mb-2 shadow-sm">
                      {settings.companyName ? settings.companyName.substring(0, 2).toUpperCase() : 'HK'}
                    </div>
                  )}
                  <h1 className="text-lg font-black text-slate-900 tracking-tight leading-tight">
                    {settings.companyName || 'Your Business Name'}
                  </h1>
                  {settings.tagline && <p className="text-[11px] text-slate-500 font-medium">{settings.tagline}</p>}
                  <p className="text-[10px] text-slate-500 mt-1 max-w-xs leading-relaxed">
                    {[settings.address, settings.city, settings.state, settings.pincode].filter(Boolean).join(', ')}
                  </p>
                  
                  {/* Company Contact & Email Details */}
                  <div className="flex flex-wrap gap-x-3 text-[10px] text-slate-600 mt-1">
                    {settings.contactNumber && (
                      <span><strong className="text-slate-800 font-medium">Contact:</strong> {settings.contactNumber}</span>
                    )}
                    {settings.contactEmail && (
                      <span><strong className="text-slate-800 font-medium">Email:</strong> {settings.contactEmail}</span>
                    )}
                    {settings.website && (
                      <span><strong className="text-slate-800 font-medium">Web:</strong> {settings.website}</span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-x-3 text-[10px] font-mono text-slate-600 mt-0.5">
                    {settings.gstin && <span><strong className="text-slate-800 font-sans">GSTIN:</strong> {settings.gstin}</span>}
                    {settings.pan && <span><strong className="text-slate-800 font-sans">PAN:</strong> {settings.pan}</span>}
                  </div>
                </div>

                <div className="text-right space-y-1">
                  <span className={`inline-block px-3 py-1 rounded-lg font-black text-xs uppercase tracking-wider border ${
                    invoiceForm.invoiceType === 'tax_invoice'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-blue-50 text-blue-700 border-blue-200'
                  }`}>
                    {invoiceForm.invoiceType === 'tax_invoice' ? 'TAX INVOICE' : 'PROFORMA INVOICE'}
                  </span>
                  <div className="text-xs font-mono font-bold text-slate-900 mt-1">
                    {invoiceForm.invoiceNumber}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Date: <span className="font-medium text-slate-700">{invoiceForm.invoiceDate}</span>
                  </div>
                  {invoiceForm.dueDate && (
                    <div className="text-[11px] text-slate-500">
                      Due: <span className="font-medium text-slate-700">{invoiceForm.dueDate} ({invoiceForm.dueDays} days)</span>
                    </div>
                  )}
                  <div className="pt-1">
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold border border-slate-200 capitalize">
                      Mode: {invoiceForm.paymentMode.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Billed To / Client Details */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 flex justify-between items-start text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1">
                    Billed To:
                  </span>
                  <div className="font-bold text-slate-900 text-sm">{invoiceForm.customerName || 'Select / Enter Client Name'}</div>
                  {invoiceForm.customerPhone && <div className="text-slate-600 font-mono mt-0.5">{invoiceForm.customerPhone}</div>}
                  {invoiceForm.customerEmail && <div className="text-slate-600 mt-0.2">{invoiceForm.customerEmail}</div>}
                  <div className="text-slate-600 mt-0.2">
                    {[invoiceForm.customerAddress, invoiceForm.customerCity, invoiceForm.customerState].filter(Boolean).join(', ')}
                  </div>
                  {invoiceForm.customerGstin && (
                    <div className="text-[10px] font-mono font-semibold text-slate-700 mt-0.5">
                      GSTIN: {invoiceForm.customerGstin}
                    </div>
                  )}
                </div>

                <div className="text-right">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${
                    isNoTax
                      ? 'bg-slate-100 text-slate-700 border-slate-200'
                      : taxOption === 'igst'
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}>
                    {isNoTax
                      ? 'Tax Exempt / Nil Supply'
                      : taxOption === 'igst'
                      ? 'Inter-State Supply (IGST)'
                      : 'Intra-State Supply (CGST+SGST)'}
                  </span>
                  <div className="text-[10px] text-slate-500 mt-1 font-mono">
                    Place of Supply: {invoiceForm.customerState || settings.state || 'Gujarat'}
                  </div>
                </div>
              </div>

              {/* Invoice Items Table */}
              <div className="overflow-hidden border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-600">
                    <tr>
                      <th className="py-2.5 px-3">No.</th>
                      <th className="py-2.5 px-3">Item / Service</th>
                      <th className="py-2.5 px-3 text-center">HSN/SAC</th>
                      <th className="py-2.5 px-3 text-center">Qty</th>
                      <th className="py-2.5 px-3 text-right">Rate</th>
                      <th className="py-2.5 px-3 text-right">Disc/Qty</th>
                      <th className="py-2.5 px-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {invoiceForm.items.map((item, i) => (
                      <tr key={i}>
                        <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">{i + 1}</td>
                        <td className="py-2.5 px-3 font-medium text-slate-800">{item.description || 'Service Item'}</td>
                        <td className="py-2.5 px-3 text-center font-mono text-slate-500 text-[11px]">{item.hsnSac || '-'}</td>
                        <td className="py-2.5 px-3 text-center font-mono text-slate-800">{item.quantity}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-800">₹{Number(item.unitPrice).toLocaleString('en-IN')}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-800">
                          {Number(item.discountPerUnit) > 0 ? `-₹${Number(item.discountPerUnit).toLocaleString('en-IN')}` : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                          ₹{Number(item.amount).toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Calculation Summary with Tax Breakdown & Round Off - Clean Dark Monochrome */}
              <div className="flex justify-end">
                <div className="w-72 space-y-1.5 text-xs text-slate-700">
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span>Items Subtotal:</span>
                    <span className="font-mono font-semibold text-slate-900">₹{itemsSubtotal.toLocaleString('en-IN')}</span>
                  </div>

                  {totalItemDiscount > 0 && (
                    <div className="flex justify-between py-0.5 text-slate-700">
                      <span>Item Discounts:</span>
                      <span className="font-mono text-slate-900">-₹{totalItemDiscount.toLocaleString('en-IN')}</span>
                    </div>
                  )}

                  {overallDiscount > 0 && (
                    <div className="flex justify-between py-0.5 text-slate-700">
                      <span>Overall Discount:</span>
                      <span className="font-mono text-slate-900 font-semibold">-₹{overallDiscount.toLocaleString('en-IN')}</span>
                    </div>
                  )}

                  <div className="flex justify-between py-1 border-b border-slate-100 font-semibold text-slate-900">
                    <span>Taxable Value:</span>
                    <span className="font-mono">₹{taxableAmount.toLocaleString('en-IN')}</span>
                  </div>

                  {/* GST Breakdown */}
                  {!isNoTax && totalTaxAmount > 0 && (
                    <>
                      {taxOption === 'cgst_sgst' ? (
                        <>
                          <div className="flex justify-between py-0.5 text-slate-700">
                            <span>CGST ({taxBreakdown.cgstRate}%):</span>
                            <span className="font-mono font-semibold text-slate-900">₹{taxBreakdown.cgstAmount.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between py-0.5 text-slate-700 border-b border-slate-100 pb-1">
                            <span>SGST ({taxBreakdown.sgstRate}%):</span>
                            <span className="font-mono font-semibold text-slate-900">₹{taxBreakdown.sgstAmount.toFixed(2)}</span>
                          </div>
                        </>
                      ) : (
                        <div className="flex justify-between py-1 border-b border-slate-100 text-slate-700">
                          <span>IGST ({taxBreakdown.igstRate}%):</span>
                          <span className="font-mono font-semibold text-slate-900">₹{taxBreakdown.igstAmount.toFixed(2)}</span>
                        </div>
                      )}
                    </>
                  )}

                  {/* Round off row - Clean dark monochrome */}
                  <div className="flex justify-between py-1 border-b border-slate-100 text-xs text-slate-700">
                    <span>Round Off:</span>
                    <span className="font-mono font-medium text-slate-900">
                      {roundOffAmount < 0 
                        ? `-₹${Math.abs(roundOffAmount).toFixed(2)}` 
                        : roundOffAmount > 0 
                        ? `+₹${roundOffAmount.toFixed(2)}` 
                        : '₹0.00'}
                    </span>
                  </div>

                  {/* Total Due (INR) - Bold Black Monochrome */}
                  <div className="flex justify-between py-2 border-t-2 border-slate-900 text-sm font-black text-slate-900">
                    <span>Total Due (INR):</span>
                    <span className="text-slate-900 font-mono text-base font-black">₹{roundedGrandTotal.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>

              {/* Amount in Words (Full Line Below Total Due) */}
              <div className="py-1 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs flex flex-wrap items-baseline gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Amount in Words:
                </span>
                <span className="font-bold text-slate-900 capitalize font-sans">
                  {amountInWords}
                </span>
              </div>

              {/* Bank Details & Terms Footer */}
              <div className="grid grid-cols-2 gap-6 pt-4 border-t border-slate-200 text-[10px]">
                <div className="space-y-1">
                  <span className="font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    {invoiceForm.paymentMode === 'other_account' ? 'Bank Transfer Details (Other Account)' : 'Bank Transfer Details'}
                  </span>
                  <div className="text-slate-800 font-bold">{activeBankDetails.bankName || 'Bank Name Not Specified'}</div>
                  {activeBankDetails.accountHolder && <div className="text-slate-600">A/C Name: {activeBankDetails.accountHolder}</div>}
                  <div className="text-slate-600 font-mono">A/C: {activeBankDetails.accountNumber || '-'}</div>
                  <div className="text-slate-600 font-mono">IFSC: {activeBankDetails.ifscCode || '-'}</div>
                  {activeBankDetails.branch && <div className="text-slate-600">Branch: {activeBankDetails.branch}</div>}
                  {activeBankDetails.upiId && <div className="text-slate-800 font-mono font-semibold mt-1">UPI: {activeBankDetails.upiId}</div>}
                </div>

                <div className="space-y-1 text-left">
                  <span className="font-bold uppercase tracking-wider text-slate-400 block mb-1">Terms & Conditions</span>
                  <div className="text-slate-700 leading-relaxed whitespace-pre-line font-medium text-[10px]">
                    {invoiceForm.terms || settings.defaultTerms || '1. Payment is due within 15 days of the invoice date.\n2. Late payments may incur additional charges.'}
                  </div>
                  {(invoiceForm.notes || settings.defaultNotes) && (
                    <div className="text-slate-500 italic text-[10px] whitespace-pre-line mt-2 pt-1 border-t border-slate-100">
                      {invoiceForm.notes || settings.defaultNotes}
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>

        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 3: INVOICE HISTORY / SAVED INVOICES LIST                   */}
      {/* ============================================================== */}
      {activeTab === 'history' && (
        <div className="glass-card overflow-hidden space-y-4 p-5 no-print">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-wa-text-secondary" />
              <input
                type="text"
                placeholder="Search invoice number or customer name..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="input-field pl-9 py-2 text-xs"
              />
            </div>
            <button
              onClick={() => setActiveTab('generate')}
              className="btn-primary px-4 py-2 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Create New Invoice
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-wa-border dark:border-wa-dark-border bg-wa-panel-header dark:bg-wa-dark-panel-header/35 text-[10px] uppercase font-bold text-wa-text-secondary">
                  <th className="py-3 px-4">Invoice No</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Customer Name</th>
                  <th className="py-3 px-4">Date / Due</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Payment Status</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-wa-border/50 dark:divide-wa-dark-border/40">
                {invoices.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-12 text-center text-wa-text-secondary">
                      No invoices created yet. Click "Create New Invoice" to start!
                    </td>
                  </tr>
                ) : (
                  invoices
                    .filter((inv) => {
                      if (!historySearch.trim()) return true;
                      const q = historySearch.toLowerCase();
                      return (
                        inv.invoiceNumber?.toLowerCase().includes(q) ||
                        inv.customerName?.toLowerCase().includes(q) ||
                        inv.customerPhone?.includes(q)
                      );
                    })
                    .map((inv) => (
                      <tr key={inv._id} className="hover:bg-wa-hover/40 dark:hover:bg-wa-dark-hover/10 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-wa-text-primary dark:text-white">
                          {inv.invoiceNumber}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase ${
                            inv.invoiceType === 'tax_invoice'
                              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                              : 'bg-blue-500/15 text-blue-700 dark:text-blue-400'
                          }`}>
                            {inv.invoiceType === 'tax_invoice' ? 'Tax' : 'Proforma'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-semibold block text-wa-text-primary dark:text-white">
                            {inv.customerName}
                          </span>
                          <span className="text-[10px] text-wa-text-secondary font-mono">{inv.customerPhone}</span>
                        </td>
                        <td className="py-3 px-4 text-wa-text-secondary text-[11px]">
                          <div>{inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString() : '-'}</div>
                          {inv.dueDate && (
                            <div className="text-[10px] text-amber-600 dark:text-amber-400">
                              Due: {new Date(inv.dueDate).toLocaleDateString()}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-wa-green">
                          ₹{inv.grandTotal?.toLocaleString('en-IN') || 0}
                        </td>
                        <td className="py-3 px-4">
                          <select
                            value={inv.status}
                            onChange={(e) => handleUpdateInvoiceStatus(inv._id, e.target.value)}
                            className={`text-[10px] font-bold px-2 py-1 rounded-full cursor-pointer appearance-none border ${
                              inv.status === 'paid'
                                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/25'
                                : inv.status === 'payment_due'
                                ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/25'
                                : 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/25'
                            }`}
                          >
                            <option value="sent">🔵 Sent / Unpaid</option>
                            <option value="payment_due">🟠 Payment Due</option>
                            <option value="paid">🟢 Paid (Won)</option>
                            <option value="cancelled">❌ Cancelled</option>
                          </select>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => {
                                setSelectedInvoiceForView(inv);
                                const resolvedTaxOpt = inv.taxOption || (inv.taxPercent > 0 ? (inv.gstType === 'inter_state' ? 'igst' : 'cgst_sgst') : 'no_tax');
                                setInvoiceForm({
                                  invoiceNumber: inv.invoiceNumber,
                                  invoiceType: inv.invoiceType || 'tax_invoice',
                                  paymentMode: inv.paymentMode || 'current_account',
                                  selectedOtherAccountId: inv.selectedOtherAccountId || '',
                                  invoiceDate: inv.invoiceDate?.split('T')[0] || '',
                                  dueDays: inv.dueDays || 15,
                                  dueDate: inv.dueDate?.split('T')[0] || '',
                                  customerId: inv.customerId || '',
                                  customerName: inv.customerName,
                                  customerPhone: inv.customerPhone,
                                  customerEmail: inv.customerEmail,
                                  customerCity: inv.customerCity,
                                  customerState: inv.customerState || settings.state || 'Gujarat',
                                  customerAddress: inv.customerAddress,
                                  customerGstin: inv.customerGstin,
                                  taxOption: resolvedTaxOpt,
                                  taxOptionOverridden: true,
                                  items: inv.items?.map((it) => ({
                                    description: it.description,
                                    hsnSac: it.hsnSac || '',
                                    quantity: it.quantity,
                                    unitPrice: it.unitPrice,
                                    discountPerUnit: it.discountPerUnit || 0,
                                    totalDiscount: it.totalDiscount || 0,
                                    amount: it.amount
                                  })) || [],
                                  taxPercent: inv.taxPercent || 0,
                                  discount: inv.discount || 0,
                                  notes: inv.notes || '',
                                  terms: inv.terms || settings.defaultTerms || ''
                                });
                                setActiveTab('generate');
                              }}
                              className="p-1.5 bg-wa-green/10 text-wa-green hover:bg-wa-green hover:text-white rounded-lg transition-colors cursor-pointer"
                              title="View & Edit Invoice"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handlePrintHistoryInvoice(inv)}
                              className="p-1.5 bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white rounded-lg transition-colors cursor-pointer"
                              title="Download PDF / Print"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteInvoice(inv._id)}
                              className="p-1.5 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition-colors cursor-pointer"
                              title="Delete Invoice"
                            >
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

      {/* ============================================================== */}
      {/* MODAL: ADD / EDIT OTHER BANK ACCOUNT                          */}
      {/* ============================================================== */}
      {showOtherAccountModal && (
        <Portal>
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in no-print">
            <div className="glass-card max-w-lg w-full bg-white dark:bg-wa-dark-panel p-6 rounded-2xl shadow-2xl border border-wa-border dark:border-wa-dark-border space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-wa-border dark:border-wa-dark-border">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-xl">
                    <Landmark className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-wa-text-primary dark:text-white">
                      {editingOtherAccount ? 'Edit Other Bank Account' : 'Add Other Bank Account'}
                    </h3>
                    <p className="text-xs text-wa-text-secondary">
                      Save alternate bank account details for proforma invoices
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowOtherAccountModal(false)}
                  className="p-1 rounded-lg text-wa-text-secondary hover:text-wa-text-primary dark:hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveOtherAccount} className="space-y-3.5">
                <div>
                  <label className="block text-[10px] font-bold text-wa-text-secondary uppercase mb-1">
                    Account Label / Nickname <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={otherAccountForm.accountTitle}
                    onChange={(e) => setOtherAccountForm({ ...otherAccountForm, accountTitle: e.target.value })}
                    className="input-field py-2 text-xs font-semibold"
                    placeholder="e.g. Axis Alternate A/C or Personal HDFC"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-wa-text-secondary uppercase mb-1">
                      Bank Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={otherAccountForm.bankName}
                      onChange={(e) => setOtherAccountForm({ ...otherAccountForm, bankName: e.target.value })}
                      className="input-field py-2 text-xs font-semibold"
                      placeholder="e.g. Axis Bank Ltd"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-wa-text-secondary uppercase mb-1">
                      Account Holder Name
                    </label>
                    <input
                      type="text"
                      value={otherAccountForm.accountHolder}
                      onChange={(e) => setOtherAccountForm({ ...otherAccountForm, accountHolder: e.target.value })}
                      className="input-field py-2 text-xs"
                      placeholder="e.g. John Doe"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-wa-text-secondary uppercase mb-1">
                      Account Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={otherAccountForm.accountNumber}
                      onChange={(e) => setOtherAccountForm({ ...otherAccountForm, accountNumber: e.target.value })}
                      className="input-field py-2 text-xs font-mono font-bold"
                      placeholder="919010012345678"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-wa-text-secondary uppercase mb-1">
                      IFSC Code
                    </label>
                    <input
                      type="text"
                      value={otherAccountForm.ifscCode}
                      onChange={(e) => setOtherAccountForm({ ...otherAccountForm, ifscCode: e.target.value.toUpperCase() })}
                      className="input-field py-2 text-xs font-mono font-bold uppercase"
                      placeholder="UTIB0000123"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-wa-text-secondary uppercase mb-1">
                      Branch Name
                    </label>
                    <input
                      type="text"
                      value={otherAccountForm.branch}
                      onChange={(e) => setOtherAccountForm({ ...otherAccountForm, branch: e.target.value })}
                      className="input-field py-2 text-xs"
                      placeholder="e.g. Ring Road Branch, Surat"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-wa-text-secondary uppercase mb-1">
                      UPI ID (Optional)
                    </label>
                    <input
                      type="text"
                      value={otherAccountForm.upiId}
                      onChange={(e) => setOtherAccountForm({ ...otherAccountForm, upiId: e.target.value })}
                      className="input-field py-2 text-xs font-mono text-wa-green font-semibold"
                      placeholder="e.g. username@okhdfcbank"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-wa-border dark:border-wa-dark-border">
                  <button
                    type="button"
                    onClick={() => setShowOtherAccountModal(false)}
                    className="btn-secondary px-4 py-2 text-xs font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingOtherAccount}
                    className="btn-primary px-5 py-2 text-xs font-bold flex items-center gap-2 cursor-pointer shadow-md shadow-wa-green/20"
                  >
                    {savingOtherAccount ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {editingOtherAccount ? 'Save Changes' : 'Add Bank Account'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </Portal>
      )}

    </div>
  );
}
