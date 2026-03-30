-- Copper Builders Sales Log — Full Schema
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- ============================================
-- Table 1: Communities
-- ============================================
CREATE TABLE communities (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL UNIQUE,
  division VARCHAR(10) NOT NULL CHECK (division IN ('CLT','CLB','TRN','GVL','WIL')),
  smartsheet_name VARCHAR(120),
  sheets_name VARCHAR(120),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- Table 2: Reps
-- ============================================
CREATE TABLE reps (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  email VARCHAR(200) UNIQUE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- Table 3: Assignments
-- ============================================
CREATE TABLE assignments (
  id SERIAL PRIMARY KEY,
  rep_id INTEGER NOT NULL REFERENCES reps(id),
  community_id INTEGER NOT NULL REFERENCES communities(id),
  week_ending DATE NOT NULL,
  source VARCHAR(20) DEFAULT 'smartsheet',
  third_party VARCHAR(10),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(rep_id, community_id, week_ending)
);
CREATE INDEX idx_assignments_week ON assignments(week_ending);
CREATE INDEX idx_assignments_rep ON assignments(rep_id, week_ending);

-- ============================================
-- Table 4: Weekly Submissions
-- ============================================
CREATE TABLE weekly_submissions (
  id SERIAL PRIMARY KEY,
  rep_id INTEGER NOT NULL REFERENCES reps(id),
  community_id INTEGER NOT NULL REFERENCES communities(id),
  week_ending DATE NOT NULL,
  section_type VARCHAR(30),
  appts_virtual INTEGER DEFAULT 0 CHECK (appts_virtual >= 0),
  appts_in_person INTEGER DEFAULT 0 CHECK (appts_in_person >= 0),
  total_appts INTEGER DEFAULT 0 CHECK (total_appts >= 0),
  leads_digital INTEGER DEFAULT 0 CHECK (leads_digital >= 0),
  leads_phone INTEGER DEFAULT 0 CHECK (leads_phone >= 0),
  leads_in_person INTEGER DEFAULT 0 CHECK (leads_in_person >= 0),
  active_prospects INTEGER DEFAULT 0 CHECK (active_prospects >= 0),
  sold_prospects INTEGER DEFAULT 0 CHECK (sold_prospects >= 0),
  removed_prospects INTEGER DEFAULT 0 CHECK (removed_prospects >= 0),
  grand_total_appts INTEGER DEFAULT 0 CHECK (grand_total_appts >= 0),
  submitted_at TIMESTAMPTZ DEFAULT now(),
  submitted_via VARCHAR(20) DEFAULT 'web_app',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(rep_id, community_id, week_ending)
);
CREATE INDEX idx_submissions_week ON weekly_submissions(week_ending);
CREATE INDEX idx_submissions_rep_week ON weekly_submissions(rep_id, week_ending);

-- ============================================
-- Table 5: Prospects
-- ============================================
CREATE TABLE prospects (
  id TEXT PRIMARY KEY,
  rep_id INTEGER NOT NULL REFERENCES reps(id),
  community_id INTEGER NOT NULL REFERENCES communities(id),
  prospect_name VARCHAR(150),
  ranking VARCHAR(5) DEFAULT 'C',
  next_step VARCHAR(200),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','sold','removed')),
  lot_number VARCHAR(50),
  created_date TIMESTAMPTZ DEFAULT now(),
  last_updated TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_prospects_rep ON prospects(rep_id);
CREATE INDEX idx_prospects_community ON prospects(community_id);
CREATE INDEX idx_prospects_status ON prospects(status);

-- ============================================
-- Table 6: Leads (OSC Report)
-- ============================================
CREATE TABLE leads (
  id SERIAL PRIMARY KEY,
  community_id INTEGER NOT NULL REFERENCES communities(id),
  week_ending DATE NOT NULL,
  digital_leads INTEGER DEFAULT 0,
  in_person_leads INTEGER DEFAULT 0,
  call_in_leads INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(community_id, week_ending)
);
CREATE INDEX idx_leads_week ON leads(week_ending);
CREATE INDEX idx_leads_community ON leads(community_id, week_ending);

-- ============================================
-- Table 7: Run Log & Error Log
-- ============================================
CREATE TABLE run_log (
  id SERIAL PRIMARY KEY,
  run_type VARCHAR(30) NOT NULL,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'running',
  records_processed INTEGER DEFAULT 0,
  errors JSONB,
  summary TEXT
);
CREATE INDEX idx_run_log_type_date ON run_log(run_type, started_at);

CREATE TABLE error_log (
  id SERIAL PRIMARY KEY,
  run_id INTEGER REFERENCES run_log(id),
  error_type VARCHAR(50) NOT NULL,
  message TEXT NOT NULL,
  stack_trace TEXT,
  context JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_error_log_run ON error_log(run_id);
