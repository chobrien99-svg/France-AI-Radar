# French AI Radar — Claude Code Handoff Document

## Project Overview

**French AI Radar** is a premium subscription startup intelligence database for investors tracking the French AI ecosystem. It is a new product from French Tech Journal, but operates as a **distinct brand** — not an extension of the FTJ site.

**Target users:** VCs, corporate strategists, LPs, and angel investors.

**Core value proposition:** Signal > noise. Detect fundraising moves, founder patterns, and corporate restructuring before they hit the press.

**Design philosophy:** Bloomberg Terminal meets modern SaaS. Research software, not a hype product. Calm, structured, dense but readable, trustworthy. Think: Stripe Dashboard + Notion database view + Sacra tone.

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Framework | **Next.js 14+** (App Router) | Frontend + API routes |
| Styling | **Tailwind CSS v4** + **shadcn/ui** | Component library + design tokens |
| Font | **Geist Sans / Geist Mono** | Typography (via `geist` npm package) |
| Database | **Supabase** (Postgres) | Startup data, user profiles, subscriptions |
| Auth | **Supabase Auth** | Email/password login, session management |
| Payments | **Stripe** (Checkout + Webhooks) | Subscription billing for 3 tiers |
| Hosting | **Vercel** | Deployment, serverless functions |

### Key Dependencies

```json
{
  "dependencies": {
    "next": "^14.2",
    "react": "^18",
    "react-dom": "^18",
    "geist": "^1",
    "@supabase/supabase-js": "^2",
    "@supabase/ssr": "^0.5",
    "stripe": "^17",
    "tailwindcss": "^4",
    "clsx": "^2",
    "tailwind-merge": "^2",
    "lucide-react": "latest",
    "tw-animate-css": "latest"
  }
}
```

Also install shadcn/ui components:
```bash
npx shadcn@latest add button card badge input table dropdown-menu dialog sheet tabs separator tooltip skeleton
```

### shadcn/ui Config (components.json)

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "css": "app/globals.css",
    "baseColor": "neutral",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "iconLibrary": "lucide"
}
```

### Utility Function

```typescript
// lib/utils.ts
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

---

## Environment Variables

```env
# .env.local

# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Stripe
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Stripe Price IDs (create these in Stripe Dashboard)
STRIPE_PRICE_EXPLORER_MONTHLY=price_...
STRIPE_PRICE_EXPLORER_ANNUAL=price_...
STRIPE_PRICE_PROFESSIONAL_MONTHLY=price_...
STRIPE_PRICE_PROFESSIONAL_ANNUAL=price_...

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Database Schema (Supabase / Postgres)

### Tables

```sql
-- ============================================
-- ENUMS
-- ============================================

CREATE TYPE sector_type AS ENUM (
  'ai_agents', 'robotics', 'bioai', 'deeptech', 'cybersecurity_ai',
  'fintech_ai', 'healthtech_ai', 'edtech_ai', 'climate_ai', 'legaltech_ai',
  'logistics_ai', 'manufacturing_ai', 'other'
);

CREATE TYPE signal_type AS ENUM (
  'fundraising', 'key_hire', 'restructuring', 'patent_ip',
  'pivot', 'product_launch', 'partnership', 'founder_departure',
  'advisory_formation', 'incorporation'
);

CREATE TYPE founder_signal_type AS ENUM (
  'big_tech_alumni', 'repeat_founder', 'academic_spinout', 'corporate_reboot'
);

CREATE TYPE stage_type AS ENUM (
  'pre_seed', 'seed', 'series_a', 'series_b_plus', 'unknown'
);

CREATE TYPE signal_strength AS ENUM (
  'positive', 'warning', 'risk', 'neutral'
);

CREATE TYPE subscription_tier AS ENUM (
  'free', 'explorer', 'professional', 'enterprise'
);

-- ============================================
-- STARTUPS
-- ============================================

CREATE TABLE startups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT, -- one-line description
  city TEXT,
  country TEXT DEFAULT 'France',
  sector sector_type NOT NULL,
  stage stage_type DEFAULT 'unknown',
  founded_date DATE,
  first_seen_date DATE DEFAULT CURRENT_DATE,
  investor_brief TEXT, -- longer editorial analysis (premium content)
  product_description TEXT,
  target_market TEXT,
  competitive_landscape TEXT,
  total_raised_eur NUMERIC,
  last_round TEXT,
  est_next_raise TEXT,
  funding_notes TEXT,
  is_active BOOLEAN DEFAULT true,
  signal_count INTEGER DEFAULT 0,
  last_signal_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- FOUNDERS
-- ============================================

CREATE TABLE founders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  startup_id UUID REFERENCES startups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT, -- e.g. 'CEO & Co-Founder'
  bio TEXT,
  founder_signals founder_signal_type[],
  linkedin_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SIGNALS (the intelligence timeline)
-- ============================================

CREATE TABLE signals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  startup_id UUID REFERENCES startups(id) ON DELETE CASCADE,
  signal_date DATE NOT NULL,
  signal_type signal_type NOT NULL,
  strength signal_strength DEFAULT 'neutral',
  title TEXT NOT NULL, -- e.g. 'Corporate restructuring'
  description TEXT, -- longer explanation
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- STARTUP BADGES (many-to-many tags)
-- ============================================

