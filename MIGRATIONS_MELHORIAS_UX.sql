-- ════════════════════════════════════════════════════════════════════════════════
-- MIGRATIONS PARA MELHORIAS DE UX E NOVOS RECURSOS
-- Projeto: SaaS para Salões de Beleza
-- Data: 2026-04-04
-- Integração com schema existente do Supabase
-- ════════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────────
-- 1. Tabela de gastos pessoais (para Calculadora de Pró-labore)
-- ─────────────────────────────────────────────────────────────────────────────────
-- Permite rastrear gastos pessoais da proprietária para comparar com receita
-- Segue o mesmo padrão de multi-tenancy do esquema existente

CREATE TABLE IF NOT EXISTS public.gastos_pessoais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  salao_id UUID NOT NULL REFERENCES public.saloes(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  valor NUMERIC(10, 2) NOT NULL CHECK (valor >= 0),
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para queries mais rápidas
CREATE INDEX IF NOT EXISTS idx_gastos_pessoais_salao_id 
  ON public.gastos_pessoais(salao_id);

CREATE INDEX IF NOT EXISTS idx_gastos_pessoais_criado_em 
  ON public.gastos_pessoais(criado_em DESC);

-- ─────────────────────────────────────────────────────────────────────────────────
-- 2. Ativar RLS na tabela gastos_pessoais
-- ─────────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.gastos_pessoais ENABLE ROW LEVEL SECURITY;

-- Política: Apenas proprietários (ou admin) do salão podem ver seus gastos
CREATE POLICY "Isolar gastos pessoais por salao"
  ON public.gastos_pessoais
  FOR ALL
  TO authenticated
  USING (
    salao_id IN (
      SELECT salao_id 
      FROM public.perfis_acesso 
      WHERE auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    salao_id IN (
      SELECT salao_id 
      FROM public.perfis_acesso 
      WHERE auth_user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────────
-- 3. Trigger para atualizar timestamp automático
-- ─────────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.atualizar_timestamp_gastos()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Remove trigger antigo se existir
DROP TRIGGER IF EXISTS trigger_atualizar_timestamp_gastos_pessoais 
  ON public.gastos_pessoais;

-- Cria novo trigger
CREATE TRIGGER trigger_atualizar_timestamp_gastos_pessoais
  BEFORE UPDATE ON public.gastos_pessoais
  FOR EACH ROW
  EXECUTE FUNCTION public.atualizar_timestamp_gastos();

-- ─────────────────────────────────────────────────────────────────────────────────
-- 4. View: Resumo de gastos pessoais por mês (opcional, para future analytics)
-- ─────────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.gastos_pessoais_resumo WITH (security_invoker = true) AS
SELECT
  g.salao_id,
  DATE_TRUNC('month', g.criado_em)::date AS mes,
  COUNT(*) AS quantidade_gastos,
  SUM(g.valor) AS total_gastos,
  ROUND(AVG(g.valor), 2) AS gasto_medio
FROM public.gastos_pessoais g
GROUP BY g.salao_id, DATE_TRUNC('month', g.criado_em)::date
ORDER BY g.salao_id, mes DESC;

-- ═════════════════════════════════════════════════════════════════════════════════
-- INSTRUÇÕES DE APLICAÇÃO
-- ═════════════════════════════════════════════════════════════════════════════════

-- PASSO 1: Copie e execute este arquivo no Editor SQL do Supabase em:
-- https://app.supabase.com/project/seu-projeto/sql/editor

-- PASSO 2: Verifique se a tabela foi criada com sucesso:
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_name = 'gastos_pessoais';

-- PASSO 3: Verifique se as políticas RLS foram aplicadas:
-- SELECT policyname, tablename FROM pg_policies 
-- WHERE tablename = 'gastos_pessoais';

-- PASSO 4: Teste uma inserção (substitua o seu salao_id real):
-- INSERT INTO public.gastos_pessoais (salao_id, descricao, valor)
-- VALUES ('seu-salao-id-aqui', 'Aluguel', 2000.00);

-- PASSO 5: Verifique a view de resumo:
-- SELECT * FROM public.gastos_pessoais_resumo;

-- ═════════════════════════════════════════════════════════════════════════════════
-- INTEGRAÇÃO COM FRONTEND (REACT)
-- ═════════════════════════════════════════════════════════════════════════════════

-- A tabela `gastos_pessoais` é utilizada pela seguinte funcionalidade:
--
-- Tela: Configurações > Aba Salão > Calculadora de Pró-labore
-- Componente: AbaSalao em src/pages/Configuracoes.jsx
--
-- Operações:
-- - SELECT: Carrega gastos pessoais do mês
-- - INSERT: Adiciona novo gasto pessoal
-- - UPDATE: Não implementado (apenas um click remove)
-- - DELETE: Remove gasto (com confirmação)
--
-- RLS garante que cada proprietário vê apenas seus gastos (by salao_id)

-- ═════════════════════════════════════════════════════════════════════════════════
