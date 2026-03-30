-- Individual prospect records with full detail.
-- Matches the current Prospects tab: ID, Rep, Community, Name, Ranking, Next Step, Status, Lot Number.
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