CREATE TABLE startup_badges (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  startup_id UUID REFERENCES startups(id) ON DELETE CASCADE,
  label TEXT NOT NULL, -- e.g. 'Founder Reboot', 'Fundraising Signal'
  strength signal_strength DEFAULT 'neutral',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- USER PROFILES & SUBSCRIPTIONS
-- ============================================

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  subscription_tier subscription_tier DEFAULT 'free',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  subscription_status TEXT DEFAULT 'inactive', -- active, past_due, canceled, etc.
  subscription_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SAVED SEARCHES (Professional+ feature)
-- ============================================

CREATE TABLE saved_searches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  filters JSONB NOT NULL, -- stored filter state
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_startups_sector ON startups(sector);
CREATE INDEX idx_startups_stage ON startups(stage);
CREATE INDEX idx_startups_city ON startups(city);
CREATE INDEX idx_startups_last_signal ON startups(last_signal_date DESC);
CREATE INDEX idx_signals_startup ON signals(startup_id);
CREATE INDEX idx_signals_date ON signals(signal_date DESC);
CREATE INDEX idx_founders_startup ON founders(startup_id);
CREATE INDEX idx_badges_startup ON startup_badges(startup_id);
CREATE INDEX idx_profiles_stripe ON profiles(stripe_customer_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE startups ENABLE ROW LEVEL SECURITY;
ALTER TABLE founders ENABLE ROW LEVEL SECURITY;
ALTER TABLE signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE startup_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;

-- Public: anyone can read basic startup data
CREATE POLICY "Public read startups" ON startups
  FOR SELECT USING (true);

-- Public: anyone can read founders
CREATE POLICY "Public read founders" ON founders
  FOR SELECT USING (true);

-- Public: anyone can read badges
CREATE POLICY "Public read badges" ON startup_badges
  FOR SELECT USING (true);

-- Signals: only authenticated users
CREATE POLICY "Auth read signals" ON signals
  FOR SELECT USING (auth.role() = 'authenticated');

-- Profiles: users can read/update their own
CREATE POLICY "Users read own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Saved searches: users own theirs
CREATE POLICY "Users manage own searches" ON saved_searches
  FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- AUTO-UPDATE updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER startups_updated_at
  BEFORE UPDATE ON startups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

### Seed Data

```sql
-- ============================================
-- SAMPLE STARTUPS
-- ============================================

INSERT INTO startups (name, slug, description, city, sector, stage, founded_date, first_seen_date, investor_brief, product_description, target_market, competitive_landscape, signal_count, last_signal_date) VALUES

('NovaMind AI', 'novamind-ai',
 'Autonomous agent framework for enterprise workflow orchestration.',
 'Paris', 'ai_agents', 'seed', '2026-01-15', '2026-01-20',
 'NovaMind AI is building an autonomous agent framework for enterprise workflow orchestration. The company was incorporated in January 2026 by a former DeepMind research lead with deep expertise in multi-agent systems and reinforcement learning. Early indicators suggest the company is preparing for a seed fundraise: rapid hiring in engineering (4 posts in 3 weeks), corporate entity restructuring, and advisory board formation. The founder''s track record — 6 years at DeepMind, 2 published papers on agent coordination — positions this as a high-signal opportunity in the enterprise AI agents space.',
 'An agent orchestration platform that enables enterprises to deploy, coordinate, and monitor autonomous AI agents across business workflows — from customer support escalation to internal ops automation.',
 'Mid-market and enterprise companies (500+ employees) with complex operational workflows. Initial vertical focus appears to be financial services and logistics.',
 'Competes with Dust (Paris), LangChain/LangSmith (US), CrewAI (US), and enterprise incumbents building in-house solutions. Differentiator is likely the multi-agent coordination layer.',
 3, '2026-03-14'),

('Katrix.AI', 'katrix-ai',
 'Hybrid perception stack for autonomous systems.',
 'Meudon', 'robotics', 'pre_seed', '2025-11-01', '2026-01-10',
 'Katrix.AI appears to be a relaunch of robotics perception technology, focused on building a hybrid perception stack for autonomous systems. The founder has prior experience in robotics but details of the previous venture are limited. Early signals suggest the company is still in stealth mode with minimal public footprint.',
 'Perception infrastructure layer combining LiDAR, camera, and radar sensor fusion for autonomous robotic systems.',
 'Industrial robotics and autonomous vehicle tier-1 suppliers.',
 'Competing against Outsight (Paris), Prophesee (Paris), and international players like Luminar and Ouster.',
 1, '2026-01-10'),

('BioSight', 'biosight',
 'AI-driven molecular imaging for drug discovery acceleration.',
 'Lyon', 'bioai', 'pre_seed', '2026-03-01', '2026-03-05',
 'BioSight is a CNRS spinout building AI-driven molecular imaging tools to accelerate early-stage drug discovery. A recent patent filing suggests the team is securing IP protection ahead of a likely fundraise. The academic pedigree is strong — the founding team includes two CNRS researchers with 15+ combined publications in computational biology.',
 'Machine learning platform that analyzes molecular imaging data to predict drug candidate efficacy at pre-clinical stage.',
 'Pharma R&D departments and biotech startups in pre-clinical drug discovery.',
 'Competes with Owkin (Paris), Iktos (Paris), and international platforms like Recursion Pharmaceuticals and Insilico Medicine.',
 2, '2026-03-12'),

('SentinelOps', 'sentinelops',
 'Autonomous threat detection and response for cloud infrastructure.',
 'Paris', 'cybersecurity_ai', 'seed', '2025-12-01', '2025-12-15',
 'SentinelOps is building autonomous threat detection for cloud-native infrastructure. The recent hire of an ex-Palo Alto Networks VP of Engineering is a strong signal — this caliber of hire typically precedes or accompanies a significant fundraise. Combined with 4 active signals in the past 30 days, this is one of the most active startups on the radar.',
 'AI-powered security operations platform that autonomously detects, triages, and responds to threats across multi-cloud environments.',
 'Cloud-native enterprises and managed security service providers (MSSPs).',
 'Competes with Sekoia.io (Paris), HarfangLab (Paris), CrowdStrike, and SentinelOne internationally.',
 4, '2026-03-18'),

('Axone', 'axone',
 'Neuromorphic computing chips for edge AI inference.',
 'Grenoble', 'deeptech', 'seed', '2025-10-01', '2025-11-20',
 'Axone is a CEA-Leti spinout developing neuromorphic computing chips optimized for edge AI inference. The company recently pivoted its go-to-market from general-purpose edge computing to a focused automotive use case, which could significantly sharpen its value proposition for Tier-1 automotive suppliers.',
 'Ultra-low-power neuromorphic processor designed for real-time AI inference at the edge, initially targeting automotive sensor processing.',
 'Automotive Tier-1 suppliers and OEMs for ADAS/autonomous driving sensor processing.',
 'Competes with GrAI Matter Labs (Paris, acquired), SynSense (Zurich), Intel Loihi, and IBM TrueNorth research programs.',
 1, '2026-02-28'),

('Revero Health', 'revero-health',
 'AI copilot for clinical trial design and patient matching.',
 'Paris', 'healthtech_ai', 'seed', '2026-02-01', '2026-02-10',
 'Revero Health is led by a repeat founder whose previous healthtech company exited for an undisclosed amount. The new venture applies LLMs to clinical trial optimization — both in protocol design and patient recruitment. Early fundraising signals suggest a Series A-scale ambition given the founder''s track record.',
 'AI copilot that assists clinical research organizations in designing trial protocols and matching eligible patients from electronic health records.',
 'Contract Research Organizations (CROs), mid-size pharma companies, and academic medical centers.',
 'Competes with Lifen (Paris) for health data, and internationally with Unlearn.ai, TrialSpark, and Deep 6 AI.',
 2, '2026-03-15');

-- ============================================
-- FOUNDERS
-- ============================================

INSERT INTO founders (startup_id, name, role, bio, founder_signals) VALUES

((SELECT id FROM startups WHERE slug = 'novamind-ai'),
 'Adrien Morel', 'CEO & Co-Founder',
 'Former Research Lead at DeepMind (2019–2025). PhD in Multi-Agent Systems, ENS Paris-Saclay. 2 published papers on agent coordination and planning. Previously at Google Brain (intern, 2018).',
 ARRAY['big_tech_alumni']::founder_signal_type[]),

((SELECT id FROM startups WHERE slug = 'novamind-ai'),
 'Léa Fontaine', 'CTO & Co-Founder',
 'Former Staff Engineer at Datadog (2020–2025). MSc Computer Science, École Polytechnique. Built Datadog''s internal workflow automation engine. Open-source contributor to LangChain.',
 ARRAY['big_tech_alumni']::founder_signal_type[]),

((SELECT id FROM startups WHERE slug = 'katrix-ai'),
 'Marc Vidal', 'CEO & Founder',
 'Previously founded a robotics perception startup (2019–2023). Background in computer vision and sensor fusion. MSc INSA Lyon.',
 ARRAY['repeat_founder', 'corporate_reboot']::founder_signal_type[]),

((SELECT id FROM startups WHERE slug = 'biosight'),
 'Dr. Claire Dumont', 'CEO & Co-Founder',
 'CNRS Research Director, computational biology. 12 publications in molecular imaging and machine learning applications in drug discovery. PhD Université Claude Bernard Lyon 1.',
 ARRAY['academic_spinout']::founder_signal_type[]),

((SELECT id FROM startups WHERE slug = 'biosight'),
 'Dr. Thomas Roux', 'CTO & Co-Founder',
 'CNRS Researcher, 8 publications in AI for microscopy. Previously postdoc at Max Planck Institute. PhD ENS Lyon.',
 ARRAY['academic_spinout']::founder_signal_type[]),

((SELECT id FROM startups WHERE slug = 'sentinelops'),
 'Karim Benzarti', 'CEO & Co-Founder',
 'Former Principal Engineer at Thales Cybersecurity (2017–2025). Led autonomous threat response R&D. École Polytechnique + ENSTA Paris.',
 ARRAY['big_tech_alumni']::founder_signal_type[]),

((SELECT id FROM startups WHERE slug = 'axone'),
 'Dr. Sophie Laurent', 'CEO & Co-Founder',
 'Former senior researcher at CEA-Leti (2018–2025). Expert in neuromorphic architectures. PhD in microelectronics, Université Grenoble Alpes. 6 patents.',
 ARRAY['academic_spinout']::founder_signal_type[]),

((SELECT id FROM startups WHERE slug = 'revero-health'),
 'Antoine Mercier', 'CEO & Founder',
 'Repeat founder — previous healthtech exit (undisclosed). 10 years in clinical research technology. MBA HEC Paris, MSc Bioinformatics Université Paris-Saclay.',
 ARRAY['repeat_founder']::founder_signal_type[]);

-- ============================================
-- SIGNALS
-- ============================================

INSERT INTO signals (startup_id, signal_date, signal_type, strength, title, description) VALUES

-- NovaMind AI
((SELECT id FROM startups WHERE slug = 'novamind-ai'), '2026-03-14', 'advisory_formation', 'positive', 'Advisory board formation', 'Three advisors added: ex-Salesforce VP Product, Inria ML researcher, and a partner at a top-tier Paris VC.'),
((SELECT id FROM startups WHERE slug = 'novamind-ai'), '2026-03-08', 'key_hire', 'positive', '4th engineering hire posted', 'Senior ML Engineer role posted on Welcome to the Jungle. Focus on multi-agent coordination.'),
((SELECT id FROM startups WHERE slug = 'novamind-ai'), '2026-02-22', 'restructuring', 'positive', 'Corporate restructuring', 'SAS entity converted to SA. Commonly precedes external fundraising.'),
((SELECT id FROM startups WHERE slug = 'novamind-ai'), '2026-01-15', 'incorporation', 'neutral', 'Company incorporated', 'NovaMind AI SAS registered in Paris. Initial capital: €10,000.'),
((SELECT id FROM startups WHERE slug = 'novamind-ai'), '2025-12-02', 'founder_departure', 'neutral', 'Founder departure from DeepMind', 'Lead researcher exits DeepMind London. LinkedIn updated with "Building something new."'),

-- Katrix.AI
((SELECT id FROM startups WHERE slug = 'katrix-ai'), '2026-01-10', 'incorporation', 'neutral', 'Company registered', 'Katrix.AI SAS registered in Meudon. Minimal public information available.'),

-- BioSight
((SELECT id FROM startups WHERE slug = 'biosight'), '2026-03-12', 'patent_ip', 'positive', 'Patent filing detected', 'European patent application filed for AI-assisted molecular imaging classification method.'),
((SELECT id FROM startups WHERE slug = 'biosight'), '2026-03-05', 'incorporation', 'neutral', 'CNRS spinout incorporated', 'BioSight SAS incorporated in Lyon with CNRS technology transfer agreement.'),

-- SentinelOps
((SELECT id FROM startups WHERE slug = 'sentinelops'), '2026-03-18', 'key_hire', 'positive', 'VP Engineering hired from Palo Alto Networks', 'Former VP Engineering at Palo Alto Networks joins as CTO. 15 years in cybersecurity.'),
((SELECT id FROM startups WHERE slug = 'sentinelops'), '2026-03-01', 'fundraising', 'positive', 'Fundraising signals detected', 'Multiple VC meetings reported. Estimated seed round of €3-5M.'),
((SELECT id FROM startups WHERE slug = 'sentinelops'), '2026-02-10', 'key_hire', 'positive', 'Head of Sales hired', 'Former Sekoia.io sales lead joins. Signal of go-to-market readiness.'),
((SELECT id FROM startups WHERE slug = 'sentinelops'), '2025-12-15', 'incorporation', 'neutral', 'Company incorporated', 'SentinelOps SAS registered in Paris.'),

-- Axone
((SELECT id FROM startups WHERE slug = 'axone'), '2026-02-28', 'pivot', 'warning', 'Pivot to automotive vertical', 'Company appears to have narrowed focus from general edge AI to automotive ADAS applications.'),

-- Revero Health
((SELECT id FROM startups WHERE slug = 'revero-health'), '2026-03-15', 'fundraising', 'positive', 'Fundraising activity detected', 'Founder seen at multiple VC events in Paris. Advisory connections suggest interest from top-tier health fund.'),
((SELECT id FROM startups WHERE slug = 'revero-health'), '2026-02-10', 'incorporation', 'neutral', 'Company incorporated', 'Revero Health SAS registered in Paris by repeat founder Antoine Mercier.');

-- ============================================
-- BADGES
-- ============================================

INSERT INTO startup_badges (startup_id, label, strength) VALUES
((SELECT id FROM startups WHERE slug = 'novamind-ai'), 'Fundraising Signal', 'positive'),
((SELECT id FROM startups WHERE slug = 'novamind-ai'), 'Founder Reboot', 'warning'),
((SELECT id FROM startups WHERE slug = 'novamind-ai'), 'Big Tech Alumni', 'positive'),
((SELECT id FROM startups WHERE slug = 'katrix-ai'), 'Founder Reboot', 'warning'),
((SELECT id FROM startups WHERE slug = 'katrix-ai'), 'First Seen Jan 2026', 'neutral'),
((SELECT id FROM startups WHERE slug = 'biosight'), 'IP Signal', 'positive'),
((SELECT id FROM startups WHERE slug = 'biosight'), 'Academic Spinout', 'neutral'),
((SELECT id FROM startups WHERE slug = 'sentinelops'), 'Key Hire', 'positive'),
((SELECT id FROM startups WHERE slug = 'sentinelops'), 'Fundraising Signal', 'positive'),
((SELECT id FROM startups WHERE slug = 'axone'), 'Academic Spinout', 'neutral'),
((SELECT id FROM startups WHERE slug = 'axone'), 'Pivot', 'warning'),
((SELECT id FROM startups WHERE slug = 'revero-health'), 'Fundraising Signal', 'positive'),
((SELECT id FROM startups WHERE slug = 'revero-health'), 'Repeat Founder', 'positive');
```

---

## Design System

### Color Tokens (oklch for Tailwind v4)

The full CSS file uses oklch color space for precision. Here are the key values mapped to both oklch and approximate hex for reference:

| Token | Role | oklch | Approx Hex |
|-------|------|-------|-----------|
| `--background` | Page bg | `oklch(0.985 0.003 260)` | `#f8f9fb` |
| `--foreground` | Primary text | `oklch(0.21 0.02 255)` | `#0f172a` |
| `--primary` | Brand accent (deep indigo) | `oklch(0.50 0.18 275)` | `#4f46e5` |
| `--muted-foreground` | Secondary text | `oklch(0.53 0.015 255)` | `#7c8694` |
| `--border` | All borders | `oklch(0.91 0.006 255)` | `#e2e5ea` |
| `--card` | Card background | `oklch(1 0 0)` | `#ffffff` |
| `--destructive` | Risk/red | `oklch(0.60 0.22 28)` | `#dc2626` |
| `--success` | Positive/green | `oklch(0.62 0.14 155)` | `#059669` |
| `--warning` | Warning/amber | `oklch(0.72 0.16 85)` | `#d97706` |

### Signal Badge Colors

| Signal | Background | Border | Text |
|--------|-----------|--------|------|
| Positive (green) | `emerald-50` | `emerald-200` | `emerald-700` |
| Warning (amber) | `amber-50` | `amber-200` | `amber-700` |
| Risk (red) | `rose-50` | `rose-200` | `rose-700` |
| Neutral (gray) | `muted` | `border` | `muted-foreground` |

### Full globals.css

Use this complete CSS file as `app/globals.css`:

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";

@custom-variant dark (&:is(.dark *));

@theme inline {
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);

  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-success: var(--success);
  --color-success-foreground: var(--success-foreground);
  --color-warning: var(--warning);
  --color-warning-foreground: var(--warning-foreground);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);

  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);

  --shadow-xs: 0 1px 2px rgb(15 23 42 / 0.04);
  --shadow-sm: 0 1px 2px rgb(15 23 42 / 0.06), 0 1px 1px rgb(15 23 42 / 0.03);
  --shadow-md: 0 8px 24px rgb(15 23 42 / 0.08);
}

