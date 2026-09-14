-- ===========================================
-- Migration 002: Localização e alertas
-- Tabelas pra rastrear idosos em tempo real
-- ===========================================

-- Tabela de localizações (uma por usuário, sempre a mais recente)
CREATE TABLE IF NOT EXISTS localizacoes (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  accuracy DOUBLE PRECISION,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de alertas SOS
CREATE TABLE IF NOT EXISTS sos_alertas (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  maps_link TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sos_user_time ON sos_alertas(user_id, created_at DESC);

-- Tabela de check-ins "tô bem"
CREATE TABLE IF NOT EXISTS checkins (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_checkins_user_time ON checkins(user_id, created_at DESC);

-- Adiciona coluna phone na profiles se não existir
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT;

-- Habilita RLS
ALTER TABLE localizacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE sos_alertas ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkins ENABLE ROW LEVEL SECURITY;

-- Policies pra localizacoes
DROP POLICY IF EXISTS "Usuário pode atualizar a própria localização" ON localizacoes;
CREATE POLICY "Usuário pode atualizar a própria localização"
  ON localizacoes FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Responsáveis podem ver localizações dos vinculados" ON localizacoes;
CREATE POLICY "Responsáveis podem ver localizações dos vinculados"
  ON localizacoes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM care_links cl
      WHERE cl.responsavel_id = auth.uid()
      AND cl.idoso_id = localizacoes.user_id
    )
  );

-- Policies pra sos_alertas
DROP POLICY IF EXISTS "Usuário pode criar próprios alertas SOS" ON sos_alertas;
CREATE POLICY "Usuário pode criar próprios alertas SOS"
  ON sos_alertas FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuário vê próprios SOS" ON sos_alertas;
CREATE POLICY "Usuário vê próprios SOS"
  ON sos_alertas FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Responsáveis veem SOS dos vinculados" ON sos_alertas;
CREATE POLICY "Responsáveis veem SOS dos vinculados"
  ON sos_alertas FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM care_links cl
      WHERE cl.responsavel_id = auth.uid()
      AND cl.idoso_id = sos_alertas.user_id
    )
  );

-- Policies pra checkins
DROP POLICY IF EXISTS "Usuário pode criar próprios checkins" ON checkins;
CREATE POLICY "Usuário pode criar próprios checkins"
  ON checkins FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuário vê próprios checkins" ON checkins;
CREATE POLICY "Usuário vê próprios checkins"
  ON checkins FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Responsáveis veem checkins dos vinculados" ON checkins;
CREATE POLICY "Responsáveis veem checkins dos vinculados"
  ON checkins FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM care_links cl
      WHERE cl.responsavel_id = auth.uid()
      AND cl.idoso_id = checkins.user_id
    )
  );
