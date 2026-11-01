'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '../../../lib/store';
import { MessageCircle, Eye, EyeOff, ArrowRight, Loader2, Building2, User, Mail, Phone, Lock, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    organizationName: '',
    name: '',
    email: '',
    mobileNumber: '',
    password: ''
  });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const { register } = useAuthStore();
  const router = useRouter();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.organizationName.trim()) {
      return toast.error('Please enter your company or business name');
    }
    if (!formData.name.trim()) {
      return toast.error('Please enter your full name');
    }
    if (!formData.email.trim()) {
      return toast.error('Please enter your email address');
    }
    if (!formData.password || formData.password.length < 6) {
      return toast.error('Password must be at least 6 characters');
    }

    setLoading(true);
    try {
      const result = await register({
        organizationName: formData.organizationName.trim(),
        name: formData.name.trim(),
        email: formData.email.trim(),
        mobileNumber: formData.mobileNumber.trim(),
        password: formData.password
      });

      if (result.success) {
        toast.success('🎉 Account created! Please choose your subscription plan to get started.', { duration: 5000 });
        router.replace('/dashboard/subscription');
      } else {
        toast.error(result.error || 'Registration failed');
      }
    } catch (err) {
      console.error('[Register Submit Error]:', err);
      const errorMsg =
        err.response?.data?.error ||
        err.response?.data?.message ||
        err.message ||
        'Registration failed';
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 dark:bg-wa-dark-bg relative overflow-hidden font-sans">
      
      {/* Top signature green band */}
      <div className="h-[220px] bg-wa-green dark:bg-wa-teal w-full absolute top-0 left-0 z-0 shadow-sm" />

      {/* Main Container */}
      <div className="flex-1 flex flex-col items-center justify-center relative z-10 p-4 md:p-8">
        
        {/* Brand Header */}
        <div className="flex items-center gap-3.5 mb-6 select-none">
          <div className="w-10 h-10 bg-white dark:bg-wa-dark-panel rounded-xl flex items-center justify-center shadow-lg">
            <MessageCircle className="w-6 h-6 text-wa-green fill-wa-green/10" />
          </div>
          <div>
            <h1 className="font-bold text-lg text-white">HK Automation</h1>
            <p className="text-[10px] text-white/80 font-bold uppercase tracking-wider">Enterprise Suite</p>
          </div>
        </div>

        {/* Auth Box */}
        <div className="w-full max-w-xl bg-white dark:bg-wa-dark-panel rounded-2xl shadow-2xl border border-wa-border dark:border-wa-dark-border overflow-hidden p-7 md:p-9 animate-fade-in">
          
          <div className="mb-6 border-b border-wa-border dark:border-wa-dark-border pb-4">
            <h2 className="text-xl font-extrabold text-wa-text-primary dark:text-white">Create Business Account</h2>
            <p className="text-xs text-wa-text-secondary dark:text-wa-dark-text-secondary mt-1">
              Get started with official WhatsApp automation for your enterprise
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Organization Name */}
            <div>
              <label className="block text-xs font-bold text-wa-text-primary dark:text-white mb-1.5 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-wa-green" />
                <span>Company / Business Name *</span>
              </label>
              <input
                type="text"
                name="organizationName"
                value={formData.organizationName}
                onChange={handleChange}
                placeholder="e.g. Acme Technologies LLP"
                required
                className="w-full px-3.5 py-2.5 bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-xl text-xs text-wa-text-primary dark:text-white placeholder-wa-text-secondary/60 focus:outline-none focus:ring-2 focus:ring-wa-green/30 focus:border-wa-green transition-all"
              />
            </div>

            {/* Admin Name & Mobile (2 cols on md) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-wa-text-primary dark:text-white mb-1.5 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-wa-green" />
                  <span>Full Name *</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="e.g. Rahul Sharma"
                  required
                  className="w-full px-3.5 py-2.5 bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-xl text-xs text-wa-text-primary dark:text-white placeholder-wa-text-secondary/60 focus:outline-none focus:ring-2 focus:ring-wa-green/30 focus:border-wa-green transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-wa-text-primary dark:text-white mb-1.5 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-wa-green" />
                  <span>Mobile Number</span>
                </label>
                <input
                  type="tel"
                  name="mobileNumber"
                  value={formData.mobileNumber}
                  onChange={handleChange}
                  placeholder="e.g. 9876543210"
                  className="w-full px-3.5 py-2.5 bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-xl text-xs text-wa-text-primary dark:text-white placeholder-wa-text-secondary/60 focus:outline-none focus:ring-2 focus:ring-wa-green/30 focus:border-wa-green transition-all"
                />
              </div>
            </div>

            {/* Work Email */}
            <div>
              <label className="block text-xs font-bold text-wa-text-primary dark:text-white mb-1.5 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-wa-green" />
                <span>Work Email Address *</span>
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="name@company.com"
                required
                className="w-full px-3.5 py-2.5 bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-xl text-xs text-wa-text-primary dark:text-white placeholder-wa-text-secondary/60 focus:outline-none focus:ring-2 focus:ring-wa-green/30 focus:border-wa-green transition-all"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-bold text-wa-text-primary dark:text-white mb-1.5 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-wa-green" />
                <span>Password *</span>
              </label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Min 6 characters"
                  required
                  className="w-full px-3.5 py-2.5 bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-xl text-xs text-wa-text-primary dark:text-white placeholder-wa-text-secondary/60 focus:outline-none focus:ring-2 focus:ring-wa-green/30 focus:border-wa-green transition-all pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-wa-text-secondary hover:text-wa-text-primary dark:hover:text-white transition-colors"
                  tabIndex={-1}
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Plan notice */}
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                After sign up, select your subscription duration (1, 3, 6, or 12 months) to activate instant WhatsApp messaging & platform features.
              </span>
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-wa-green hover:bg-wa-green-hover disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-wa-green/20 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2 text-xs mt-5 cursor-pointer"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>Create Account & Choose Plan</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Already have an account */}
          <div className="text-center text-xs text-wa-text-secondary dark:text-wa-dark-text-secondary mt-6 pt-4 border-t border-wa-border dark:border-wa-dark-border select-none">
            Already have an account?{' '}
            <Link href="/login" className="text-wa-green hover:underline font-bold">
              Sign In
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}