:root {
  --radius: 0.75rem;
  --background: oklch(0.985 0.003 260);
  --foreground: oklch(0.21 0.02 255);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.21 0.02 255);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.21 0.02 255);
  --primary: oklch(0.50 0.18 275);
  --primary-foreground: oklch(0.985 0.002 260);
  --secondary: oklch(0.965 0.004 255);
  --secondary-foreground: oklch(0.28 0.02 255);
  --muted: oklch(0.965 0.004 255);
  --muted-foreground: oklch(0.53 0.015 255);
  --accent: oklch(0.955 0.012 270);
  --accent-foreground: oklch(0.28 0.02 255);
  --destructive: oklch(0.60 0.22 28);
  --destructive-foreground: oklch(0.985 0.002 260);
  --success: oklch(0.62 0.14 155);
  --success-foreground: oklch(0.985 0.002 260);
  --warning: oklch(0.72 0.16 85);
  --warning-foreground: oklch(0.22 0.02 255);
  --border: oklch(0.91 0.006 255);
  --input: oklch(0.91 0.006 255);
  --ring: oklch(0.50 0.18 275);
  --sidebar: oklch(0.975 0.004 255);
  --sidebar-foreground: oklch(0.25 0.02 255);
  --sidebar-primary: oklch(0.50 0.18 275);
  --sidebar-primary-foreground: oklch(0.985 0.002 260);
  --sidebar-accent: oklch(0.955 0.012 270);
  --sidebar-accent-foreground: oklch(0.28 0.02 255);
  --sidebar-border: oklch(0.91 0.006 255);
  --sidebar-ring: oklch(0.50 0.18 275);
}

