## Brand & Style

The design system is a sophisticated fusion of **Corporate Modern** and **Glassmorphism**, specifically engineered for a high-performance SaaS marketing environment. It leverages the global familiarity of WhatsApp's aesthetic while elevating it through premium depth and transparency effects.

The brand personality is **authoritative, tech-forward, and reliable**. It aims to evoke a sense of "enhanced native" utility—feeling instantly recognizable to users of the platform, yet clearly positioned as a professional-grade business tool.

### Design Principles
- **Transparency as Hierarchy:** Use glass layers to denote secondary information or contextual overlays without losing the background context.
- **Vibrant Precision:** The "WhatsApp-native" green is used sparingly but powerfully to direct attention and indicate system health.
- **Soft Geometry:** High corner radii (2xl) on cards contrast with precise, crisp internal elements to balance friendliness with professional rigor.

## Colors

The color system is optimized for high-density data visualization and prolonged usage. It utilizes a core brand green to signify action and health, supported by a sophisticated range of "cool" neutrals.

### Surface Logic
- **Background:** In light mode, a soft grey (`#f0f2f5`) provides a canvas for pure white panels. In dark mode, a deep navy-black (`#0b141a`) creates a high-contrast environment.
- **Glass Effects:** Surfaces should implement a `backdrop-filter: blur(12px)` with an 80% opacity fill of the surface-panel color.
- **Outbound Messaging:** Reserved exclusively for the primary green to maintain the platform's mental model.

### Role-Based Indicators
- **Super Admin:** Uses a subtle "Primary Green" glow or border-top on their profile card.
- **Admin:** Standard branding.
- **Agent:** Secondary neutral styling with limited accent usage to focus on chat tasks.

## Typography

This design system uses a strictly utilitarian sans-serif stack to ensure maximum legibility across different operating systems.

### Usage Guidance
- **Display/Hero:** Reserved for high-level dashboard metrics and onboarding titles.
- **Extra-Bold Weights:** Should be used only for top-tier branding and critical "WA Business" identifiers to maintain a clean SaaS look.
- **Monospaced Treatment:** Use **jetbrainsMono** for all phone numbers, 2FA codes, and API identifiers. This creates a clear visual distinction between conversational text and technical data.
- **Micro-Scale:** The 9px caption is intended for metadata (timestamps, file sizes) and should always be rendered in the secondary text color.

## Layout & Spacing

The layout is built on a **fixed-fluid hybrid grid**. The sidebar navigation is fixed-width (collapsible), while the main content area utilizes a fluid 12-column grid that reflows based on viewport breakpoints.

### Breakpoints
- **Mobile (< 768px):** Single column. Sidebar becomes a bottom navigation bar or a hamburger drawer. Margins reduce to 16px.
- **Tablet (768px - 1280px):** 2-panel layout (Inbox + Chat). Margins remain at 24px.
- **Desktop (> 1280px):** 3-panel layout (Nav + Inbox + Chat/Details). Use the 24px gutter for all primary containers.

### Spacing
Component internal padding follows the `base` (8px) or `canvas` (16px) units to ensure a rhythmic vertical flow.

## Elevation & Depth

Visual hierarchy is achieved through **glassmorphic stacking** rather than traditional heavy shadows.

### Elevation Levels
1. **Level 0 (Base):** The app background (`#f0f2f5` or `#0b141a`).
2. **Level 1 (Panels):** Rounded-2xl cards with a white or dark navy fill. 1px solid border in the respective border color.
3. **Level 2 (Glass Overlays):** Used for sticky headers and search bars. `backdrop-filter: blur(12px)` and 1px borders. These elements should have a `shadow-sm` (low spread, 5% opacity black).
4. **Level 3 (Floating):** Modals and Dropdowns. Higher contrast borders and `shadow-lg` to separate from the underlying glass layers.

### Shadow Character
Shadows are never pure black. They should be tinted with the background color (e.g., a dark navy shadow in dark mode) to maintain a clean, vibrant look.

## Shapes

The shape language is "Hyper-Rounded," creating a approachable SaaS personality.

- **Cards/Panels:** Use `rounded-2xl` (1.5rem/24px) for all main containers and dashboard cards.
- **Interactions:** Buttons and Input fields use `rounded-xl` (0.75rem/12px).
- **Communication:** Chat bubbles and Avatars use `rounded-full` (pill-shaped) to match the mobile app's core DNA.
- **Dynamic Borders:** Use dashed borders exclusively for "drop zones" or "placeholder nodes" in the Bot Builder to signal interactivity.

## Components

### Buttons & Inputs
- **Primary Action:** Solid Primary Green with white text. On hover, apply a slight scale (1.02x).
- **Glass Button:** Transparent background with a `border-light` and blur effect.
- **Inputs:** `rounded-xl` with a 1px border. On focus, the border transitions to Primary Green with a soft green outer glow (ring).

### Glass Cards
- **Structure:** `rounded-2xl` with a `shadow-sm`.
- **Header:** Sticky top bars within cards should have a subtle bottom border and backdrop blur.

### Status Indicators
- **Online/Active:** A 10px circle with Primary Green and an `animate-pulse` effect.
- **Role Badges:** Small pill-shaped badges next to names.
  - *Super Admin:* Green background, white text.
  - *Admin:* Neutral-dark background, white text.
  - *Agent:* Border only (ghost style).

### Chat Bubbles
- **Inbound:** Neutral panel color with a slight shadow.
- **Outbound:** Primary Green with white text.
- **Read Receipts:** Two small blue ticks (`#53bdeb`) aligned with the timestamp.

### Animated Elements
- **Transitions:** All page entries should use a 200ms `fade-in`.
- **Side Drawers:** Use a `slide-in` from the right with a background overlay that blurs the main content area.