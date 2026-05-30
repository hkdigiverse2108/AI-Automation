'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '../lib/store';
import { 
  MessageCircle, ArrowRight, ShieldCheck, Zap, Sparkles, Loader2, 
  Bot, CheckCircle, Mail, MessageSquare, Shield, CheckCheck, Lock
} from 'lucide-react';

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, loading, checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (!loading) {
      if (isAuthenticated) {
        router.push('/dashboard');
      }
    }
  }, [isAuthenticated, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-wa-green" />
          <p className="text-sm text-slate-400 font-semibold tracking-wide">Loading WA Marketing Console...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-950 to-black text-white overflow-hidden relative font-sans">
      
      {/* Signature WhatsApp repeating background pattern overlay */}
      <div className="absolute inset-0 wa-chat-bg opacity-[0.02] pointer-events-none z-0" />
      
      {/* Background radial soft green glow spotlights */}
      <div className="absolute top-[-15%] left-[-10%] w-[55%] h-[55%] rounded-full bg-wa-green/10 blur-[130px] pointer-events-none z-0" />
      <div className="absolute bottom-[-15%] right-[-10%] w-[55%] h-[55%] rounded-full bg-wa-green/10 blur-[130px] pointer-events-none z-0" />

      {/* Navbar wrapper */}
      <header className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between border-b border-white/5 relative z-10 select-none">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 bg-gradient-to-br from-wa-green to-wa-green-hover rounded-xl flex items-center justify-center shadow-lg shadow-wa-green/20">
            <MessageCircle className="w-5.5 h-5.5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-base text-white tracking-tight leading-none">WA Business</h1>
            <p className="text-[9px] text-wa-green-light font-bold uppercase tracking-widest mt-1">Marketing Suite</p>
          </div>
        </div>
        <div className="flex items-center gap-5">
          <Link href="/login" className="text-sm font-semibold text-slate-300 hover:text-white transition-colors">
            Login
          </Link>
          <Link href="/register" className="bg-wa-green hover:bg-wa-green-hover text-white font-bold text-sm px-4.5 py-2.5 rounded-xl transition-all shadow-md shadow-wa-green/15 hover:scale-[1.02] active:scale-[0.98]">
            Get Started Free
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-6xl mx-auto px-6 pt-16 pb-24 relative z-10 flex flex-col lg:flex-row items-center gap-12">
        
        {/* Left Side: Copywriting details */}
        <div className="flex-1 text-left space-y-6 lg:max-w-[540px]">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-full text-xs text-wa-green-light font-semibold animate-fade-in">
            <Sparkles className="w-3.5 h-3.5 text-wa-green animate-pulse" />
            <span>Next-Gen Enterprise WABA Cloud Suite</span>
          </div>

          <h2 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1] bg-gradient-to-r from-white via-slate-100 to-slate-350 bg-clip-text text-transparent">
            Automate Your WhatsApp Marketing & Operations
          </h2>
          
          <p className="text-slate-400 text-sm md:text-base leading-relaxed">
            Dispatch bulk template campaigns with full delivery metrics. Design visual, logic-forked AI conversation flow builders, manage client chats in a unified WhatsApp Web clone inbox, and lock your accounts with 2FA TOTP protection.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-4 pt-2">
            <Link href="/register" className="w-full sm:w-auto px-7 py-3.5 bg-wa-green hover:bg-wa-green-hover text-white font-bold rounded-xl shadow-lg shadow-wa-green/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2">
              <span>Launch Dashboard Free</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/login" className="w-full sm:w-auto bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold py-3.5 px-7 rounded-xl transition-all text-center">
              Console Sign In
            </Link>
          </div>

          {/* Quick Stats list */}
          <div className="grid grid-cols-3 gap-4 pt-6 border-t border-white/5 text-xs select-none">
            <div>
              <span className="block font-bold text-lg text-wa-green font-mono">100%</span>
              <span className="text-slate-500">Official Cloud API API Link</span>
            </div>
            <div>
              <span className="block font-bold text-lg text-wa-green font-mono">&lt; 1s</span>
              <span className="text-slate-500">Real-time Webhook Sync</span>
            </div>
            <div>
              <span className="block font-bold text-lg text-wa-green font-mono">Speakeasy</span>
              <span className="text-slate-500">MFA TOTP Device Lock</span>
            </div>
          </div>
        </div>

        {/* Right Side: Beautiful WhatsApp Web Interface Mockup */}
        <div className="flex-1 w-full max-w-md lg:max-w-none relative animate-fade-in select-none">
          <div className="absolute inset-0 bg-wa-green/10 rounded-2xl blur-3xl pointer-events-none" />
          
          <div className="relative bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[350px]">
            {/* Faux browser top bar */}
            <div className="bg-slate-950/60 px-4 py-2.5 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
              </div>
              <span className="text-[10px] text-slate-500 font-mono tracking-wider">WA Web-Suite Preview</span>
              <div className="w-8" />
            </div>

            {/* Faux Chat Area */}
            <div className="flex-1 bg-[#efeae2]/10 p-5 space-y-4 overflow-y-auto relative">
              <div className="absolute inset-0 wa-chat-bg opacity-[0.03] pointer-events-none" />
              
              {/* Left Bubble (Bot Message) */}
              <div className="flex justify-start relative z-10">
                <div className="bg-slate-800 rounded-2xl rounded-tl-none px-3.5 py-2 border border-white/5 shadow-md flex flex-col">
                  <span className="text-xs text-white leading-relaxed">
                    Hello! Welcome to our enterprise team support. How can I help you today?
                  </span>
                  <span className="text-[8px] text-slate-400 text-right mt-1.5">12:30 PM</span>
                </div>
              </div>

              {/* Right Bubble (User Message) */}
              <div className="flex justify-end relative z-10">
                <div className="bg-[#005c4b] rounded-2xl rounded-tr-none px-3.5 py-2 shadow-md flex flex-col border border-wa-green/10">
                  <span className="text-xs text-white leading-relaxed">
                    I would like to start a custom AI campaign blast.
                  </span>
                  <span className="text-[8px] text-slate-350 text-right mt-1.5 flex items-center gap-0.5 justify-end">
                    12:31 PM <span className="text-blue-400">✓✓</span>
                  </span>
                </div>
              </div>

              {/* Left Bubble (AI Response) */}
              <div className="flex justify-start relative z-10">
                <div className="bg-slate-800 rounded-2xl rounded-tl-none px-3.5 py-2 border border-white/5 shadow-md flex flex-col">
                  <span className="text-[10px] font-bold text-wa-green-light mb-1">🤖 AI Bot Agent</span>
                  <span className="text-xs text-white leading-relaxed">
                    Sure! Syncing campaign nodes with target lists. 🚀
                  </span>
                  <span className="text-[8px] text-slate-400 text-right mt-1.5">12:31 PM</span>
                </div>
              </div>
            </div>

            {/* Faux Chat Input bottom bar */}
            <div className="bg-slate-950/60 px-4 py-3 border-t border-white/5 flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-xs text-slate-400 font-bold">+</div>
              <div className="flex-1 bg-slate-800/80 rounded-lg px-3.5 py-1.5 text-xs text-slate-500 select-all border border-white/5">
                Type a simulated message...
              </div>
              <div className="w-7 h-7 rounded-full bg-wa-green flex items-center justify-center text-white text-xs">➡️</div>
            </div>

          </div>
        </div>

      </main>

      {/* Feature Details section */}
      <section className="max-w-6xl mx-auto px-6 py-12 border-t border-white/5 relative z-10 select-none">
        <h3 className="text-center font-bold text-sm uppercase text-slate-500 tracking-widest mb-10">Integrated Marketing Engine Features</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Feature 1 */}
          <div className="p-6 bg-white/[0.02] border border-white/5 rounded-2xl hover:border-white/10 hover:bg-white/[0.04] transition-all group">
            <div className="w-12 h-12 bg-wa-green/10 text-wa-green rounded-xl flex items-center justify-center mb-4 group-hover:scale-105 transition-transform shadow-inner">
              <Zap className="w-5.5 h-5.5" />
            </div>
            <h4 className="font-bold text-lg mb-2 text-white group-hover:text-wa-green transition-colors">Automated Blasts</h4>
            <p className="text-sm text-slate-400 leading-relaxed">
              Queue bulk lists, split user cohorts, import CSV numbers, and configure meta approval templates with granular delivery reports.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="p-6 bg-white/[0.02] border border-white/5 rounded-2xl hover:border-white/10 hover:bg-white/[0.04] transition-all group">
            <div className="w-12 h-12 bg-wa-green/10 text-wa-green rounded-xl flex items-center justify-center mb-4 group-hover:scale-105 transition-transform shadow-inner">
              <Bot className="w-5.5 h-5.5" />
            </div>
            <h4 className="font-bold text-lg mb-2 text-white group-hover:text-wa-green transition-colors">Visual Flow Builder</h4>
            <p className="text-sm text-slate-400 leading-relaxed">
              Design multi-node charts. Wire condition branches, delayed replies, and connect OpenAI assistants to response prompts on inbound keywords.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="p-6 bg-white/[0.02] border border-white/5 rounded-2xl hover:border-white/10 hover:bg-white/[0.04] transition-all group">
            <div className="w-12 h-12 bg-wa-green/10 text-wa-green rounded-xl flex items-center justify-center mb-4 group-hover:scale-105 transition-transform shadow-inner">
              <ShieldCheck className="w-5.5 h-5.5" />
            </div>
            <h4 className="font-bold text-lg mb-2 text-white group-hover:text-wa-green transition-colors">MFA TOTP Device Lock</h4>
            <p className="text-sm text-slate-400 leading-relaxed">
              Guard marketing portals with speakeasy authenticator App code verification challenges, preventing unauthorized console commands.
            </p>
          </div>
        </div>
      </section>

      {/* Footer containing Lock icon */}
      <footer className="border-t border-white/5 py-12 text-center text-xs text-slate-500 relative z-10 select-none space-y-4">
        
        {/* Faux Secure Lock Indicator */}
        <div className="flex items-center justify-center gap-1.5 text-[10px] font-bold text-slate-450 uppercase tracking-widest bg-white/5 max-w-[220px] mx-auto py-1 px-3.5 rounded-full border border-white/5 shadow-inner">
          <Lock className="w-3.5 h-3.5 text-wa-green" />
          <span>End-to-End Secured</span>
        </div>

        <p>© {new Date().getFullYear()} WA Business Suite. Dedicated WABA Portal. Built for scale.</p>
      </footer>
    </div>
  );
}