@layer base {
  * { @apply border-border outline-ring/50; }
  html { color-scheme: light; }
  body {
    @apply bg-background text-foreground font-sans antialiased;
    font-feature-settings: "rlig" 1, "calt" 1;
  }
  ::selection { @apply bg-primary/15 text-foreground; }
}

@layer components {
  .page-container { @apply mx-auto w-full max-w-[1600px] px-4 md:px-6; }
  .section-title { @apply text-sm font-semibold tracking-tight text-foreground; }
  .section-kicker { @apply text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground; }
  .data-card { @apply rounded-xl border bg-card text-card-foreground shadow-xs transition-shadow hover:shadow-sm; }
  .data-card-compact { @apply rounded-lg border bg-card text-card-foreground shadow-xs; }
  .metric-label { @apply text-xs font-medium uppercase tracking-wide text-muted-foreground; }
  .metric-value { @apply text-sm font-semibold text-foreground; }
  .subtle-divider { @apply border-t border-border; }

  .badge-signal { @apply inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium; }
  .badge-signal-positive { @apply border-emerald-200 bg-emerald-50 text-emerald-700; }
  .badge-signal-warning { @apply border-amber-200 bg-amber-50 text-amber-700; }
  .badge-signal-risk { @apply border-rose-200 bg-rose-50 text-rose-700; }
  .badge-signal-neutral { @apply border-border bg-muted text-muted-foreground; }

  .sidebar-surface { @apply rounded-xl border bg-sidebar text-sidebar-foreground; }
  .table-toolbar { @apply flex flex-col gap-3 border-b bg-card px-4 py-3 md:flex-row md:items-center md:justify-between; }
  .table-row-hover { @apply transition-colors hover:bg-muted/50; }
}
```

### Spacing & Layout Rules

| Element | Value |
|---------|-------|
| Card border-radius | `rounded-xl` |
| Input/button radius | `rounded-lg` |
| Max content width | `max-w-[1600px]` |
| Default shadow | `shadow-xs` |
| Hover shadow | `shadow-sm` |
| Feature card shadow | `shadow-md` (sparingly) |
| Borders | Always subtle, never heavy |
| Table rows | Compact density |
| Cards | Medium density |
| Marketing pages | More breathing room |

### What NOT to Do

- No bright gradients
- No more than one accent color
- No oversized rounded corners
- No giant shadows
- No dense color-coded cards
- No "AI neon" visuals
- No startup hype landing page aesthetic
- This should feel like research software, not a hype product

---

## Page Architecture

### Root Layout (`app/layout.tsx`)

```typescript
import type { Metadata } from "next"
import { GeistSans, GeistMono } from "geist/font"
import "./globals.css"

