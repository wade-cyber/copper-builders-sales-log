-- Matches the actual Sales Log App data model exactly.
-- One row per rep per community per week.
CREATE TABLE weekly_submissions (
  id SERIAL PRIMARY KEY,
  rep_id INTEGER NOT NULL REFERENCES reps(id),
  community_id INTEGER NOT NULL REFERENCES communities(id),
  week_ending DATE NOT NULL,
  section_type VARCHAR(30),

  -- Appointments by channel
  appts_virtual INTEGER DEFAULT 0 CHECK (appts_virtual >= 0),
  appts_in_person INTEGER DEFAULT 0 CHECK (appts_in_person >= 0),
  total_appts INTEGER DEFAULT 0 CHECK (total_appts >= 0),

  -- Direct leads by source
  leads_digital INTEGER DEFAULT 0 CHECK (leads_digital >= 0),
  leads_phone INTEGER DEFAULT 0 CHECK (leads_phone >= 0),
  leads_in_person INTEGER DEFAULT 0 CHECK (leads_in_person >= 0),

  -- Prospect counts at time of submission
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
