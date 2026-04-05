-- Execute no Supabase SQL Editor

-- 1. Adiciona coluna gastos_pessoais na tabela configuracoes
alter table configuracoes
  add column if not exists gastos_pessoais jsonb not null default '[]';

-- 2. View ranking_procedimentos (necessária para o Dashboard)
create or replace view ranking_procedimentos as
select
  a.salao_id,
  date_trunc('month', a.data)::date as mes,
  pr.nome as procedimento,
  count(*) filter (where a.status <> 'CANCELADO') as quantidade,
  sum(a.valor_cobrado) filter (where a.status <> 'CANCELADO') as receita_total,
  sum(a.lucro_liquido) filter (where a.status <> 'CANCELADO') as lucro_total,
  round(
    sum(a.valor_cobrado) filter (where a.status <> 'CANCELADO') /
    nullif(count(*) filter (where a.status <> 'CANCELADO'), 0),
  2) as ticket_medio
from atendimentos a
join procedimentos pr on pr.id = a.procedimento_id
group by a.salao_id, date_trunc('month', a.data)::date, pr.nome;

-- 3. View rendimento_por_profissional (necessária para o Dashboard)
create or replace view rendimento_por_profissional as
select
  a.salao_id,
  date_trunc('month', a.data)::date as mes,
  p.nome as profissional,
  count(*) filter (where a.status <> 'CANCELADO') as total_atendimentos,
  sum(a.valor_cobrado) filter (where a.status <> 'CANCELADO') as receita_gerada,
  sum(a.valor_profissional) filter (where a.status <> 'CANCELADO') as rendimento_variavel,
  p.salario_fixo,
  sum(a.valor_profissional) filter (where a.status <> 'CANCELADO') + p.salario_fixo as rendimento_total
from atendimentos a
join profissionais p on p.id = a.profissional_id
group by a.salao_id, date_trunc('month', a.data)::date, p.nome, p.salario_fixo;
