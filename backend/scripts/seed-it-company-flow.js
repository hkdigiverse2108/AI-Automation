const { connectDB, disconnectDB } = require('../config/db');
const User = require('../models/User');
const BotFlow = require('../models/BotFlow');
const Conversation = require('../models/Conversation');

/**
 * Complete End-to-End IT Company Bot Flow for HK DigiVerse / Harikrushn DigiVerse LLP
 */
const flowData = {
  name: "🚀 HK DigiVerse - Complete IT Solutions & Services Bot",
  description: "Comprehensive end-to-end IT Company WhatsApp Bot covering all IT services, interactive menus, lead qualification, project quotation, portfolio, and consultant handoff.",
  trigger: {
    type: "keyword",
    keywords: [
      "hi", "hello", "hey", "start", "menu", "it", "services", "quote", 
      "software", "website", "app", "help", "કેમ છો", "નમસ્તે", "main menu"
    ]
  },
  isActive: true,
  nodes: [
    // -------------------------------------------------------------
    // NODE 1: WELCOME & MAIN MENU
    // -------------------------------------------------------------
    {
      id: "node_welcome",
      type: "question",
      position: { x: 500, y: 50 },
      data: {
        variable: "main_choice",
        message: {
          type: "list",
          header: "HK DigiVerse LLP",
          body: "👋 *Welcome to HK DigiVerse!* 🚀\n\nYour premier technology partner for cutting-edge Digital Transformation, Custom Software, Web & Mobile Apps, AI Automation, and Cloud Solutions.\n\nHow can we accelerate your business today?",
          footer: "Select an option below",
          sections: [
            {
              title: "Explore & Get Started",
              rows: [
                { id: "it_services", title: "🚀 Explore IT Services", description: "Web, App, Software, AI, Cloud & Marketing" },
                { id: "it_quote_start", title: "💡 Get Project Quote", description: "Get a customized estimate for your project" },
                { id: "it_portfolio", title: "📁 Portfolio & Demos", description: "Explore our live projects & client case studies" },
                { id: "it_about", title: "🏢 About HK DigiVerse", description: "Our company story, office location & contact" },
                { id: "it_human", title: "👨‍💻 Talk to Tech Expert", description: "Direct chat or call with our Senior IT Consultant" }
              ]
            }
          ]
        }
      },
      edges: [
        { targetNodeId: "node_services_menu", label: "it_services, 1, explore it services, services, સેવાઓ" },
        { targetNodeId: "node_quote_service", label: "it_quote_start, 2, get project quote, quote, અંદાજ" },
        { targetNodeId: "node_portfolio", label: "it_portfolio, 3, portfolio, demos, પોર્ટફોલિયો" },
        { targetNodeId: "node_about", label: "it_about, 4, about, contact, કંપની વિશે" },
        { targetNodeId: "node_human", label: "it_human, 5, talk to tech expert, human, consultant, એક્સપર્ટ" }
      ]
    },

    // -------------------------------------------------------------
    // NODE 2: ALL IT SERVICES LIST MENU
    // -------------------------------------------------------------
    {
      id: "node_services_menu",
      type: "question",
      position: { x: 500, y: 250 },
      data: {
        variable: "service",
        message: {
          type: "list",
          header: "HK DigiVerse Services",
          body: "🛠️ *Our Core IT & Digital Services*\n\nWe provide end-to-end technology solutions tailored to scale your enterprise. Please select a service to view full details:",
          footer: "Choose a service to view details",
          sections: [
            {
              title: "Software & Development",
              rows: [
                { id: "srv_web", title: "🌐 Web & E-Commerce", description: "Custom Web Apps, React/Next.js & Shopify" },
                { id: "srv_mobile", title: "📱 Mobile App Dev", description: "iOS, Android, Flutter & React Native" },
                { id: "srv_software", title: "💻 Custom ERP & CRM", description: "Tailored ERP, Billing, Inventory & SaaS" },
                { id: "srv_ai", title: "🤖 AI & WA Automation", description: "WhatsApp Business API Bots & AI Agents" }
              ]
            },
            {
              title: "Infrastructure & Growth",
              rows: [
                { id: "srv_cloud", title: "☁️ Cloud & DevOps", description: "AWS, Azure, GCP, CI/CD & Server Scaling" },
                { id: "srv_uiux", title: "🎨 UI/UX & Branding", description: "Figma App Design, Brand Kits & Graphics" },
                { id: "srv_marketing", title: "📈 Digital Marketing", description: "Meta/Google Ads, SEO & Growth Funnels" },
                { id: "srv_hire", title: "👥 Dedicated Tech Team", description: "Hire Full-Stack Developers & IT AMC Support" }
              ]
            }
          ]
        }
      },
      edges: [
        { targetNodeId: "node_detail_web", label: "srv_web, web, website, e-commerce" },
        { targetNodeId: "node_detail_mobile", label: "srv_mobile, mobile, app, android, ios" },
        { targetNodeId: "node_detail_software", label: "srv_software, software, erp, crm, billing" },
        { targetNodeId: "node_detail_ai", label: "srv_ai, ai, whatsapp, automation, bot" },
        { targetNodeId: "node_detail_cloud", label: "srv_cloud, cloud, devops, aws, azure" },
        { targetNodeId: "node_detail_uiux", label: "srv_uiux, uiux, ui, ux, design, branding" },
        { targetNodeId: "node_detail_marketing", label: "srv_marketing, marketing, seo, ads, digital" },
        { targetNodeId: "node_detail_hire", label: "srv_hire, hire, developers, team, amc" }
      ]
    },

    // -------------------------------------------------------------
    // NODE 3: WEB & E-COMMERCE DETAIL
    // -------------------------------------------------------------
    {
      id: "node_detail_web",
      type: "question",
      position: { x: 100, y: 500 },
      data: {
        variable: "action_web",
        message: {
          type: "buttons",
          text: "🌐 *Web & E-Commerce Development*\n\nWe build ultra-fast, responsive, SEO-ready web applications that drive real business revenue.\n\n✨ *What We Build:*\n• High-Converting Corporate Websites\n• Custom E-Commerce Portals (Shopify / WooCommerce / Custom)\n• Scalable Web Apps (Next.js, React, Node.js, Python)\n• Progressive Web Apps (PWA) & API Portals\n\n⚡ *Typical Timeline:* 2 to 4 Weeks\n🔒 *Security:* Enterprise SSL, Cloudflare & Fast CDN",
          buttons: [
            { id: "quote_web", title: "📝 Get Web Quote" },
            { id: "it_services", title: "🔙 All Services" },
            { id: "it_human", title: "💬 Talk to Expert" }
          ]
        }
      },
      edges: [
        { targetNodeId: "node_quote_scope", label: "quote_web, get web quote, quote, get quote" },
        { targetNodeId: "node_services_menu", label: "it_services, all services, back" },
        { targetNodeId: "node_human", label: "it_human, talk to expert" }
      ]
    },

    // -------------------------------------------------------------
    // NODE 4: MOBILE APP DEVELOPMENT DETAIL
    // -------------------------------------------------------------
    {
      id: "node_detail_mobile",
      type: "question",
      position: { x: 300, y: 500 },
      data: {
        variable: "action_mobile",
        message: {
          type: "buttons",
          text: "📱 *Mobile Application Development*\n\nNative & cross-platform apps with smooth 60 FPS performance and intuitive user experiences.\n\n✨ *Capabilities:*\n• Cross-Platform iOS & Android Apps (Flutter / React Native)\n• Native Kotlin & Swift Development\n• Payment Gateway & Biometric Login Integration\n• Real-Time Push Notifications & Offline Mode\n• App Store & Play Store Publishing & Maintenance\n\n⚡ *Typical Timeline:* 4 to 8 Weeks",
          buttons: [
            { id: "quote_mobile", title: "📝 Get App Quote" },
            { id: "it_services", title: "🔙 All Services" },
            { id: "it_human", title: "💬 Talk to Expert" }
          ]
        }
      },
      edges: [
        { targetNodeId: "node_quote_scope", label: "quote_mobile, get app quote, quote, get quote" },
        { targetNodeId: "node_services_menu", label: "it_services, all services, back" },
        { targetNodeId: "node_human", label: "it_human, talk to expert" }
      ]
    },

    // -------------------------------------------------------------
    // NODE 5: CUSTOM ERP & CRM DETAIL
    // -------------------------------------------------------------
    {
      id: "node_detail_software",
      type: "question",
      position: { x: 500, y: 500 },
      data: {
        variable: "action_software",
        message: {
          type: "buttons",
          text: "💻 *Custom ERP, CRM & Business Software*\n\nEliminate repetitive manual tasks and centralize your business operations in one intuitive cloud software.\n\n✨ *Solutions:*\n• Custom ERP for Manufacturing, Textile & Diamond Industries\n• Sales CRM with Lead Pipelines & Follow-up Tracking\n• Inventory, Billing & GST Invoicing Solutions\n• Multi-branch User Role & Permission Systems\n• Real-time Analytics & Business Intelligence Dashboards",
          buttons: [
            { id: "quote_software", title: "📝 Get Software Quote" },
            { id: "it_services", title: "🔙 All Services" },
            { id: "it_human", title: "💬 Talk to Expert" }
          ]
        }
      },
      edges: [
        { targetNodeId: "node_quote_scope", label: "quote_software, get software quote, quote, get quote" },
        { targetNodeId: "node_services_menu", label: "it_services, all services, back" },
        { targetNodeId: "node_human", label: "it_human, talk to expert" }
      ]
    },

    // -------------------------------------------------------------
    // NODE 6: AI & WHATSAPP AUTOMATION DETAIL
    // -------------------------------------------------------------
    {
      id: "node_detail_ai",
      type: "question",
      position: { x: 700, y: 500 },
      data: {
        variable: "action_ai",
        message: {
          type: "buttons",
          text: "🤖 *AI & WhatsApp Automation Solutions*\n\nTurn WhatsApp into your #1 automated sales & customer service channel 24/7.\n\n✨ *Features:*\n• Official Meta WhatsApp Business API Setup & Green Tick Verification\n• Automated Lead Qualification & Chatbot Flows\n• AI Sales Assistant (Powered by GPT-4 / Claude / Grok)\n• Broadcast Campaigns with High Delivery & Open Rates\n• Auto-sync with Google Sheets, Zoho, Salesforce & Custom CRMs",
          buttons: [
            { id: "quote_ai", title: "📝 Get AI Bot Quote" },
            { id: "it_services", title: "🔙 All Services" },
            { id: "it_human", title: "💬 Talk to Expert" }
          ]
        }
      },
      edges: [
        { targetNodeId: "node_quote_scope", label: "quote_ai, get ai bot quote, quote, get quote" },
        { targetNodeId: "node_services_menu", label: "it_services, all services, back" },
        { targetNodeId: "node_human", label: "it_human, talk to expert" }
      ]
    },

    // -------------------------------------------------------------
    // NODE 7: CLOUD & DEVOPS DETAIL
    // -------------------------------------------------------------
    {
      id: "node_detail_cloud",
      type: "question",
      position: { x: 900, y: 500 },
      data: {
        variable: "action_cloud",
        message: {
          type: "buttons",
          text: "☁️ *Cloud Infrastructure & DevOps*\n\nRobust, 99.99% uptime cloud architecture built to handle millions of concurrent users without breaking.\n\n✨ *Expertise:*\n• AWS, Google Cloud & Microsoft Azure Cloud Setup\n• Docker Containerization & Kubernetes Orchestration\n• CI/CD Pipeline Automation (GitHub Actions / GitLab CI)\n• Database Clustering, Automated Backups & Disaster Recovery\n• Server Security Hardening & Penetration Testing",
          buttons: [
            { id: "quote_cloud", title: "📝 Get Cloud Quote" },
            { id: "it_services", title: "🔙 All Services" },
            { id: "it_human", title: "💬 Talk to Expert" }
          ]
        }
      },
      edges: [
        { targetNodeId: "node_quote_scope", label: "quote_cloud, get cloud quote, quote, get quote" },
        { targetNodeId: "node_services_menu", label: "it_services, all services, back" },
        { targetNodeId: "node_human", label: "it_human, talk to expert" }
      ]
    },

    // -------------------------------------------------------------
    // NODE 8: UI/UX & BRAND DESIGN DETAIL
    // -------------------------------------------------------------
    {
      id: "node_detail_uiux",
      type: "question",
      position: { x: 100, y: 700 },
      data: {
        variable: "action_uiux",
        message: {
          type: "buttons",
          text: "🎨 *UI/UX & Brand Identity Design*\n\nWorld-class visuals and high-converting customer experiences designed to stand out.\n\n✨ *Deliverables:*\n• Complete Figma UI/UX Prototypes & Wireframes\n• User Journey Mapping & Conversion Optimization\n• Complete Brand Identity (Logo, Typography, Brand Guidelines)\n• Social Media Creatives & Marketing Collaterals\n• Design System & Design Tokens for Developers",
          buttons: [
            { id: "quote_uiux", title: "📝 Get Design Quote" },
            { id: "it_services", title: "🔙 All Services" },
            { id: "it_human", title: "💬 Talk to Expert" }
          ]
        }
      },
      edges: [
        { targetNodeId: "node_quote_scope", label: "quote_uiux, get design quote, quote, get quote" },
        { targetNodeId: "node_services_menu", label: "it_services, all services, back" },
        { targetNodeId: "node_human", label: "it_human, talk to expert" }
      ]
    },

    // -------------------------------------------------------------
    // NODE 9: DIGITAL MARKETING & SEO DETAIL
    // -------------------------------------------------------------
    {
      id: "node_detail_marketing",
      type: "question",
      position: { x: 300, y: 700 },
      data: {
        variable: "action_marketing",
        message: {
          type: "buttons",
          text: "📈 *Digital Marketing & Performance SEO*\n\nGenerate qualified inbound leads and rank #1 on Google with data-driven marketing.\n\n✨ *Growth Channels:*\n• Meta (Facebook & Instagram) Targeted Lead Generation Ads\n• Google Search & Display PPC Campaign Management\n• Technical & On-Page SEO for #1 Keyword Rankings\n• Content Marketing & Social Media Brand Building\n• Complete Funnel Optimization & Conversion Rate Growth",
          buttons: [
            { id: "quote_marketing", title: "📝 Marketing Quote" },
            { id: "it_services", title: "🔙 All Services" },
            { id: "it_human", title: "💬 Talk to Expert" }
          ]
        }
      },
      edges: [
        { targetNodeId: "node_quote_scope", label: "quote_marketing, get marketing quote, quote, get quote" },
        { targetNodeId: "node_services_menu", label: "it_services, all services, back" },
        { targetNodeId: "node_human", label: "it_human, talk to expert" }
      ]
    },

    // -------------------------------------------------------------
    // NODE 10: DEDICATED DEVELOPERS & AMC DETAIL
    // -------------------------------------------------------------
    {
      id: "node_detail_hire",
      type: "question",
      position: { x: 500, y: 700 },
      data: {
        variable: "action_hire",
        message: {
          type: "buttons",
          text: "👥 *Hire Dedicated Developers & IT AMC*\n\nScale your in-house tech team instantly with dedicated pre-vetted engineers.\n\n✨ *Hiring Models:*\n• Dedicated Full-Stack Developers (React, Node, Python, Next.js)\n• Dedicated Mobile Engineers (Flutter / React Native / iOS / Android)\n• Annual Maintenance Contracts (AMC) for 24/7 Uptime & Bug Fixes\n• Flexible Monthly Retainers or Project-Based Hiring\n• Zero Recruitment Hassle & Daily Work Reporting",
          buttons: [
            { id: "quote_hire", title: "📝 Hire Developers" },
            { id: "it_services", title: "🔙 All Services" },
            { id: "it_human", title: "💬 Talk to Expert" }
          ]
        }
      },
      edges: [
        { targetNodeId: "node_quote_scope", label: "quote_hire, hire developers, quote, get quote" },
        { targetNodeId: "node_services_menu", label: "it_services, all services, back" },
        { targetNodeId: "node_human", label: "it_human, talk to expert" }
      ]
    },

    // -------------------------------------------------------------
    // NODE 11: QUOTE STEP 1 (SERVICE SELECTION)
    // -------------------------------------------------------------
    {
      id: "node_quote_service",
      type: "question",
      position: { x: 100, y: 950 },
      data: {
        variable: "service",
        message: {
          type: "list",
          header: "Project Quotation",
          body: "💡 *Step 1 of 4: Which service do you need a quotation for?*\n\nPlease select the primary service required for your project:",
          footer: "Select a service",
          sections: [
            {
              title: "Choose Project Type",
              rows: [
                { id: "Web Development", title: "🌐 Web Development", description: "Websites, E-Commerce & Web Applications" },
                { id: "Mobile App Development", title: "📱 Mobile App Development", description: "Android, iOS & Cross-Platform Apps" },
                { id: "Custom ERP & CRM", title: "💻 Custom Software / ERP", description: "Business ERP, CRM & Billing Software" },
                { id: "AI & WhatsApp Automation", title: "🤖 AI & Automation", description: "Chatbots, API integrations & AI Agents" },
                { id: "UI/UX & Branding", title: "🎨 UI/UX & Graphic Design", description: "Figma UI/UX, Logos & Brand Identity" },
                { id: "Digital Marketing & SEO", title: "📈 Digital Marketing", description: "Meta/Google Ads & Organic SEO" },
                { id: "Hire Dedicated Developers", title: "👥 Dedicated Tech Team", description: "Full-stack Developers & IT AMC" }
              ]
            }
          ]
        }
      },
      edges: [
        { targetNodeId: "node_quote_scope", label: "default" }
      ]
    },

    // -------------------------------------------------------------
    // NODE 12: QUOTE STEP 2 (PROJECT SCOPE)
    // -------------------------------------------------------------
    {
      id: "node_quote_scope",
      type: "question",
      position: { x: 300, y: 950 },
      data: {
        variable: "project_scope",
        message: {
          type: "list",
          header: "Project Scope",
          body: "📋 *Step 2 of 4: What is the current status / scope of your project?*",
          footer: "Select project scope",
          sections: [
            {
              title: "Project Scope",
              rows: [
                { id: "Brand New Project", title: "🆕 Brand New Project", description: "Starting completely from scratch (Idea to Launch)" },
                { id: "Redesign & Revamp", title: "🔄 Redesign & Upgrade", description: "Modernizing an existing website/app/software" },
                { id: "Add New Features", title: "⚡ Add New Features", description: "Adding specific modules or integrations" },
                { id: "Ongoing AMC & Support", title: "🛠️ AMC & Maintenance", description: "Long-term maintenance, bug fixes & support" }
              ]
            }
          ]
        }
      },
      edges: [
        { targetNodeId: "node_quote_timeline", label: "default" }
      ]
    },

    // -------------------------------------------------------------
    // NODE 13: QUOTE STEP 3 (TIMELINE)
    // -------------------------------------------------------------
    {
      id: "node_quote_timeline",
      type: "question",
      position: { x: 500, y: 950 },
      data: {
        variable: "timeline",
        message: {
          type: "buttons",
          text: "⏱️ *Step 3 of 4: What is your preferred project launch timeline?*",
          buttons: [
            { id: "time_urgent", title: "⚡ Urgent (< 2 Weeks)" },
            { id: "time_medium", title: "📅 1 - 2 Months" },
            { id: "time_flexible", title: "⏳ Flexible Timeline" }
          ]
        }
      },
      edges: [
        { targetNodeId: "node_quote_budget", label: "time_urgent, urgent, 2 weeks, 1" },
        { targetNodeId: "node_quote_budget", label: "time_medium, 1 month, 2 months, 2" },
        { targetNodeId: "node_quote_budget", label: "time_flexible, flexible, planning, flexible / plannin, flexible timeline, 3, default" }
      ]
    },

    // -------------------------------------------------------------
    // NODE 14: QUOTE STEP 4 (BUDGET ESTIMATION)
    // -------------------------------------------------------------
    {
      id: "node_quote_budget",
      type: "question",
      position: { x: 700, y: 950 },
      data: {
        variable: "budget",
        message: {
          type: "list",
          header: "Estimated Budget",
          body: "💰 *Step 4 of 4: What is your estimated investment budget?*\n\nThis helps us propose the best technical stack and architecture for your goals:",
          footer: "Select your budget tier",
          sections: [
            {
              title: "Budget Range (INR)",
              rows: [
                { id: "budget_starter", title: "₹15k – ₹40k", description: "Startup / Single Landing Page / MVP" },
                { id: "budget_growth", title: "₹40k – ₹1.25 Lakh", description: "Business Website, E-Commerce, Chatbot" },
                { id: "budget_pro", title: "₹1.25L – ₹3.5 Lakh", description: "Full Custom Mobile App / Cloud ERP" },
                { id: "budget_enterprise", title: "Above ₹3.5 Lakhs", description: "Enterprise Scalable Platform / SaaS" }
              ]
            }
          ]
        }
      },
      edges: [
        { targetNodeId: "node_quote_name", label: "default" }
      ]
    },

    // -------------------------------------------------------------
    // NODE 15: CLIENT NAME & DETAILS
    // -------------------------------------------------------------
    {
      id: "node_quote_name",
      type: "question",
      position: { x: 900, y: 950 },
      data: {
        variable: "customer_name",
        message: {
          type: "text",
          body: "👤 *Almost done!*\n\nPlease share your *Full Name* and *Company Name* (or simply your name) so our Senior Technical Consultant can address you properly:"
        }
      },
      edges: [
        { targetNodeId: "node_quote_confirm", label: "default" }
      ]
    },

    // -------------------------------------------------------------
    // NODE 16: QUOTATION CONFIRMATION & CRM LEAD SCORE
    // -------------------------------------------------------------
    {
      id: "node_quote_confirm",
      type: "question",
      position: { x: 900, y: 1150 },
      data: {
        variable: "meeting_preference",
        message: {
          type: "buttons",
          text: "🎉 *Thank You! Your Request Has Been Successfully Received.* 🚀\n\n📋 *Requirement Summary:*\n• Service: {{service}}\n• Scope: {{project_scope}}\n• Timeline: {{timeline}}\n• Budget: {{budget}}\n\nOur Solutions Architect is reviewing your requirements and will reach out to you within *30 minutes* with a customized proposal.\n\nWould you like to schedule a quick 10-minute discovery call?",
          buttons: [
            { id: "call_yes", title: "📞 Yes, Call Me Soon" },
            { id: "it_portfolio", title: "📁 View Portfolio" },
            { id: "it_main_menu", title: "🔙 Main Menu" }
          ]
        }
      },
      edges: [
        { targetNodeId: "node_human", label: "call_yes, yes, call me soon, call" },
        { targetNodeId: "node_portfolio", label: "it_portfolio, view portfolio, portfolio" },
        { targetNodeId: "node_welcome", label: "it_main_menu, main menu, back, menu, default" }
      ]
    },

    // -------------------------------------------------------------
    // NODE 17: PORTFOLIO & CASE STUDIES
    // -------------------------------------------------------------
    {
      id: "node_portfolio",
      type: "question",
      position: { x: 100, y: 1200 },
      data: {
        variable: "portfolio_action",
        message: {
          type: "buttons",
          text: "📁 *HK DigiVerse Portfolio & Highlights* 🏆\n\nOver the past years, we have delivered 100+ successful projects across India & globally:\n\n✨ *Recent Highlights:*\n• 🛍️ *Diamond & Jewellery E-Commerce*: Ultra-fast catalog with 50,000+ products.\n• 🏭 *Textile ERP & Production Suite*: Automated order tracking from weaving to dispatch.\n• 🤖 *AI WhatsApp Automation Platform*: Real-time CRM, bots & campaign engine.\n• 🏥 *Healthcare Tele-Consultation App*: Video calls, prescription & appointment booking.\n\n🌐 *Live Website & Case Studies:*\nhttps://hkdigiverse.com\nhttps://automation.hkdigiverse.com",
          buttons: [
            { id: "it_quote_start", title: "💡 Get a Quote" },
            { id: "it_services", title: "🚀 Our Services" },
            { id: "it_main_menu", title: "🔙 Main Menu" }
          ]
        }
      },
      edges: [
        { targetNodeId: "node_quote_service", label: "it_quote_start, quote, get quote" },
        { targetNodeId: "node_services_menu", label: "it_services, services" },
        { targetNodeId: "node_welcome", label: "it_main_menu, main menu, menu, back, default" }
      ]
    },

    // -------------------------------------------------------------
    // NODE 18: ABOUT HK DIGIVERSE & CONTACT INFO
    // -------------------------------------------------------------
    {
      id: "node_about",
      type: "question",
      position: { x: 300, y: 1200 },
      data: {
        variable: "about_action",
        message: {
          type: "buttons",
          text: "🏢 *About HariKrushn DigiVerse LLP (HK DigiVerse)*\n\nWe are a full-cycle technology, automation, and digital growth agency helping modern businesses scale using modern tech stacks.\n\n📍 *Office Address:*\nSilver Trade Center, Mota Varachha,\nSurat, Gujarat - 394101\n\n⏰ *Business Hours:*\nMonday – Saturday: 9:30 AM to 7:00 PM\n\n📧 *Email:* contact@hkdigiverse.com\n🌐 *Website:* https://hkdigiverse.com\n📞 *Direct Phone:* +91 87805 64463 / +91 92658 52942",
          buttons: [
            { id: "it_services", title: "🚀 Explore Services" },
            { id: "it_human", title: "👨‍💻 Talk to Consultant" },
            { id: "it_main_menu", title: "🔙 Main Menu" }
          ]
        }
      },
      edges: [
        { targetNodeId: "node_services_menu", label: "it_services, services" },
        { targetNodeId: "node_human", label: "it_human, consultant, talk" },
        { targetNodeId: "node_welcome", label: "it_main_menu, main menu, back, menu, default" }
      ]
    },

    // -------------------------------------------------------------
    // NODE 19: TALK TO HUMAN / CONSULTANT HANDOFF
    // -------------------------------------------------------------
    {
      id: "node_human",
      type: "handoff",
      position: { x: 500, y: 1200 },
      data: {
        message: {
          type: "text",
          body: "👨‍💻 *Connecting you with a Senior IT Consultant!* ⚡\n\nOur team has been notified and a specialist will jump on this chat shortly.\n\n📞 If you need urgent assistance, you can also call us directly at *+91 87805 64463*.\n\nType *'menu'* anytime to return to the Main Menu. Have a wonderful day!"
        }
      },
      edges: []
    }
  ],
  entryNodeId: "node_welcome",
  totalSessions: 0,
  completionRate: 0
};

