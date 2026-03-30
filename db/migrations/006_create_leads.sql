-- Lead records from the OSC Leads Report (This Week's Report tab).
-- Tracks marketing-generated leads by community.
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
