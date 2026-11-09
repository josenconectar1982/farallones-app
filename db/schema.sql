-- Atlético Deportivo Farallones · Esquema PostgreSQL
-- Se ejecuta automáticamente al arrancar el servidor (idempotente).

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  phone         TEXT,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('admin','profesor','padre')),
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  age_from    INT,
  age_to      INT,
  schedule    TEXT,
  coach_id    INT REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS players (
  id           SERIAL PRIMARY KEY,
  full_name    TEXT NOT NULL,
  birth_date   DATE,
  category_id  INT REFERENCES categories(id) ON DELETE SET NULL,
  position     TEXT,
  dorsal       INT,
  dominant_foot TEXT,
  medical_notes TEXT,
  active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Un jugador puede tener varios acudientes (mamá, papá, abuela...)
CREATE TABLE IF NOT EXISTS player_guardians (
  player_id INT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  user_id   INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (player_id, user_id)
);

-- Seguimiento semanal: un registro por jugador por semana
CREATE TABLE IF NOT EXISTS evaluations (
  id              SERIAL PRIMARY KEY,
  player_id       INT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  coach_id        INT REFERENCES users(id) ON DELETE SET NULL,
  week_start      DATE NOT NULL,
  sessions_total  INT NOT NULL DEFAULT 0,
  sessions_attended INT NOT NULL DEFAULT 0,
  scores          JSONB NOT NULL DEFAULT '{}'::jsonb,
  goals           INT NOT NULL DEFAULT 0,
  assists         INT NOT NULL DEFAULT 0,
  highlight       TEXT,
  to_improve      TEXT,
  home_tip        TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (player_id, week_start)
);

CREATE TABLE IF NOT EXISTS announcements (
  id          SERIAL PRIMARY KEY,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  kind        TEXT NOT NULL DEFAULT 'aviso',
  audience    TEXT NOT NULL DEFAULT 'todos' CHECK (audience IN ('todos','padres','profesores','categoria')),
  category_id INT REFERENCES categories(id) ON DELETE CASCADE,
  created_by  INT REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id         SERIAL PRIMARY KEY,
  user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  url        TEXT,
  read_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         SERIAL PRIMARY KEY,
  user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint   TEXT NOT NULL UNIQUE,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_eval_player_week ON evaluations(player_id, week_start DESC);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_players_category ON players(category_id);