async function seed() {
  try {
    await connectDB();
    console.log('Connecting to database and deploying IT Company Bot Flow...');

    const users = await User.find({
      email: { $in: ['princegajera0506@gmail.com', 'hk@gmail.com'] }
    });

    if (users.length === 0) {
      console.log('No matching users found!');
      return;
    }

    for (const user of users) {
      console.log(`\nProcessing user: ${user.email} (${user._id})...`);

      // Deactivate old flows
      await BotFlow.updateMany(
        { userId: user._id },
        { $set: { isActive: false } }
      );

      // Check if this flow already exists
      let flow = await BotFlow.findOne({
        userId: user._id,
        name: flowData.name
      });

      if (flow) {
        flow.nodes = flowData.nodes;
        flow.edges = flowData.edges || [];
        flow.trigger = flowData.trigger;
        flow.description = flowData.description;
        flow.entryNodeId = flowData.entryNodeId;
        flow.isActive = true;
        await flow.save();
        console.log(`  - Updated existing IT Company flow (ID: ${flow._id}) to ACTIVE`);
      } else {
        flow = await BotFlow.create({
          ...flowData,
          userId: user._id,
          isActive: true
        });
        console.log(`  - Created new IT Company flow (ID: ${flow._id}) as ACTIVE`);
      }

      // Reset any active conversations for this user so they start fresh
      const resetResult = await Conversation.updateMany(
        { userId: user._id },
        {
          $set: {
            currentFlowId: flow._id,
            currentNodeId: null,
            status: 'bot',
            takeover_status: 'ai',
            lock_status: false,
            assignedAgent: null,
            assigned_agent_id: null,
            flowVariables: new Map()
          }
        }
      );
      console.log(`  - Reset ${resetResult.modifiedCount} conversations to start fresh with the new IT flow.`);
    }

    console.log('\n✅ Successfully deployed and activated HK DigiVerse IT Company Bot Flow!');
  } catch (err) {
    console.error('Seeding error:', err);
  } finally {
    await disconnectDB();
    process.exit(0);
  }
}

seed();
