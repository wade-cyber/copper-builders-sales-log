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
