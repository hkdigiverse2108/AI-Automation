# WhatsApp Business SaaS — Complete UI Specification

> **Platform Name**: WA Business Marketing Suite  
> **Tech Stack**: Next.js (Frontend) + Node.js/Express (Backend) + MongoDB + Socket.IO  
> **Theme**: WhatsApp-native green (#00a884) with glassmorphism, dark/light mode  
> **3 User Roles**: Super Admin, Organization Admin, Agent (Telecaller)

---

## 🔐 PAGE 1: Login Page (`/login`)

**Layout**: Full-screen split panel on a green header band

### Left Panel — Auth Form
- **Brand Logo**: WhatsApp icon + "WA Business" title + "Marketing Suite" subtitle
- **Step-by-step instructions**: 3 numbered steps (email → password → 2FA if enabled)
- **Form Fields**:
  - `Email Address` — text input with placeholder "e.g. user@enterprise.com"
  - `Password` — password input with **eye/eye-off toggle** button
- **Checkboxes**: "Remember credentials"
- **Links**: "Forgot credentials?" link
- **Primary Button**: `Sign In to Console →` (green, full-width, with arrow icon)
- **Footer text**: "New admin accounts are created only by the Super Admin..."

### 2FA Challenge Screen (conditional)
- Title: "Two-Factor Security" with shield icon
- **Input**: 6-digit TOTP code input (monospaced, tracking-wide, centered)
- **Button**: `Verify & Unlock` (green, full-width)
- **Link**: "Back to credentials login"

### Right Panel (Desktop only)
- Simulated faux QR code box with WhatsApp branding
- "Sandbox Mode Active" badge

---

## 📊 PAGE 2: Dashboard Home (`/dashboard`)

**Layout**: Stat cards grid + charts grid + quick actions

### Header Bar
- **Greeting**: "Good morning, [name] 👋" with dynamic time-of-day
- **Status badge**: "System Online" (green dot)

### Stat Cards (8 cards in a row on desktop)
| Card | Icon | Value |
|------|------|-------|
| Total Contacts | Users | Count |
| Total Templates | FileText | Count |
| Unread Chats | Inbox | Count |
| Sent Today | MessageSquare | Count |
| Active Chats | Radio | Count |
| Campaigns | Megaphone | Count |
| Bot Sessions | Bot | Count |
| Delivery Rate | TrendingUp | Percentage |

Each card has: icon badge, trend arrow (↑/↓), percentage change

### Charts Section (2×2 grid)
1. **Messages Area Chart** — "Messages — Last 7 Days" (green gradient area)
2. **Conversations by Source Bar Chart** — multi-color bars
3. **Conversation Status Donut/Pie Chart** — segments: bot, human, waiting, completed
4. **Quick Actions Grid** — 4 large icon buttons:
   - `New Campaign` (green)
   - `Import Contacts` (blue)
   - `Create Bot Flow` (purple)
   - `Open Inbox` (amber)

---

## 💬 PAGE 3: Inbox (`/dashboard/inbox`)

**Layout**: 3-panel split (contact list | chat window | contact details)  
**Mobile**: Single panel with back-arrow navigation

### Left Panel — Conversation List
- **Search bar**: Search contacts by name/phone
- **Filter tabs**: All | Unread | Bot | Human | Waiting
- **Conversation cards** (scrollable list):
  - Contact avatar (initials circle)
  - Contact name (bold)
  - Last message preview (truncated)
  - Timestamp
  - Unread count badge (green circle)
  - Status indicator (bot/human/waiting dot)

### Center Panel — Chat Window
- **Header bar**: Contact avatar + name + phone + status + action buttons
  - Buttons: `Assign Agent`, `Mark as Resolved`, `Close Chat`
- **Message stream** (scrollable):
  - Outbound messages (green bubbles, right-aligned)
  - Inbound messages (white/dark bubbles, left-aligned)
  - Image messages with preview thumbnails
  - Interactive messages (button lists, list menus)
  - System messages (centered, gray, italic)
  - Timestamps between message groups
  - Read receipts (✓✓ blue ticks)
- **Input bar** (bottom):
  - Text input field with placeholder "Type a message..."
  - **Emoji picker** button
  - **Attach file** button
  - **Send** button (green)
  - **Template picker** dropdown button

### Right Panel — Contact Details Sidebar
- Contact avatar + name + phone
- **Tags**: Editable tag chips with + button
- **Contact Score Card**: Animated SVG gauge arc showing engagement score (0-100)
  - Segment badge: Hot 🔥 / Warm / Cold / New
  - Score breakdown bars: Volume, Recency, Response Ratio
- **Quick actions**: Edit Contact, View History, Block
- **Notes section**: Free-text notes area

---

## 👥 PAGE 4: Contacts / Subscribers (`/dashboard/contacts`)

**Layout**: Header + filters + table (desktop) / card list (mobile)

### Header
- Title: "Subscribers"
- **Buttons**: `+ Add Contact`, `Import CSV`, `Export`, `Recalculate Scores`

### Filters Bar
- **Search**: Name/phone/email search input
- **Segment filter dropdown**: All | Hot | Warm | Cold | New
- **Source filter**: All | WhatsApp | Manual | Import | Bot
- **Status filter**: Active | Blocked

### Desktop Table Columns
| Column | Type |
|--------|------|
| Avatar + Name | Text + initials circle |
| Phone | Monospaced text |
| Email | Text |
| Source | Badge (whatsapp/manual/import) |
| Tags | Colored tag chips |
| Engagement Score | ScoreBadge meter (colored arc) |
| Segment | Badge (Hot🔥/Warm/Cold/New) |
| Status | Active/Blocked toggle |
| Actions | Message, Edit, Delete buttons |

### Mobile Card Layout
- Cards with: Name, phone, email, tags, score badge, action buttons

### Contact Edit Modal
- Fields: Name, Phone, Email, Tags (multi-select chip input), Notes
- Buttons: `Save`, `Cancel`

### Score Card Component (ContactScoreCard)
- Animated SVG gauge arc (0-100 with color gradient)
- Score metrics progress bars:
  - Engagement Volume (40%)
  - Recency (30%)
  - Response Ratio (30%)
- Segment color configuration

---

## 👥 PAGE 5: Team Management (`/dashboard/team`)

**Layout**: Header + member cards/table

### Header
- Title: "Team Members"
- **Button**: `+ Invite Member`

### Team Members Table
| Column | Type |
|--------|------|
| Avatar + Name | Text |
| Email | Text |
| Role | Badge (admin/agent) |
| Status | Active/Inactive badge |
| Last Active | Timestamp |
| Actions | Edit, Reset Password, Deactivate, Delete |

### Invite/Edit Member Modal
- Fields: Name, Email, Username, Password, Role (dropdown: admin/agent)
- Buttons: `Create Member`, `Cancel`

---

## 📢 PAGE 6: Campaigns (`/dashboard/campaigns`)

**Layout**: Header + stat cards + campaigns table + form modal

### Header
- Title: "Blast Campaigns"
- **Button**: `+ New Campaign` (green)

### Stat Cards (4 cards)
| Card | Icon |
|------|------|
| Active Running | Animated green pulse dot |
| Scheduled | Calendar icon |
| Completed | CheckCircle icon |
| Total Sent | BarChart icon |

### Campaigns Table
| Column | Type |
|--------|------|
| Campaign Name | Bold text |
| Template | Mono text |
| Target | "All Contacts" or "Tags: x, y" |
| Date | Formatted datetime |
| Status | Badge: Running(green pulse)/Scheduled(amber)/Completed(green)/Paused(purple)/Failed(red)/Draft(gray) |
| Delivery | Progress bar + sent/delivered/failed counts |
| Actions | Start▶️, Pause⏸️, Resume▶️, Edit✏️, Delete🗑️ |

### Campaign Form Modal (CampaignForm component)
- **Fields**:
  - Campaign Name (text input)
  - Template Name (dropdown selector)
  - Template Body Preview (read-only rich text)
  - Audience Selector: `All Contacts` or `By Tags` (multi-select tag chips)
  - Schedule Type: `Send Now` or `Schedule Later` (date/time picker)
  - Template Variables (dynamic placeholder inputs based on template)
- **Buttons**: `Create Campaign`, `Update Campaign`, `Cancel`

---

## 📝 PAGE 7: Templates (`/dashboard/templates`)

**Layout**: Header + templates grid/list

### Header
- Title: "Message Templates"
- **Button**: `+ Create Template`

### Template Cards Grid
- Template name
- Category badge (marketing/utility/authentication)
- Status badge (approved/pending/rejected)
- Language
- Body text preview
- **Buttons**: Edit, Delete, Use in Campaign

---

## 🤖 PAGE 8: Bot Builder (`/dashboard/bot-builder`)

**Layout**: Bot selector + tab switcher + full-height canvas/media library

### Top Bar
- Bot Flow selector dropdown (list of existing bots)
- **Buttons**: `+ New Bot Flow`, `Save`, `Delete Flow`

### Tab Switcher (2 tabs)
- **Tab 1: Workflow Builder** 🛠️
- **Tab 2: Media Library** 🖼️

---

### TAB 1: Workflow Builder (BotFlowCanvas)

#### Left Sidebar Panel
- **Trigger Configuration**:
  - Trigger Type dropdown: `Keyword Match` / `All Messages` / `Button Reply`
  - Keywords input (comma-separated)
- **Flow Blocks** (draggable node buttons):
  | Block | Icon | Color |
  |-------|------|-------|
  | Send Message | MessageSquare | Green |
  | Ask Question | HelpCircle | Blue |
  | Condition | GitFork | Amber |
  | AI Agent | Bot | Purple |
  | Wait Delay | Clock | Pink |
  | Human Handoff | UserCheck | Red |
- **Actions Section**:
  - `Undo` / `Redo` buttons
  - `Fit to View` button
  - Keyboard shortcuts guide (Ctrl+Z, Ctrl+Y, Ctrl+S, Del)
- **Save Button**: `Save Builder Flow` (green, full-width)

#### Center — ReactFlow Canvas
- Drag-and-drop visual node graph
- Snap-to-grid (16px)
- Animated green edge connections with arrow markers
- MiniMap (bottom-right corner)
- Zoom Controls (bottom-left corner)
- **Status bar** (bottom): "X blocks · Y connections · Snap: 16px grid · History: N/M"

#### Right Drawer — Node Editor (slides in when node clicked)
- **Header**: Node type icon + "[Type] Block" title + Close (X) button

##### Message Block Editor:
- **Message Type dropdown**: `Outbound Text Message` / `Image Attachment`
- If Text:
  - `Message Text Copy` textarea
  - **🖼️ Attach Image** drag-and-drop box:
    - Dashed border container
    - Upload cloud icon
    - "Drag & drop image here" text
    - "or click to select from computer" subtext
    - Loading spinner during upload
- If Image:
  - `Image Source Asset` dropdown (from Media Library)
  - Image preview thumbnail
  - `Image Caption` textarea
  - **Remove Image Attachment** button (red outline)
- **Delete Block** button (red outline, bottom)

##### Question Block Editor:
- **Question Type dropdown**: `Outbound Text Question` / `Image Attachment Question`
- Same image attachment UI as Message Block
- `Store Answer in Variable` text input (e.g. "user_choice")
- Instructions text about downstream conditionals

##### Condition Block Editor:
- Info box: "Connect TRUE output to one path, FALSE to another"
- `Target Variable name` input
- `Operator` dropdown: equals / contains / not_equals / exists
- `Match Value` input

##### Delay Block Editor:
- `Delay Duration (seconds)` number input

##### AI Agent Block Editor:
- `AI Prompt` textarea

##### Handoff Block Editor:
- Info text about routing to human agents

#### Canvas Node Cards (CustomBotNodes):
Each node on the canvas displays:
- Colored header bar with icon + type label
- Configuration status indicator (green ✓ or amber ⚠️ pulse)
- Body preview: text snippet or asset key badge
- Connection handles (top input, bottom output)

---

### TAB 2: Media Library (BotMediaLibrary)

#### Upload Section
- **Drag & Drop Zone**: Large dashed-border area
  - Cloud upload icon
  - "Drag and drop image files here" text
  - "or click to browse" subtext
  - File format hint: "JPG, PNG, WEBP — Max 10MB"
- **Custom Asset Key input** (optional uppercase input)
- **Upload button**: `Upload Asset` (green)

#### Assets Grid
Each asset card shows:
- Image thumbnail preview
- Asset Key badge (monospaced, e.g. `IMG_001`, `RIDE`)
- File name
- File size
- Usage count badge
- Status badge: 🟢 Used / ⚪ Unused
- **Action buttons**:
  - `Copy Key` (clipboard icon)
  - `Rename Key` (edit icon → inline input + save)
  - `Replace File` (upload icon → file picker)
  - `Delete` (trash icon, blocked if in-use)

#### Filters
- Search bar (by key/filename)
- Filter dropdown: All / Used / Unused

#### Scan & Migrate Banner
- Warning banner for legacy flows with direct URLs
- `Scan & Migrate Legacy Images` button

---

## 📊 PAGE 9: Analytics (`/dashboard/analytics`)

**Layout**: Period selector + overview cards + charts grid

### Header
- Title: "Analytics"
- **Period selector**: 7 Days / 30 Days / 90 Days (button group)
- **Refresh button**

### Overview Stat Cards (6 cards)
| Card | Description |
|------|-------------|
| Total Messages | Inbound + outbound count |
| Active Contacts | Unique contacts engaged |
| Response Rate | Percentage |
| Avg Response Time | Minutes/hours |
| Bot Automation Rate | Percentage handled by bot |
| Campaign Reach | Total recipients reached |

### Charts Section
1. **Message Trends** — Dual-line area chart (inbound vs outbound over time)
2. **Contact Growth** — Area chart showing new contacts per day
3. **Campaign Performance** — Bar chart (sent/delivered/read/failed per campaign)
4. **Hourly Activity Heatmap** — Activity intensity by hour of day
5. **Conversation Status Distribution** — Pie/donut chart
6. **Conversations by Source** — Bar chart

---

## 📋 PAGE 10: Chat Logs (`/dashboard/chat-logs`)

**Layout**: Header + filterable logs table

### Header
- Title: "Text History Logs" / "Audit Logs"

### Filters
- Date range picker
- Contact search
- Direction filter: All / Inbound / Outbound

### Logs Table
| Column | Type |
|--------|------|
| Timestamp | Formatted datetime |
| Contact Name | Decrypted text |
| Phone | Decrypted text |
| Direction | Inbound ↓ / Outbound ↑ badge |
| Message Content | Decrypted text (truncated) |
| Type | text/image/interactive badge |
| Status | sent/delivered/read/failed badge |

---

## ⚙️ PAGE 11: Settings (`/dashboard/settings`)

**Layout**: Tab bar + tab content panels

### Settings Tabs
| Tab | Icon | Visible To |
|-----|------|-----------|
| My Profile | User | All |
| Meta Integrations | Globe | Admin only |
| API Settings | Key | All |
| API Docs | Terminal | All |
| Two-Factor Lock | Shield | All |

---

### Tab: My Profile
- **Avatar Selector**: 6 colored circle options (Emerald, Teal, Indigo, Violet, Rose, Amber)
- **Fields**:
  - Display Name (text input)
  - Email (read-only)
  - Role (read-only badge)
  - Organization (read-only)
- **Button**: `Save Profile` (green)

### Tab: Meta Integrations
**Sub-tabs**: WhatsApp | Facebook | Instagram

#### WhatsApp Integration:
- **Fields**:
  - App ID
  - App Secret (with show/hide toggle)
  - Permanent Access Token (with show/hide toggle)
  - Phone Number ID
  - WABA ID
  - Verify Token
  - Business Manager ID
  - Token Lifespan selector
- **Connection Status**: Connected ✅ / Disconnected ❌ / Error ⚠️ badge
- **Buttons**:
  - `Test Connection` (blue)
  - `Save Configuration` (green)
  - `Disconnect` (red outline)

#### Facebook / Instagram Integration:
- Similar field layout with platform-specific IDs and tokens
- Test/Save/Disconnect buttons

### Tab: API Settings
- **Current API Key display** (masked with copy button)
- **Key metadata**: Created date, scope, last used
- **Scope selector**: Read / Read+Write dropdown
- **Buttons**:
  - `Generate New API Key` (green)
  - `Revoke API Key` (red outline, with confirmation)
- **New key display** (shown once after generation, copyable)

### Tab: API Docs
- Interactive REST API documentation
- Endpoint listings with method badges (GET/POST/PUT/DELETE)
- Request/response examples
- Authentication header instructions

### Tab: Two-Factor Lock (2FA)
- **Step 1**: Info card explaining 2FA + `Enable 2FA` button
- **Step 2**: QR code display + manual secret key (copyable) + verification code input
- **Step 3**: Success confirmation with green checkmark
- **Button**: `Verify & Enable` (green)

---

## 🏢 PAGE 12: Super Admin Panel (`/dashboard/admin`)

**Layout**: Tab bar + tab content panels  
**Access**: Super Admin role only

### Admin Tabs
| Tab | Icon |
|-----|------|
| Organizations | Building |
| Organization Admins | Shield |
| Subscriptions | Zap |
| Security Center | Lock |
| Reports | FileText |

---

### Tab: Organizations
- **Search bar**: Filter organizations
- **Button**: `+ Create Organization`
- **Organizations Table**:
  | Column | Type |
  |--------|------|
  | Logo | Thumbnail |
  | Organization Name | Bold text |
  | Industry | Text |
  | Admin | Name + email |
  | Plan | Badge (free/starter/pro/enterprise) |
  | Status | Active/Suspended badge |
  | Created | Date |
  | Actions | Edit, Reset Admin Password, Delete |

### Create/Edit Organization Modal
- **Fields**:
  - Organization Name, Business Type, Industry, Website
  - Address, City, State, Country
  - GST Number
  - Contact Person, Contact Email, Contact Number
  - Plan selector (free/starter/pro/enterprise)
  - Max Telecallers, Max Leads, Max Monthly Conversations
  - Logo upload (drag & drop with preview)
- **Admin Account Fields** (create only):
  - Admin Name, Admin Email, Admin Username, Admin Password
- **Buttons**: `Create Organization`, `Update Organization`, `Cancel`

### Password Reset Modal
- Fields: Email (read-only), New Password
- **Button**: `Reset Password` + sends email notification

---

## 🔔 Notification Center (Global Component — top bar)

**Layout**: Bell icon button + slide-out drawer

### Bell Icon Button
- Unread count badge (red circle with number)
- Animated ring on new notification

### Notification Drawer (right slide-out panel)
- **Header**: "Notification Center" + Close (X) button
- **Tab filters**: All | System | Campaign | Contact | Bot | Team | Message
- **Delete All button**: `🗑️ Delete All` (red text)
- **Notification Cards** (scrollable list):
  - Category icon (color-coded)
  - Title (bold)
  - Message body (truncated)
  - Timestamp (relative: "2 min ago")
  - Read/unread indicator (blue dot)
  - **Actions**: Mark as read, Delete individual

---

## 📱 Sidebar Navigation (Global Component)

### Desktop: Fixed left sidebar (240px, collapsible to 68px)
### Mobile: Slide-over drawer with dark backdrop

### Brand Header
- WhatsApp icon + "WA Business" + "Marketing Suite"
- Collapse/expand toggle button

### Navigation Sections (Admin Role)

| Section | Items |
|---------|-------|
| **Main** | Dashboard, Inbox (with unread badge), Contacts, Team |
| **Marketing** | Campaigns, Templates |
| **Automation** | Bot Builder |
| **Insights** | Analytics |
| **System** | Chat Logs, Settings |

### Navigation (Agent Role)
- Inbox only

### Navigation (Super Admin Role)
| Item | Icon |
|------|------|
| Dashboard | LayoutDashboard |
| Organizations | Building |
| Organization Admins | Shield |
| Telecallers | Users2 |
| Conversations | MessageSquare |
| Analytics | BarChart3 |
| Subscriptions | Zap |
| Integrations | Globe |
| AI Management | Bot |
| Security Center | Lock |
| Audit Logs | Terminal |
| Reports | FileText |
| System Settings | Settings |
| Logout | LogOut |

### Sidebar Footer
- User avatar (colored initials circle)
- User name + role badge
- Dark/Light mode toggle (Sun/Moon icons)
- User menu dropdown: Profile, Settings, Logout

---

## 📐 Top Bar / Mobile Header (Global Component)

### Desktop Top Bar
- Hamburger button (mobile only)
- Page title breadcrumb
- **Right side**: Notification bell + User avatar initials

### Mobile Top Bar (sticky, 60px height)
- Hamburger menu trigger
- App logo
- Notification bell
- User profile initials circle

---

## 🎨 Design System / Theme Tokens

### Colors
| Token | Light | Dark |
|-------|-------|------|
| Primary Green | `#00a884` | `#00a884` |
| Background | `#f0f2f5` | `#0b141a` |
| Panel | `#ffffff` | `#111b21` |
| Panel Header | `#f0f2f5` | `#202c33` |
| Border | `#e9edef` | `#313d45` |
| Text Primary | `#111b21` | `#e9edef` |
| Text Secondary | `#667781` | `#8696a0` |
| Search BG | `#f0f2f5` | `#202c33` |
| Hover | `#f5f6f6` | `#202c33` |

### Typography
- Font: System default (sans-serif)
- Sizes: 9px–24px with bold/extrabold weights
- Monospaced for: API keys, asset keys, code snippets

### Component Patterns
- **Glass cards**: White/dark with border, rounded-2xl, shadow-sm
- **Buttons**: Rounded-xl, hover scale effects, shadow-lg
- **Badges**: Rounded-full, colored backgrounds, font-medium
- **Inputs**: Rounded-xl, border, focus:ring-green
- **Modals**: Full-screen overlay backdrop + centered card
- **Drawers**: Right-slide panels with animation
- **Tables**: Striped hover rows, sticky headers
- **Charts**: Recharts library (Area, Bar, Pie, Line)

### Animations
- `animate-fade-in`: Opacity 0→1 transition
- `animate-slide-in`: TranslateX slide from right
- `animate-pulse`: Pulsing glow for status indicators
- Hover scale: `hover:scale-[1.01]` to `hover:scale-[1.02]`
- Active press: `active:scale-[0.98]` to `active:scale-[0.99]`

---

## 📱 Responsive Breakpoints

| Breakpoint | Width | Behavior |
|-----------|-------|----------|
| Mobile | < 768px | Single-panel views, card layouts, hamburger drawer |
| Tablet | 768–1024px | 2-column grids, collapsible panels |
| Desktop | > 1024px | Full 3-panel inbox, wide tables, expanded sidebar |
| Ultra-wide | > 1536px | 8-column stat grid, maximized canvas |
