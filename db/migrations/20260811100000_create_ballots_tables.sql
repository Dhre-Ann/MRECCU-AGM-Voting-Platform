-- Cast event: one electronic ballot per voter per position;
-- one paper cast per poll-results submit (per position).
CREATE TABLE ballot_casts (
  id            SERIAL PRIMARY KEY,
  voter_id      INTEGER REFERENCES voters(id),          -- NULL for paper
  position_id   INTEGER NOT NULL REFERENCES positions(id),
  source        TEXT NOT NULL CHECK (source IN ('electronic', 'paper')),
  cast_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ballot_casts_electronic_voter_chk CHECK (
    (source = 'electronic' AND voter_id IS NOT NULL)
    OR (source = 'paper' AND voter_id IS NULL)
  )
);

-- Race closer: one electronic cast per (voter, position)
CREATE UNIQUE INDEX ballot_casts_one_electronic_per_voter_position
  ON ballot_casts (voter_id, position_id)
  WHERE source = 'electronic';

CREATE TABLE ballot_lines (
  id            SERIAL PRIMARY KEY,
  cast_id       INTEGER NOT NULL REFERENCES ballot_casts(id) ON DELETE CASCADE,
  candidate_id  INTEGER NOT NULL REFERENCES candidates(id),
  quantity      INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  UNIQUE (cast_id, candidate_id)
);

CREATE INDEX ballot_casts_position_id_idx ON ballot_casts (position_id);
CREATE INDEX ballot_lines_candidate_id_idx ON ballot_lines (candidate_id);
