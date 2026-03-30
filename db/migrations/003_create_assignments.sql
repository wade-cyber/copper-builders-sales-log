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
