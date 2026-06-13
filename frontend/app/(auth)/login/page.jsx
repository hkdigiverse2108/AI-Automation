'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '../../../lib/store';
import { MessageCircle, Eye, EyeOff, ArrowRight, ShieldCheck, HelpCircle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  // 2FA state transition
  const [requires2FA, setRequires2FA] = useState(false);
  const [tempToken, setTempToken] = useState('');
  const [totpCode, setTotpCode] = useState('');

  const { login, verify2FA } = useAuthStore();
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await login(email, password);
      if (result.success) {
        if (result.data?.requires2FA) {
          setTempToken(result.data.tempToken);
          setRequires2FA(true);
          toast.success('Credentials correct. Please provide 2FA code.');
        } else {
          toast.success('Welcome back!');
          router.push('/dashboard');
        }
      } else {
        toast.error(result.error || 'Login failed');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login failed');
    }
    setLoading(false);
  };

  const handle2FAVerify = async (e) => {
    e.preventDefault();
    if (!totpCode || totpCode.length < 6) {
      return toast.error('Please enter a valid 6-digit code');
    }
    setLoading(true);
    try {
      const result = await verify2FA(tempToken, totpCode);
      if (result.success) {
        toast.success('MFA Verification successful. Welcome!');
        router.push('/dashboard');
      } else {
        toast.error(result.error || 'Invalid 2FA code');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Verification failed');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 dark:bg-wa-dark-bg relative overflow-hidden font-sans">
      
      {/* Top signature green band (Matches WhatsApp Web's signature layout) */}
      <div className="h-[220px] bg-wa-green dark:bg-wa-teal w-full absolute top-0 left-0 z-0 shadow-sm" />

      {/* Main Container */}
      <div className="flex-1 flex flex-col items-center justify-center relative z-10 p-4 md:p-8">
        
        {/* Brand Header */}
        <div className="flex items-center gap-3.5 mb-8 select-none">
          <div className="w-10 h-10 bg-white dark:bg-wa-dark-panel rounded-xl flex items-center justify-center shadow-lg">
            <MessageCircle className="w-6 h-6 text-wa-green fill-wa-green/10" />
          </div>
          <div>
            <h1 className="font-bold text-lg text-white">HK Automation</h1>
            <p className="text-[10px] text-white/80 font-bold uppercase tracking-wider">Enterprise Suite</p>
          </div>
        </div>

        {/* Auth Box split-panel wrapper */}
        <div className="w-full max-w-3xl bg-white dark:bg-wa-dark-panel rounded-2xl shadow-2xl border border-wa-border dark:border-wa-dark-border overflow-hidden flex flex-col md:flex-row min-h-[460px] animate-fade-in">
          
          {/* Left panel: form instructions and inputs */}
          <div className="flex-1 p-8 md:p-10 flex flex-col justify-between">
            <div>
              {/* Conditional Title */}
              {!requires2FA ? (
                <div className="space-y-4">
                  <h2 className="text-xl font-bold text-wa-text-primary dark:text-white">Sign In to Dashboard</h2>
                  
                  {/* WhatsApp Web style instructions */}
                  <div className="space-y-2.5 text-xs text-wa-text-secondary dark:text-wa-dark-text-secondary leading-relaxed border-b border-wa-border dark:border-wa-dark-border pb-5">
                    <p className="flex gap-2">
                      <span className="font-bold text-wa-green">1.</span>
                      <span>Provide your registered enterprise email address.</span>
                    </p>
                    <p className="flex gap-2">
                      <span className="font-bold text-wa-green">2.</span>
                      <span>Enter your password securely.</span>
                    </p>
                    <p className="flex gap-2">
                      <span className="font-bold text-wa-green">3.</span>
                      <span>Enforce Two-Factor protection if prompted next.</span>
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <h2 className="text-xl font-bold text-wa-green flex items-center gap-2">
                    <ShieldCheck className="w-6 h-6" />
                    <span>Two-Factor Security</span>
                  </h2>
                  <p className="text-xs text-wa-text-secondary dark:text-wa-dark-text-secondary leading-relaxed border-b border-wa-border dark:border-wa-dark-border pb-5">
                    Enter the 6-digit authentication code generated by Speakeasy or Google Authenticator on your mobile device.
                  </p>
                </div>
              )}

              {/* Login Form */}
              {!requires2FA ? (
                <form onSubmit={handleSubmit} className="space-y-4 mt-6">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-wa-text-secondary mb-1.5 tracking-wider">Email Address</label>
                    <input 
                      type="email" 
                      value={email} 
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. user@enterprise.com" 
                      required 
                      className="w-full px-4 py-2.5 text-sm bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-xl text-wa-text-primary dark:text-white placeholder-wa-text-secondary focus:outline-none focus:ring-2 focus:ring-wa-green/30 focus:border-wa-green transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-wa-text-secondary mb-1.5 tracking-wider">Password</label>
                    <div className="relative">
                      <input 
                        type={showPw ? 'text' : 'password'} 
                        value={password} 
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••" 
                        required 
                        className="w-full pl-4 pr-10 py-2.5 text-sm bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-xl text-wa-text-primary dark:text-white placeholder-wa-text-secondary focus:outline-none focus:ring-2 focus:ring-wa-green/30 focus:border-wa-green transition-all font-mono"
                      />
                      <button 
                        type="button" 
                        onClick={() => setShowPw(!showPw)} 
                        className="absolute right-3.5 top-3 text-wa-text-secondary hover:text-wa-text-primary transition-colors"
                      >
                        {showPw ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1.5">
                    <label className="flex items-center gap-2 text-wa-text-secondary dark:text-wa-dark-text-secondary cursor-pointer">
                      <input type="checkbox" className="rounded border-wa-border text-wa-green focus:ring-wa-green/30 bg-wa-bg dark:bg-wa-dark-header" />
                      <span>Remember credentials</span>
                    </label>
                    <Link href="/forgot-password" className="text-wa-green hover:underline font-semibold">Forgot credentials?</Link>
                  </div>

                  <button 
                    type="submit" 
                    disabled={loading}
                    className="w-full py-3 bg-wa-green hover:bg-wa-green-hover disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-wa-green/20 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2 mt-6"
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <span>Sign In to Console</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              ) : (
                // 2FA Form
                <form onSubmit={handle2FAVerify} className="space-y-5 mt-6">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-wa-text-secondary mb-1.5 tracking-wider text-center">TOTP Challenge Code</label>
                    <input 
                      type="text" 
                      value={totpCode} 
                      onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="123456" 
                      required 
                      maxLength="6"
                      className="w-full max-w-[200px] mx-auto px-4 py-3 bg-wa-bg dark:bg-wa-dark-header border border-wa-border dark:border-wa-dark-border rounded-xl text-center font-mono text-xl tracking-[0.5em] text-wa-text-primary dark:text-white focus:outline-none focus:ring-2 focus:ring-wa-green/30 focus:border-wa-green transition-all"
                    />
                  </div>

                  <button 
                    type="submit" 
                    disabled={loading}
                    className="w-full py-3 bg-wa-green hover:bg-wa-green-hover disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-wa-green/20 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2 mt-6"
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <span>Verify & Unlock</span>
                        <ShieldCheck className="w-4.5 h-4.5" />
                      </>
                    )}
                  </button>

                  <button 
                    type="button" 
                    onClick={() => setRequires2FA(false)}
                    className="w-full text-center text-xs text-wa-text-secondary hover:text-wa-text-primary font-semibold mt-3.5 block"
                  >
                    Back to credentials login
                  </button>
                </form>
              )}
            </div>

            {/* Footer option to Register */}
            <p className="text-center text-xs text-wa-text-secondary dark:text-wa-dark-text-secondary mt-8 pt-4 border-t border-wa-border dark:border-wa-dark-border select-none">
              New admin accounts are created only by the Super Admin. Please contact your Super Admin to obtain credentials.
            </p>
          </div>

          {/* Right panel: WhatsApp Web QR code simulation (Desktop only) */}
          <div className="hidden md:flex w-72 bg-wa-bg dark:bg-wa-dark-header/40 border-l border-wa-border dark:border-wa-dark-border p-8 flex-col items-center justify-center shrink-0 relative">
            <div className="absolute inset-0 wa-chat-bg opacity-[0.03] pointer-events-none" />
            
            <div className="relative space-y-4 text-center z-10 flex flex-col items-center">
              {/* Simulated QR Code box */}
              <div className="p-3.5 bg-white rounded-2xl border border-wa-border shadow-md relative group hover:scale-[1.02] transition-transform duration-300">
                <div className="w-36 h-36 bg-slate-50 flex items-center justify-center rounded-xl border relative overflow-hidden">
                  
                  {/* Faux QR pixels pattern */}
                  <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#000_20%,transparent_20%)] bg-[size:8px_8px]" />
                  <div className="w-6 h-6 border-2 border-black absolute top-2 left-2" />
                  <div className="w-6 h-6 border-2 border-black absolute top-2 right-2" />
                  <div className="w-6 h-6 border-2 border-black absolute bottom-2 left-2" />
                  
                  {/* Central branding pulsing element */}
                  <div className="w-9 h-9 bg-wa-green rounded-full flex items-center justify-center shadow-lg relative animate-pulse">
                    <MessageCircle className="w-5 h-5 text-white fill-white/10" />
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <span className="block text-xs font-bold text-wa-text-primary dark:text-white uppercase tracking-wider">Device Link Faux-QR</span>
                <p className="text-[10px] text-wa-text-secondary dark:text-wa-dark-text-secondary max-w-[160px] leading-relaxed">
                  Sign in on the left to authorize operations console session.
                </p>
              </div>
              
              <div className="inline-flex items-center gap-1 text-[9px] font-bold text-wa-green bg-wa-green/10 border border-wa-green/20 px-2 py-0.5 rounded-full select-none">
                <HelpCircle className="w-3 h-3" />
                <span>Sandbox Mode Active</span>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* Landing footer */}
      <footer className="py-6 text-center text-[10px] text-wa-text-secondary/70 dark:text-wa-dark-text-secondary/50 relative z-10">
        <p>© {new Date().getFullYear()} WA Platform. Secure authentication. Built for Enterprise Scale.</p>
      </footer>
    </div>
  );
}
