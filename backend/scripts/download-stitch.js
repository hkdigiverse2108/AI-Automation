const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const STITCH_DIR = path.join(__dirname, '..', '..', 'stitch_designs');
const CODE_DIR = path.join(STITCH_DIR, 'code');
const SCREENSHOTS_DIR = path.join(STITCH_DIR, 'screenshots');

// Ensure directories exist
if (!fs.existsSync(STITCH_DIR)) fs.mkdirSync(STITCH_DIR);
if (!fs.existsSync(CODE_DIR)) fs.mkdirSync(CODE_DIR);
if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR);

const screens = [
  {
    id: "8215867947821489348",
    title: "saas_ui_summary.md",
    filename: "saas_ui_summary.md",
    htmlUrl: "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBKOARIhYXBwX2NvbXBhbmlvbl91c2VyX3VwbG9hZGVkX2ZpbGVzGmkKM3VzZXJfdXBsb2FkZWRfaHRtbF8wMDA2NTMyZjA2YzNmOGNkMDIwN2EzNjMxODAyMzI1MxILEgcQyMu0ofcWGAGSASQKCnByb2plY3RfaWQSFkIUMTQzMDk0MDM2OTgzNzIwMjA4Mzk&filename=&opi=89354086",
    screenshotUrl: null
  },
  {
    id: "079ced2be9e44e63a25067ee264fbd55",
    title: "Login Page - WA Business Marketing Suite",
    filename: "login_page.html",
    screenshotFilename: "login_page.png",
    htmlUrl: "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sX2U4ODRkOWMwNjg1MjQ1MDZhYmQxNzlhNDBlMGE2ZmEyEgsSBxDIy7Sh9xYYAZIBJAoKcHJvamVjdF9pZBIWQhQxNDMwOTQwMzY5ODM3MjAyMDgzOQ&filename=&opi=89354086",
    screenshotUrl: "https://lh3.googleusercontent.com/aida/ADBb0uj3Zx38vorjMkHYuWdcLWMFSoGw4X5DrUPQIezAEgEOecdccUpWvH-9CkrdBXjzMAozY3H3g061-zaI68h_BvvbEv5Xi8HF7L7vNro_mnAChRQzDe7uROjtd7Jjam3LILrolJ5lBaVxjImKLZhuqxJME3Bg-VCi-qOufHJUsi_SOh3QWvs6i033HAGGZGZ9xfEQViHqOPjkc9Qe8VkH36IVAJvXahr1tLJ9g94Rhf4SYNCgGDFZLyYBn4eL"
  },
  {
    id: "b9e64e5688c144f4a29394f6f64e80e9",
    title: "Inbox - WA Business Marketing Suite",
    filename: "inbox.html",
    screenshotFilename: "inbox.png",
    htmlUrl: "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sX2Y5Yjc3YjNmNzlmZTRmNTBhODc3Mzg0Y2Q1ZTYxM2I1EgsSBxDIy7Sh9xYYAZIBJAoKcHJvamVjdF9pZBIWQhQxNDMwOTQwMzY5ODM3MjAyMDgzOQ&filename=&opi=89354086",
    screenshotUrl: "https://lh3.googleusercontent.com/aida/ADBb0ujNZlA8GRhHHb7t5A6kJacRCxOeFEoyOVrEGLP3ckA9PtrPSUjd-GPwwW54fISU44AhUrcpqClOFb0fkc69CZMkF7PNx7Ymys_TCohpbVQw1UjwyOGPIJfA7Iv1ku_Wj28iJz-LXQpmLAjsMr8vLRAAgyT1ynfjG0LkT94IAb8goXXOPF7NAIFxj2vZur9mNd02dU0mtHGfwKJ0K9_HvFFqkfHTgJY6iMSDAQXg1zckbUsZOJL8pr4GIklw"
  },
  {
    id: "7794c14c02e44000a1b885f8c67a6137",
    title: "Analytics - WA Business Marketing Suite",
    filename: "analytics.html",
    screenshotFilename: "analytics.png",
    htmlUrl: "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sXzEzNWI5MmMyZDkwNDRhZGJiNjJkNjQwMTgzMGY3NWUxEgsSBxDIy7Sh9xYYAZIBJAoKcHJvamVjdF9pZBIWQhQxNDMwOTQwMzY5ODM3MjAyMDgzOQ&filename=&opi=89354086",
    screenshotUrl: "https://lh3.googleusercontent.com/aida/ADBb0ui0SGmb2gGWhurhr3f21PMFbOuMWLLd6nG0NvO-7ZP0IJtnjwTfWK69W1TnMX7i5sW5nIpto_mDcOBjuwbKSSYcc0bmmy7vKO7WSSkn0IpLwDB-aKu1HQOmgf0GkeEIG_UNkg6JTjtL5eUdb4w0AlLWRe2BmILon_ZtxYn55vlL-YGhrnS5IALyvVYgOl2QTe8gTXFmNmd0jtECKsPdeLeJRIK3dgzbZY5ILJfHBSm0mQPp23F1IDD43yE"
  },
  {
    id: "18322fafa85c49b9ae6148f968ca7c56",
    title: "Dashboard Home - WA Business Marketing Suite",
    filename: "dashboard_home.html",
    screenshotFilename: "dashboard_home.png",
    htmlUrl: "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sX2JhMGY3ZTNmZDU5OTRkMDk4MjljNTQzMzk4MDVhZGU5EgsSBxDIy7Sh9xYYAZIBJAoKcHJvamVjdF9pZBIWQhQxNDMwOTQwMzY5ODM3MjAyMDgzOQ&filename=&opi=89354086",
    screenshotUrl: "https://lh3.googleusercontent.com/aida/ADBb0ugZUBC2QtkdBeB_ODFF7wWNIT9_RezWYn8-jn_lYjhirvYCjwAnSDGOGd1q5oUbXKhAK9nlhqPcSVB5xnfKqDw5P3F3sM0RSNuVUsWv4z0ZAh1iwIdZETHFnNnUJNv0Fquo2U62zRV8yewA3CSeyJtQ8hvG3o-lEswPuPa8BEen_bAn7of940bpmT39oywlrn2J9lJ9zoNNH6DYtGfq4QFIwlsh4cs7_xJ1Tpp8gq2pTAy-SObCGdns-K4g"
  },
  {
    id: "6a90b4aaff884fd594f874c200e20a6c",
    title: "Subscribers - WA Business Marketing Suite",
    filename: "subscribers.html",
    screenshotFilename: "subscribers.png",
    htmlUrl: "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sXzIwODVmNWNiMmVjNjRiNjNiNzVlMmMzMTgwNDRmMWJiEgsSBxDIy7Sh9xYYAZIBJAoKcHJvamVjdF9pZBIWQhQxNDMwOTQwMzY5ODM3MjAyMDgzOQ&filename=&opi=89354086",
    screenshotUrl: "https://lh3.googleusercontent.com/aida/ADBb0ugIJ9r_Qyhj3HVLpVTTnL4ytzQhzNGgKg4WPAfMtbeP8tQcXSOcS9k76IbXbBDRpKFkB2rjI8YbHiFdrKYPWMiP9raU5l4OZCNrEZF6-jEGQ0PjRtYGzp-Tg1-1ynlbb7NaLU6DiLDvlsisqHHI9phQe2BZ7Vf9vpBZA1oW1RMgsnTKsfgMfGbpkosyQqbkMn5nWD24xWFIyLLT1EzrFgyjwBEdsQYCIBXWpGDNrhFD2SI3LQf9nfe9RDJl"
  },
  {
    id: "bacd80e86b40424b97901caa57b49dbb",
    title: "Blast Campaigns - WA Business Marketing Suite",
    filename: "blast_campaigns.html",
    screenshotFilename: "blast_campaigns.png",
    htmlUrl: "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sXzc0NzNlNGM5ZDQzNTQzMWNhMjM4M2YyNTI3M2MwNjNhEgsSBxDIy7Sh9xYYAZIBJAoKcHJvamVjdF9pZBIWQhQxNDMwOTQwMzY5ODM3MjAyMDgzOQ&filename=&opi=89354086",
    screenshotUrl: "https://lh3.googleusercontent.com/aida/ADBb0uhgQWaQb8YGCevko2lGUUdLCeMYKw14COLiiY9Z98V0K1q_TGrACTgpHeNuGguuJlenTySsP2piCPZbh-LqSiuqCfJ2V-U1Ki9YyNgobMwfcxRktrAMIFWdQaMDeB143qJ0N_OyGpltuUxDyetDFt-DSnGYX3AoI0-heIH1ry6QhugtCDRu_6hoiv1HKOnr6yyvQuVDBtd3QhQ8-OuYibMt8BFqgrD3jbnnaxrsQhuyS481XtR9x6afYQg"
  },
  {
    id: "614f030692bd4780afbf2483d7a2f38c",
    title: "Team Management - WA Business Marketing Suite",
    filename: "team_management.html",
    screenshotFilename: "team_management.png",
    htmlUrl: "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sXzc2NDhiZDczYmRmZjRhYTU4NzllNDA2ZDI1MGZmZDUzEgsSBxDIy7Sh9xYYAZIBJAoKcHJvamVjdF9pZBIWQhQxNDMwOTQwMzY5ODM3MjAyMDgzOQ&filename=&opi=89354086",
    screenshotUrl: "https://lh3.googleusercontent.com/aida/ADBb0uhjT-4JFAcRkWtudbMwlLDoJDEFKImiQV7CY91shpwMmZM60T_mofLYD_W8Tg_JjCURZuAHLS9VV7NvB4XwE9zQLf7-yX9wCcChYGjt4B5RN-vTU1Cv7zYICjHWlPWthpQPIIYBnIEoOWEzmbGWzzkrX5OM_bn8k-VDfkuuLvMQWgBTl-M3g2uokLejyY7KRPadEPh0qY67KKF9aHpsxbNkVWqLEehZA3XGk1JHSECBzxas8LzaAiNC2U8"
  },
  {
    id: "c6d4ccf29a6d4a70ae08273da72e3a61",
    title: "Message Templates - WA Business Marketing Suite",
    filename: "message_templates.html",
    screenshotFilename: "message_templates.png",
    htmlUrl: "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sX2YzYzM3MGEzMTgzMTQ4N2Q5YTI2ZDA0ODUyODc1NmMwEgsSBxDIy7Sh9xYYAZIBJAoKcHJvamVjdF9pZBIWQhQxNDMwOTQwMzY5ODM3MjAyMDgzOQ&filename=&opi=89354086",
    screenshotUrl: "https://lh3.googleusercontent.com/aida/ADBb0uithXnJlcX0T5w3xsxiktbW1bTGraw9FeOfu1GkErPiYAdU5JBb0VOhvSwKAUZWd3AJ8hyxZDfbUAv_zTzIxzMqSwJHcRdNvJdqZeil-mJQI2THJb8lQ4hJLehtUh-G34uGDPJ9NNO6_4ExTgiwUFTOZLrI_5yJFKOR_QX4jQRzjhIaxrTaeEzpsn9d89D-u0CvA4NuN3yzkV5VHcrvuZEASdlYLhzujQWELgWTSikie6qmNhrBRWLoSdls"
  },
  {
    id: "0e2a6a64beae4247bfe821db217742af",
    title: "Audit Logs - WA Business Marketing Suite",
    filename: "audit_logs.html",
    screenshotFilename: "audit_logs.png",
    htmlUrl: "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sXzJhZWVkNzAwNThiMzRmYjU4ZjYyYTliZGE2NGZkZmQ3EgsSBxDIy7Sh9xYYAZIBJAoKcHJvamVjdF9pZBIWQhQxNDMwOTQwMzY5ODM3MjAyMDgzOQ&filename=&opi=89354086",
    screenshotUrl: "https://lh3.googleusercontent.com/aida/ADBb0ui4M2iflMGmK_ae07MsL_hz-irLCHxBH_7uqOSjfaWdgRg6QZmtlrxe_yaNr9eFDNIO9qPbMtFSa-6n1_E2PR0dtg-pYfeQHP050xpuK2BY49smO8sGmSB7gee9aUmlGT3FZGjOre8VByco7Uj7F9_FpGVbOK_tXb3WGicHQcf6SarZEmSYL7PqODdhxlZTAQN4bzrNg9koA9Qmb0DBrSRNIcqr5aNdpCC8_0U6C6cEXHXbt8CIHlvbqcaj"
  },
  {
    id: "f0294cbf27a147a88cce00483276a599",
    title: "Bot Builder - WA Business Marketing Suite",
    filename: "bot_builder.html",
    screenshotFilename: "bot_builder.png",
    htmlUrl: "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sX2I4Y2JiZDAyNTJlZDQ5ODg4NmZkNzEzNTkwZjg4YmFiEgsSBxDIy7Sh9xYYAZIBJAoKcHJvamVjdF9pZBIWQhQxNDMwOTQwMzY5ODM3MjAyMDgzOQ&filename=&opi=89354086",
    screenshotUrl: "https://lh3.googleusercontent.com/aida/ADBb0uiG7sRCnoeY_CFn_6FcNjwLhcOhpU6_hPW9FPIpXUZfnag9G32giOzEdntCcC3G5bTt4yoqYs3hJ72_pqyoyrdIY4wBxH8F8A-DumDTBjUmkep4jG2foqH1qqCHx61Sq1jTgW4FecZmD-id97AkccQTEPQBHtkEUgjMT56k-n5AA3ymM32dXej3T72DZldRNGqWPs19GOss639BuFbO-nLzh76huMIap2p8D0WTIrRBKxBNu8m-WhE-2mE"
  },
  {
    id: "e62a3501a2cf450d9e03db7c16a5b6f6",
    title: "Super Admin Panel - WA Business Marketing Suite",
    filename: "super_admin_panel.html",
    screenshotFilename: "super_admin_panel.png",
    htmlUrl: "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sXzBjMWYwOGU5YWY1MTRjZTFhMThhZTMyMWU0ZjEyNDU4EgsSBxDIy7Sh9xYYAZIBJAoKcHJvamVjdF9pZBIWQhQxNDMwOTQwMzY5ODM3MjAyMDgzOQ&filename=&opi=89354086",
    screenshotUrl: "https://lh3.googleusercontent.com/aida/ADBb0uhavN1zuYBhIXzZlD4GwePSPwofQ4ggEvjXYUB_KWI6ZB2puyH8GjFIleoyyyngy8KbPrpyH-HGN8Jn3RF7QPfoTVkaAfQQzd_eAQPr4SpcH8LUg0BAb7B0HAYqsgC5Zxpzewi1J9EP7JqpDp0u-I0g02GsPQbrfHaEVhwrjFT-Ms-pCc4XEwKSaL2wu4_rqKVcG1xYaFQTLq6WfplwNQBRDFae_YIWd5xLQvkkPbjv_voNo6YjtK6WwpJw"
  },
  {
    id: "a0684bf4af16406c9327fadd06ae8b27",
    title: "Settings - WA Business Marketing Suite",
    filename: "settings.html",
    screenshotFilename: "settings.png",
    htmlUrl: "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sXzdlMmRjM2I0YWEzNTRhMjZhYjY2ZGM5NjgxMGYyYmVmEgsSBxDIy7Sh9xYYAZIBJAoKcHJvamVjdF9pZBIWQhQxNDMwOTQwMzY5ODM3MjAyMDgzOQ&filename=&opi=89354086",
    screenshotUrl: "https://lh3.googleusercontent.com/aida/ADBb0uj1UWiR8DuijioH1PBrXlCT8ItnS5GswS8whbQ7gUYQo_lys9BoNuknrgIddRo1tDVyjLlTDDBghriIjOxPwxvScdjQZdKV42XWwCn5zIWRHDiQhoxxWoiwt9DWkHvWMUfYAj1hrqe3i-ckMJwPTMSt8G-bHFEgChH1-jxZh5BFR8puOHUi4bSYCAcbfeBFSVKUoJ4TntwXI9vyCVkX-ASxmQ6NJhVAq_CZXcyxj0e7zlLL-gCvkopGq35H"
  }
];

