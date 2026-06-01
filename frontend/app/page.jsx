'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '../lib/store';
import { 
  MessageCircle, ArrowRight, ShieldCheck, Zap, Sparkles, Loader2, 
  Bot, CheckCircle, Mail, MessageSquare, Shield, CheckCheck, Lock,
  Users, Target, Award, Check, HelpCircle, BarChart3, ChevronDown
} from 'lucide-react';

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, loading, checkAuth } = useAuthStore();
  const [activeFaq, setActiveFaq] = useState(null);

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
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-wa-green/20 border-t-wa-green rounded-full animate-spin" />
          <p className="text-sm text-slate-400 font-semibold tracking-wide animate-pulse">Loading WA Marketing Console...</p>
        </div>
      </div>
    );
  }

  const features = [
    {
      icon: Zap,
      color: '#00a884',
      title: 'Automated Broadcasts',
      description: 'Queue bulk lists, split contact cohorts, import CSV lists, and schedule pre-approved Meta WABA templates with comprehensive delivery analytics.'
    },
    {
      icon: Bot,
      color: '#8b5cf6',
      title: 'Visual Flow Builder',
      description: 'Design dynamic, multi-node canvas charts. Integrate keyword matching, delayed responses, and connect custom OpenAI assistants for AI-powered client chats.'
    },
    {
      icon: Users,
      color: '#3b82f6',
      title: 'Smart Engagement Scoring',
      description: 'Automatically segment your list into Cold, Warm, and Hot leads. The system grades contacts on interaction volumes, message recency, and response ratios.'
    },
    {
      icon: MessageSquare,
      color: '#06b6d4',
      title: 'Real-Time Shared Inbox',
      description: 'A pixel-perfect WhatsApp Web clone for multi-agent support. Intervene manually to lock chats, assign agents, or instantly transfer control back to AI.'
    },
    {
      icon: ShieldCheck,
      color: '#ec4899',
      title: 'TOTP Speakeasy Security',
      description: 'Protect sensitive marketing campaigns, customer databases, and admin dashboards with secure 2FA authenticator app integration.'
    },
    {
      icon: BarChart3,
      color: '#f59e0b',
      title: 'Tenant Analytics Heatmaps',
      description: 'Track hourly activity, delivery funnels, message read logs, and campaign conversions through beautiful time-series charts.'
    }
  ];

  const faqs = [
    {
      q: 'Do I need an official WhatsApp Business Cloud API account?',
      a: 'Yes, this marketing suite utilizes the official WhatsApp Business Cloud API from Meta. We help you link your Meta developer account in less than 5 minutes to guarantee 100% compliant delivery, preventing any number banning.'
    },
    {
      q: 'How does the Smart Contact Scoring system segment leads?',
      a: 'The background scoring engine tracks live interactions. Based on message volume (40%), recency (30%), and the ratio of user messages to agent replies (30%), it dynamically updates leads into Cold, Warm, and Hot. You can immediately filter and send broadcasts to these specific hot groups!'
    },
    {
      q: 'Can multiple support agents manage the Inbox simultaneously?',
      a: 'Absolutely! Our platform is a multi-tenant, multi-role SaaS. Admins can assign chats to specific agents, review agent response history, or take over chat control from the automation bot instantly using the Shared Inbox.'
    },
    {
      q: 'What type of attachments are supported in the visual canvas?',
      a: 'Our central Bot Media Library supports secure Cloudinary asset streams. You can drag, drop, or click-to-upload high-quality images, video brochures, PDFs, documents, audio clips, and contact cards directly inside node elements.'
    }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white overflow-x-hidden relative font-sans selection:bg-wa-green/20 selection:text-wa-green-light">
      
      {/* Signature WhatsApp repeating background pattern overlay */}
      <div className="absolute inset-0 wa-chat-bg opacity-[0.015] pointer-events-none z-0" />
      
      {/* Background radial soft green glow spotlights */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-wa-green/10 blur-[130px] pointer-events-none z-0" />
      <div className="absolute bottom-[20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-wa-green/10 blur-[130px] pointer-events-none z-0" />
      <div className="absolute top-[40%] left-[20%] w-[35%] h-[35%] rounded-full bg-wa-green/5 blur-[120px] pointer-events-none z-0" />

      {/* HEADER NAVBAR */}
      <header className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between border-b border-white/5 relative z-10 backdrop-blur-sm sticky top-0 bg-slate-950/80">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-wa-green to-wa-green-dark rounded-xl flex items-center justify-center shadow-lg shadow-wa-green/25">
            <MessageCircle className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-extrabold text-sm text-white tracking-tight leading-none">WA Business</h1>
            <p className="text-[9px] text-wa-green-light font-bold uppercase tracking-widest mt-0.5 leading-none">Marketing Suite</p>
          </div>
        </div>
        <nav className="hidden md:flex items-center gap-8 text-xs font-semibold text-slate-300">
          <a href="#features" className="hover:text-white transition-colors">Features</a>
          <a href="#faq" className="hover:text-white transition-colors">FAQs</a>
          <a href="#mockup" className="hover:text-white transition-colors">Console Preview</a>
        </nav>
        <div className="flex items-center gap-4">
          <Link href="/login" className="bg-wa-green hover:bg-wa-green-hover text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-md shadow-wa-green/15 hover:scale-[1.02] active:scale-[0.98]">
            Login Console
          </Link>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="max-w-7xl mx-auto px-6 pt-16 pb-20 relative z-10 flex flex-col lg:flex-row items-center gap-12">
        
        {/* Left Copywriting Column */}
        <div className="flex-1 text-left space-y-6 lg:max-w-[560px]">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-wa-green/10 border border-wa-green/20 rounded-full text-xs text-wa-green-light font-bold">
            <Sparkles className="w-3.5 h-3.5 text-wa-green animate-pulse" />
            <span>Official WABA Cloud API Operations Suite</span>
          </div>

          <h2 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.08] bg-gradient-to-r from-white via-slate-100 to-slate-350 bg-clip-text text-transparent">
            Scale Your Customer Engagement on WhatsApp
          </h2>
          
          <p className="text-slate-400 text-sm md:text-[15px] leading-relaxed">
            Unleash the ultimate WhatsApp SaaS platform. Dispatch smart template campaigns, design visual AI bot canvas builders, recalculate contact engagement grades, monitor live notification logs, and lock operations with Speakeasy 2FA protection.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-4 pt-2">
            <Link href="/login" className="w-full sm:w-auto px-7 py-3.5 bg-wa-green hover:bg-wa-green-hover text-white font-bold rounded-xl shadow-lg shadow-wa-green/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-sm">
              <span>Admin Login Console</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Core Trust Indicators */}
          <div className="grid grid-cols-3 gap-4 pt-8 border-t border-white/5 text-xs select-none">
            <div>
              <span className="block font-bold text-xl text-wa-green font-mono">100%</span>
              <span className="text-slate-500 block mt-0.5">Compliant Cloud API</span>
            </div>
            <div>
              <span className="block font-bold text-xl text-wa-green font-mono">Real-time</span>
              <span className="text-slate-500 block mt-0.5">Webhooks & Scoring</span>
            </div>
            <div>
              <span className="block font-bold text-xl text-wa-green font-mono">TOTP Lock</span>
              <span className="text-slate-500 block mt-0.5">MFA Authenticator</span>
            </div>
          </div>
        </div>

        {/* Right Shared Mockup Column */}
        <div id="mockup" className="flex-1 w-full max-w-md lg:max-w-none relative select-none">
          <div className="absolute inset-0 bg-wa-green/10 rounded-2xl blur-3xl pointer-events-none" />
          
          <div className="relative bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[380px] hover:border-wa-green/25 transition-colors duration-300">
            {/* Faux browser top bar */}
            <div className="bg-slate-950/60 px-4 py-2.5 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                <span className="w-2 h-2 rounded-full bg-yellow-500" />
                <span className="w-2 h-2 rounded-full bg-green-500" />
              </div>
              <span className="text-[10px] text-slate-500 font-mono tracking-wider">WA Web-Suite Console Preview</span>
              <div className="w-8" />
            </div>

            {/* Faux Inbox Split View */}
            <div className="flex-1 flex overflow-hidden">
              {/* Left Faux Chats Sidebar */}
              <div className="w-[140px] border-r border-white/5 bg-slate-950/40 hidden sm:flex flex-col py-3 px-2 space-y-2">
                <div className="h-6 bg-slate-800/80 rounded-lg px-2 flex items-center text-[9px] text-slate-500 font-medium">Search chats...</div>
                <div className="space-y-1">
                  <div className="p-1.5 rounded-lg bg-wa-green/10 border-l-2 border-wa-green flex items-center gap-1.5">
                    <div className="w-4 h-4 rounded-full bg-wa-green/20 text-[8px] font-bold text-wa-green-light flex items-center justify-center">PR</div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[8px] font-bold text-white leading-none truncate">Prince</p>
                      <p className="text-[7px] text-wa-green-light font-bold mt-0.5 leading-none">HOT lead</p>
                    </div>
                  </div>
                  <div className="p-1.5 rounded-lg hover:bg-white/5 flex items-center gap-1.5">
                    <div className="w-4 h-4 rounded-full bg-blue-500/20 text-[8px] font-bold text-blue-400 flex items-center justify-center">JD</div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[8px] font-bold text-slate-300 leading-none truncate">Jordan Miller</p>
                      <p className="text-[7px] text-slate-500 mt-0.5 leading-none">Warm lead</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Faux ChatWindow */}
              <div className="flex-1 flex flex-col bg-[#efeae2]/10 relative">
                <div className="absolute inset-0 wa-chat-bg opacity-[0.03] pointer-events-none" />
                
                {/* Header */}
                <div className="h-9 bg-slate-950/40 border-b border-white/5 px-3 flex items-center justify-between shrink-0 relative z-10">
                  <div className="flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded-full bg-wa-green/20 text-[9px] font-bold text-wa-green-light flex items-center justify-center">PR</div>
                    <div>
                      <p className="text-[9px] font-bold text-white leading-none">Prince</p>
                      <p className="text-[7px] text-slate-400 leading-none mt-0.5">Active Conversation</p>
                    </div>
                  </div>
                  <span className="text-[7px] bg-purple-950/40 text-purple-300 border border-purple-900/30 px-1 py-0.5 rounded font-bold">BOT</span>
                </div>

                {/* Messages */}
                <div className="flex-1 p-3 space-y-2 overflow-y-auto relative z-10">
                  <div className="flex justify-start">
                    <div className="bg-slate-800 rounded-xl rounded-tl-none px-2.5 py-1.5 border border-white/5 shadow-md flex flex-col max-w-[85%]">
                      <span className="text-[10px] text-white leading-relaxed">
                        Hey! I saw the latest visual brochure you sent.
                      </span>
                      <span className="text-[6px] text-slate-400 text-right mt-1">12:30 PM</span>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <div className="bg-[#005c4b] rounded-xl rounded-tr-none px-2.5 py-1.5 shadow-md flex flex-col border border-wa-green/10 max-w-[85%]">
                      <span className="text-[10px] text-white leading-relaxed">
                        Excellent! Connecting you to our AI Agent.
                      </span>
                      <span className="text-[6px] text-slate-350 text-right mt-1 flex items-center gap-0.5 justify-end">
                        12:31 PM <span className="text-blue-400">✓✓</span>
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-start">
                    <div className="bg-slate-800 rounded-xl rounded-tl-none px-2.5 py-1.5 border border-white/5 shadow-md flex flex-col max-w-[85%]">
                      <span className="text-[8px] font-bold text-wa-green-light mb-0.5">🤖 AI Assistant</span>
                      <span className="text-[10px] text-white leading-relaxed">
                        Hello! Let\'s analyze active requirements... 📊
                      </span>
                      <span className="text-[6px] text-slate-400 text-right mt-1">12:31 PM</span>
                    </div>
                  </div>
                </div>

                {/* Input */}
                <div className="bg-slate-950/40 px-3 py-2 border-t border-white/5 flex items-center gap-1.5 shrink-0">
                  <div className="w-4 h-4 rounded-full bg-slate-800 flex items-center justify-center text-[10px] text-slate-400 font-bold">+</div>
                  <div className="flex-1 bg-slate-800/80 rounded-md px-2.5 py-1 text-[9px] text-slate-500 border border-white/5">
                    Type a message...
                  </div>
                  <div className="w-5 h-5 rounded-full bg-wa-green flex items-center justify-center text-white text-[9px]">➡️</div>
                </div>
              </div>
            </div>

          </div>
        </div>

      </section>

      {/* CORE INTEGRATED MODULES */}
      <section id="features" className="max-w-6xl mx-auto px-6 py-16 border-t border-white/5 relative z-10">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <h3 className="font-extrabold text-xs uppercase text-wa-green tracking-widest mb-2">Integrated Platform Features</h3>
          <h2 className="text-3xl font-extrabold tracking-tight">Everything You Need For WhatsApp Success</h2>
          <p className="text-sm text-slate-400 mt-2">A high-fidelity operational suite that bridges marketing campaigns and automated CRM flows.</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((f, i) => (
            <div 
              key={i} 
              className="p-6 bg-slate-900/40 border border-white/5 rounded-2xl hover:border-wa-green/20 hover:bg-slate-900/60 transition-all duration-300 group relative overflow-hidden"
            >
              <div className="w-12 h-12 bg-wa-green/10 text-wa-green rounded-xl flex items-center justify-center mb-5 group-hover:scale-105 transition-all shadow-inner">
                <f.icon className="w-5.5 h-5.5" style={{ color: f.color }} />
              </div>
              <h4 className="font-bold text-base mb-2.5 text-white group-hover:text-wa-green transition-colors">{f.title}</h4>
              <p className="text-xs text-slate-400 leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* SAAS STATS SHOWCASE */}
      <section className="bg-slate-950 py-16 border-t border-white/5 relative z-10 select-none">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div className="space-y-1">
              <p className="text-3xl md:text-4xl font-extrabold text-wa-green font-mono">&gt; 99%</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">API Delivery Rate</p>
            </div>
            <div className="space-y-1">
              <p className="text-3xl md:text-4xl font-extrabold text-wa-green font-mono">1.2s</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Average AI Reply Time</p>
            </div>
            <div className="space-y-1">
              <p className="text-3xl md:text-4xl font-extrabold text-wa-green font-mono">24/7</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Uptime Reliability</p>
            </div>
            <div className="space-y-1">
              <p className="text-3xl md:text-4xl font-extrabold text-wa-green font-mono">256-bit</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Secure AES Encryption</p>
            </div>
          </div>
        </div>
      </section>


      {/* FAQS SECTION */}
      <section id="faq" className="max-w-4xl mx-auto px-6 py-16 border-t border-white/5 relative z-10">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <h3 className="font-extrabold text-xs uppercase text-wa-green tracking-widest mb-2">Help Center</h3>
          <h2 className="text-3xl font-extrabold tracking-tight">Frequently Asked Questions</h2>
          <p className="text-sm text-slate-400 mt-2">Answers to common questions about our platform and WhatsApp APIs.</p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, idx) => {
            const isOpen = activeFaq === idx;
            return (
              <div 
                key={idx} 
                className="bg-slate-900/30 border border-white/5 rounded-2xl overflow-hidden transition-all duration-300"
              >
                <button 
                  onClick={() => setActiveFaq(isOpen ? null : idx)}
                  className="w-full text-left p-5 flex items-center justify-between gap-4 font-bold text-sm text-white hover:bg-white/[0.02] transition-colors"
                >
                  <span>{faq.q}</span>
                  <ChevronDown className={`w-4 h-4 text-wa-green shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                <div 
                  className={`transition-all duration-300 ease-in-out overflow-hidden ${
                    isOpen ? 'max-h-40 border-t border-white/5' : 'max-h-0'
                  }`}
                >
                  <p className="p-5 text-xs text-slate-400 leading-relaxed bg-slate-950/20">
                    {faq.a}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/5 py-12 text-center text-xs text-slate-500 relative z-10 space-y-4 bg-slate-950/50">
        <div className="flex items-center justify-center gap-1.5 text-[9px] font-extrabold text-slate-400 uppercase tracking-widest bg-white/5 max-w-[220px] mx-auto py-1.5 px-4 rounded-full border border-white/5 shadow-inner">
          <Lock className="w-3.5 h-3.5 text-wa-green" />
          <span>Meta Cloud API Encryption</span>
        </div>
        <p>© {new Date().getFullYear()} WA Business Suite. Dedicated WABA Management Portal. All rights reserved.</p>
      </footer>

    </div>
  );
}
