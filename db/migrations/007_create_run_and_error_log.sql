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