// Design System Style guidelines & theme details
const designSystemData = {
  id: "asset-stub-assets-4b14176e793746a992a08a0ecd9ba2e8-1780311346563",
  title: "Design System",
  guidelinesFilename: "design_system.md",
  themeFilename: "design_system_theme.json",
  guidelines: `## Brand & Style

The design system is a sophisticated fusion of **Corporate Modern** and **Glassmorphism**, specifically engineered for a high-performance SaaS marketing environment. It leverages the global familiarity of WhatsApp's aesthetic while elevating it through premium depth and transparency effects.

The brand personality is **authoritative, tech-forward, and reliable**. It aims to evoke a sense of "enhanced native" utility—feeling instantly recognizable to users of the platform, yet clearly positioned as a professional-grade business tool.

### Design Principles
- **Transparency as Hierarchy:** Use glass layers to denote secondary information or contextual overlays without losing the background context.
- **Vibrant Precision:** The "WhatsApp-native" green is used sparingly but powerfully to direct attention and indicate system health.
- **Soft Geometry:** High corner radii (2xl) on cards contrast with precise, crisp internal elements to balance friendliness with professional rigor.

## Colors

The color system is optimized for high-density data visualization and prolonged usage. It utilizes a core brand green to signify action and health, supported by a sophisticated range of "cool" neutrals.

### Surface Logic
- **Background:** In light mode, a soft grey (\`#f0f2f5\`) provides a canvas for pure white panels. In dark mode, a deep navy-black (\`#0b141a\`) creates a high-contrast environment.
- **Glass Effects:** Surfaces should implement a \`backdrop-filter: blur(12px)\` with an 80% opacity fill of the surface-panel color.
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
Component internal padding follows the \`base\` (8px) or \`canvas\` (16px) units to ensure a rhythmic vertical flow.

## Elevation & Depth

Visual hierarchy is achieved through **glassmorphic stacking** rather than traditional heavy shadows.

### Elevation Levels
1. **Level 0 (Base):** The app background (\`#f0f2f5\` or \`#0b141a\`).
2. **Level 1 (Panels):** Rounded-2xl cards with a white or dark navy fill. 1px solid border in the respective border color.
3. **Level 2 (Glass Overlays):** Used for sticky headers and search bars. \`backdrop-filter: blur(12px)\` and 1px borders. These elements should have a \`shadow-sm\` (low spread, 5% opacity black).
4. **Level 3 (Floating):** Modals and Dropdowns. Higher contrast borders and \`shadow-lg\` to separate from the underlying glass layers.

### Shadow Character
Shadows are never pure black. They should be tinted with the background color (e.g., a dark navy shadow in dark mode) to maintain a clean, vibrant look.

## Shapes

The shape language is "Hyper-Rounded," creating a approachable SaaS personality.

- **Cards/Panels:** Use \`rounded-2xl\` (1.5rem/24px) for all main containers and dashboard cards.
- **Interactions:** Buttons and Input fields use \`rounded-xl\` (0.75rem/12px).
- **Communication:** Chat bubbles and Avatars use \`rounded-full\` (pill-shaped) to match the mobile app's core DNA.
- **Dynamic Borders:** Use dashed borders exclusively for "drop zones" or "placeholder nodes" in the Bot Builder to signal interactivity.

## Components

### Buttons & Inputs
- **Primary Action:** Solid Primary Green with white text. On hover, apply a slight scale (1.02x).
- **Glass Button:** Transparent background with a \`border-light\` and blur effect.
- **Inputs:** \`rounded-xl\` with a 1px border. On focus, the border transitions to Primary Green with a soft green outer glow (ring).

### Glass Cards
- **Structure:** \`rounded-2xl\` with a \`shadow-sm\`.
- **Header:** Sticky top bars within cards should have a subtle bottom border and backdrop blur.

### Status Indicators
- **Online/Active:** A 10px circle with Primary Green and an \`animate-pulse\` effect.
- **Role Badges:** Small pill-shaped badges next to names.
  - *Super Admin:* Green background, white text.
  - *Admin:* Neutral-dark background, white text.
  - *Agent:* Border only (ghost style).

### Chat Bubbles
- **Inbound:** Neutral panel color with a slight shadow.
- **Outbound:** Primary Green with white text.
- **Read Receipts:** Two small blue ticks (\`#53bdeb\`) aligned with the timestamp.

### Animated Elements
- **Transitions:** All page entries should use a 200ms \`fade-in\`.
- **Side Drawers:** Use a \`slide-in\` from the right with a background overlay that blurs the main content area.`,
  theme: {
    colorMode: "LIGHT",
    font: "INTER",
    roundness: "ROUND_EIGHT",
    customColor: "#00a884",
    namedColors: {
      background: "#f5faff",
      "bg-dark": "#0b141a",
      "bg-light": "#f0f2f5",
      "border-dark": "#313d45",
      "border-light": "#e9edef",
      error: "#ba1a1a",
      primary: "#006b53",
      "primary_container": "#00a884",
      secondary: "#546068",
      "status-error": "#ef4444",
      "status-info": "#3b82f6",
      "status-warn": "#f59e0b",
      surface: "#f5faff",
      "surface-panel-dark": "#111b21",
      "surface-panel-light": "#ffffff"
    }
  }
};