export const metadata: Metadata = {
  title: "French AI Radar",
  description: "Investor intelligence for the French AI ecosystem",
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>{children}</body>
    </html>
  )
}
```

### App Routes

```
app/
├── layout.tsx                    # Root layout with Geist fonts
├── globals.css                   # Design tokens (above)
├── page.tsx                      # Landing page (public)
├── pricing/
│   └── page.tsx                  # Pricing page (public)
├── auth/
│   ├── login/page.tsx            # Login form
│   ├── signup/page.tsx           # Signup form
│   └── callback/route.ts        # Supabase auth callback
├── database/
│   ├── layout.tsx                # Database layout with sidebar
│   └── page.tsx                  # Database browse/search (auth required)
├── startup/
│   └── [slug]/page.tsx           # Individual startup profile (auth required)
├── api/
│   ├── stripe/
│   │   ├── checkout/route.ts     # Create Stripe Checkout session
│   │   └── webhook/route.ts      # Handle Stripe webhooks
│   └── startups/
│       └── route.ts              # API route for filtered startup queries
```

---

## Page Specifications

### Page 1: Landing Page (`app/page.tsx`)

**Access:** Public (no auth required)

**Sections (top to bottom):**

1. **Top Nav** — Sticky, blurred background. Logo (indigo square "AR" + "AI Radar"), nav links (Home, Database, Pricing), Login + "Get Access" CTA button.

2. **Hero** — Kicker pill ("Investor Intelligence Platform"), headline "The French AI Ecosystem, Decoded for Investors" (with "Decoded for Investors" in primary indigo), subtext explaining the product, two CTAs: "Explore the Database →" (primary) and "View Sample Report" (secondary).

3. **Social Proof Bar** — 4-column grid: "523 Startups Tracked", "2,140 Signals Detected", "48 Sectors Covered", "Weekly Updated". Bordered card with gap-based grid.

4. **Value Props** — Section kicker "Why AI Radar", heading "Intelligence, Not Noise". Three cards in a grid: Signal Detection (⚡), Founder Intelligence (👤), Sector Mapping (◎). Each has an indigo icon container, bold title, and descriptive paragraph.

5. **Sample Cards** — "See What's Inside" — three real startup intelligence cards from the database, clickable, showing the data density investors will get. Use the `data-card` component class.

6. **Bottom CTA** — "Ready to see the full picture?" with pricing button.

7. **Footer** — Minimal: "AI Radar by French Tech Journal · Privacy · Terms · Contact · © 2026"

### Page 2: Database Browse (`app/database/page.tsx`)

**Access:** Authenticated users only. Free users see limited results (first 10 startups, no signal details). Explorer sees 50/month. Professional sees all.

**Layout:** 2-column — 260px left sidebar + fluid right content area.

**Left Sidebar (sticky):**
- Header: kicker "Filters" + title "Narrow the radar"
- Filter sections separated by `subtle-divider`:
  - **Time Period:** checkboxes (Last 30 days, Last 90 days, Last 12 months, All time)
  - **Sector:** checkboxes for each `sector_type` enum value
  - **Founder Signal:** checkboxes for each `founder_signal_type`
  - **Signal Type:** checkboxes for each `signal_type`
  - **Stage:** checkboxes for each `stage_type`
  - **Location:** checkboxes (Paris/Île-de-France, Lyon, Toulouse, Grenoble, Other)
- "Reset Filters" button at bottom

**Right Content:**
- **Toolbar:** Search input (with search icon), results count ("Showing X of Y startups"), Sort dropdown (Newest, Signal Strength, Funding), Export button.
- **Card Grid:** `grid-template-columns: repeat(auto-fill, minmax(320px, 1fr))` with 14px gap.
- **Each Card:** Uses `data-card` class. Shows: startup name (bold), meta line (city · sector · date), badge row (signal badges), one-line description, italic takeaway, signal footer with colored dot + count + recency.

**Filtering:** Use URL search params for filter state so filters are shareable/bookmarkable. Query Supabase server-side based on filters.

### Page 3: Startup Profile (`app/startup/[slug]/page.tsx`)

**Access:** Authenticated. Free users see name/sector/badges only. Professional sees full investor brief, timeline, founder details, funding analysis.

**Layout:** Single column, max-width 960px, centered.

**Sections:**

1. **Back Link** — "← Back to Database" ghost button

2. **Header** — 2-column flex: Left has name (26px bold), meta line (city, sector, founded date), badge row. Right has action buttons: "Export PDF" (secondary), "Save" (secondary), "Share" (secondary), "Set Alert" (primary).

3. **Investor Brief** — Section header (uppercase, 13px, bordered bottom). 2–3 paragraphs of editorial analysis. Bold lead sentence. "Why this matters" callout.

4. **Key Signals (Timeline)** — Vertical timeline with left border line, indigo dots, date labels (11px uppercase), and description text. Most recent at top. Data from `signals` table.

5. **Founders** — 2-column grid of founder cards. Each card has: name (bold), role (indigo), bio paragraph. Background is `--bg` not `--bg-card` for subtle differentiation.

6. **Product & Market** — Three paragraphs: What they're building, Target market, Competitive landscape. Bold lead-ins.

7. **Funding History** — `data-card-compact` with 3-column metric grid (Total Raised, Last Round, Est. Next Raise) + divider + editorial paragraph on fundraising outlook.

### Page 4: Pricing (`app/pricing/page.tsx`)

**Access:** Public

**Layout:**

1. **Header** — Kicker "Pricing", heading "Choose Your Intelligence Level", subtitle, billing toggle (Monthly / Annual with "Save 20%" tag).

2. **Three Tier Cards** — max-width 960px, 3-column grid:

| | Explorer | Professional | Enterprise |
|---|---------|-------------|-----------|
| **Price** | €49/mo | €149/mo | Custom |
| **Highlighted** | No | Yes (featured border + "Recommended" badge) | No |
| **Features** | 50 profiles/mo, basic filters, weekly digest, name search | Unlimited profiles, all filters, full briefs/timelines, 10 PDF exports/mo, saved searches, priority alerts | Everything in Pro + unlimited exports, API, custom watchlists, team seats (10), account manager |
| **CTA** | "Start Exploring" (secondary) | "Go Professional" (primary) | "Contact Us" (secondary) |

Professional card has: `border-color: var(--primary)`, outer glow shadow, and absolute-positioned "Recommended" pill badge.

CTA buttons trigger Stripe Checkout sessions via `/api/stripe/checkout`.

3. **FAQ Accordion** — 5 items using `<details>` elements: data sources, update frequency, cancellation, free trial, differentiation from Crunchbase/Dealroom.

---

## Authentication Flow

### Supabase Auth Setup

Use `@supabase/ssr` for server-side auth in Next.js App Router.

**Key files:**
- `lib/supabase/server.ts` — Server-side Supabase client (for Server Components and Route Handlers)
- `lib/supabase/client.ts` — Browser-side Supabase client
- `middleware.ts` — Refresh session on every request, protect `/database` and `/startup` routes

**Auth pages:**
- `/auth/login` — Email + password form, link to signup
- `/auth/signup` — Email + password + full name, link to login
- `/auth/callback` — Handles OAuth/magic link redirects

**Protected routes:** Middleware checks for valid session on `/database/*` and `/startup/*`. Redirects to `/auth/login` if not authenticated.

**Subscription gating logic:**
```typescript
// lib/subscription.ts
export function canAccessFullProfile(tier: string): boolean {
  return ['professional', 'enterprise'].includes(tier)
}

export function getStartupLimit(tier: string): number | null {
  switch(tier) {
    case 'free': return 10
    case 'explorer': return 50
    case 'professional': return null // unlimited
    case 'enterprise': return null
    default: return 10
  }
}
```

---

## Stripe Integration

### Products & Prices

Create in Stripe Dashboard:
- **Product:** "AI Radar Explorer" → Monthly (€49) + Annual (€470)
- **Product:** "AI Radar Professional" → Monthly (€149) + Annual (€1,430)
- **Product:** "AI Radar Enterprise" → Custom (handle via contact form, not Checkout)

### Checkout Flow

1. User clicks pricing CTA → hits `/api/stripe/checkout` with `tier` and `interval` params
2. Route handler creates Stripe Checkout Session with the correct `price_id`
3. Includes `customer_email` from Supabase session and `metadata.user_id`
4. Redirects to Stripe Checkout
5. On success, redirects back to `/database`

### Webhook Flow (`/api/stripe/webhook`)

Handle these events:
- `checkout.session.completed` → Create/update profile with `stripe_customer_id`, set `subscription_tier`, set `subscription_status: 'active'`
- `customer.subscription.updated` → Update tier and status
- `customer.subscription.deleted` → Set tier to `'free'`, status to `'canceled'`
- `invoice.payment_failed` → Set status to `'past_due'`

**Important:** Use `SUPABASE_SERVICE_ROLE_KEY` in webhook handler (not anon key) since webhooks run without a user session.

---

## Deployment (Vercel)

### Steps

1. Push to GitHub
2. Import repo in Vercel
3. Set all environment variables in Vercel project settings
4. Add Stripe webhook endpoint: `https://your-domain.vercel.app/api/stripe/webhook`
5. Update `NEXT_PUBLIC_APP_URL` to production URL

### Vercel Config

No special `vercel.json` needed — Next.js App Router deploys automatically. The `/api/stripe/webhook` route needs raw body parsing for Stripe signature verification:

```typescript
// app/api/stripe/webhook/route.ts
export const runtime = 'nodejs'

// Disable body parsing — Stripe needs raw body
export async function POST(request: Request) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')!
  // Verify with stripe.webhooks.constructEvent(body, signature, webhookSecret)
}
```

---

## Component Reference Snippets

### Startup Card (for database grid)

```tsx
<Card className="data-card cursor-pointer">
  <CardHeader className="space-y-3 pb-3">
    <div className="flex items-start justify-between gap-3">
      <div>
        <h3 className="text-base font-semibold tracking-tight">{startup.name}</h3>
        <p className="text-sm text-muted-foreground">{startup.city}, France</p>
      </div>
      <Badge variant="secondary">{sectorLabel(startup.sector)}</Badge>
    </div>
    <div className="flex flex-wrap gap-2">
      {badges.map(badge => (
        <span key={badge.id} className={`badge-signal badge-signal-${badge.strength}`}>
          {badge.label}
        </span>
      ))}
    </div>
  </CardHeader>
  <CardContent className="space-y-3 pt-0">
    <p className="text-sm text-foreground">{startup.description}</p>
    <p className="text-sm italic text-muted-foreground">{/* takeaway */}</p>
  </CardContent>