async function main() {
  console.log("=== WA Business Marketing Suite — Stitch Asset Downloader ===");
  console.log(`Target directory: ${STITCH_DIR}`);

  // Write Design System files first
  const dsGuidelinesPath = path.join(STITCH_DIR, designSystemData.guidelinesFilename);
  const dsThemePath = path.join(STITCH_DIR, designSystemData.themeFilename);
  fs.writeFileSync(dsGuidelinesPath, designSystemData.guidelines);
  fs.writeFileSync(dsThemePath, JSON.stringify(designSystemData.theme, null, 2));
  console.log(`✔ Saved Design System Guidelines to ${dsGuidelinesPath}`);
  console.log(`✔ Saved Design System Theme details to ${dsThemePath}`);

  for (const screen of screens) {
    console.log(`\nProcessing screen: "${screen.title}" (ID: ${screen.id})...`);

    if (screen.htmlUrl) {
      const destPath = path.join(CODE_DIR, screen.filename);
      console.log(`Downloading HTML code to: ${destPath}`);
      try {
        // Run curl -L to follow redirects and download code
        execSync(`curl -L -o "${destPath}" "${screen.htmlUrl}"`, { stdio: 'inherit' });
        console.log(`✔ Successfully downloaded code for "${screen.title}"`);
      } catch (err) {
        console.error(`❌ Failed to download code for "${screen.title}":`, err.message);
      }
    }

    if (screen.screenshotUrl) {
      const destPath = path.join(SCREENSHOTS_DIR, screen.screenshotFilename);
      console.log(`Downloading screenshot to: ${destPath}`);
      try {
        // Run curl -L to follow redirects and download screenshot
        execSync(`curl -L -o "${destPath}" "${screen.screenshotUrl}"`, { stdio: 'inherit' });
        console.log(`✔ Successfully downloaded screenshot for "${screen.title}"`);
      } catch (err) {
        console.error(`❌ Failed to download screenshot for "${screen.title}":`, err.message);
      }
    }
  }

  console.log("\n=== Download Complete! ===");
  console.log(`All files are saved in: ${STITCH_DIR}`);
}

main().catch(err => {
  console.error("Fatal error:", err);
});