</Card>
```

### Filter Sidebar

```tsx
<aside className="sidebar-surface sticky top-4 p-4">
  <div className="mb-4">
    <p className="section-kicker">Filters</p>
    <h2 className="section-title mt-1">Narrow the radar</h2>
  </div>
  <div className="space-y-5">
    <div>
      <p className="metric-label mb-2">Time</p>
      {/* checkbox group */}
    </div>
    <Separator />
    <div>
      <p className="metric-label mb-2">Sector</p>
      {/* checkbox group */}
    </div>
  </div>
</aside>
```

---

## Build Order (Recommended for Claude Code)

Follow this sequence for the smoothest build:

1. **Scaffold** — `npx create-next-app@latest ai-radar --typescript --tailwind --app --src-dir=false`
2. **Install deps** — Supabase, Stripe, shadcn/ui, Geist fonts
3. **Design system** — Set up `globals.css` with full token system, install shadcn components
4. **Database** — Run SQL schema + seed in Supabase SQL editor
5. **Supabase client** — Set up server/client helpers and middleware
6. **Auth pages** — Login, signup, callback
7. **Landing page** — Full marketing page (public)
8. **Database page** — Sidebar + card grid + server-side filtering
9. **Profile page** — Full startup detail page with gating
10. **Pricing page** — Three tiers + billing toggle
11. **Stripe checkout** — API route for creating sessions
12. **Stripe webhook** — Handle subscription lifecycle events
13. **Subscription gating** — Wire tier checks into database and profile pages
14. **Polish** — Animations, loading states, error handling, responsive
15. **Deploy** — Push to GitHub, import to Vercel, configure env vars + webhook

---

## Reference: HTML Prototype

The original interactive HTML prototype is included alongside this document as `ai-radar.html`. Open it in a browser to see the exact visual target for all four pages. The Next.js build should match this look and feel exactly.
