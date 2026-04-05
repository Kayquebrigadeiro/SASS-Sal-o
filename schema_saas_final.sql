-- ============================================================
--  LIMPEZA INICIAL - PREPARAÇÃO PARA O SAAS
-- ============================================================
drop view if exists ranking_procedimentos cascade;
drop view if exists rendimento_por_profissional cascade;
drop view if exists saude_financeira_atual cascade;
drop view if exists fechamento_mensal cascade;
drop view if exists agenda_do_dia cascade;

drop table if exists despesas cascade;
drop table if exists procedimentos_paralelos cascade;
drop table if exists homecare cascade;
drop table if exists atendimentos cascade;
drop table if exists procedimentos cascade;
drop table if exists profissionais cascade;
drop table if exists configuracoes cascade;
drop table if exists perfis_acesso cascade;
drop table if exists saloes cascade;

drop type if exists cargo_enum cascade;
drop type if exists comprimento_enum cascade;
drop type if exists status_enum cascade;
drop type if exists categoria_enum cascade;
drop type if exists tipo_despesa_enum cascade;

-- ============================================================
--  SCHEMA FINAL — SAAS MULTI-TENANT (Com RLS nas Views!)
-- ============================================================

create extension if not exists "uuid-ossp";

create type cargo_enum        as enum ('PROPRIETARIO', 'FUNCIONARIO', 'VENDEDOR');
create type comprimento_enum  as enum ('P', 'M', 'G');
create type status_enum       as enum ('AGENDADO', 'EXECUTADO', 'CANCELADO');
create type categoria_enum    as enum ('CABELO', 'UNHAS', 'SOBRANCELHAS', 'CILIOS', 'OUTRO');
create type tipo_despesa_enum as enum (
  'ALUGUEL', 'ENERGIA', 'AGUA', 'INTERNET', 'MATERIAL',
  'EQUIPAMENTO', 'FORNECEDOR', 'FUNCIONARIO', 'OUTRO'
);

-- =======================
--  1. NÚCLEO DO SAAS (TENANTS & PERFIS)
-- =======================
create table saloes (
  id          uuid primary key default uuid_generate_v4(),
  nome        text not null default 'Meu Salão',
  telefone    text,
  ativo       boolean not null default true,
  criado_em   timestamptz default now()
);

create table perfis_acesso (
  auth_user_id  uuid primary key references auth.users(id) on delete cascade,
  salao_id      uuid not null references saloes(id) on delete cascade,
  cargo         cargo_enum not null default 'PROPRIETARIO',
  criado_em     timestamptz default now()
);

create table configuracoes (
  id                         uuid primary key default uuid_generate_v4(),
  salao_id                   uuid not null unique references saloes(id) on delete cascade,
  custo_fixo_por_atendimento numeric(10,2) not null default 29.00,
  taxa_maquininha_pct        numeric(5,2)  not null default 5.00,
  prolabore_mensal           numeric(10,2) default 0,
  gastos_pessoais            jsonb not null default '[]'   -- ← ADICIONADO
);

-- =======================
--  2. TABELAS DE DOMÍNIO
-- =======================

create table profissionais (
  id            uuid primary key default uuid_generate_v4(),
  salao_id      uuid not null references saloes(id) on delete cascade,
  nome          text not null,
  cargo         cargo_enum not null default 'FUNCIONARIO',
  salario_fixo  numeric(10,2) not null default 0,
  ativo         boolean not null default true,
  criado_em     timestamptz default now()
);

create table procedimentos (
  id                       uuid primary key default uuid_generate_v4(),
  salao_id                 uuid not null references saloes(id) on delete cascade,
  nome                     text not null,
  categoria                categoria_enum not null default 'CABELO',
  requer_comprimento       boolean not null default true,
  preco_p                  numeric(10,2),
  preco_m                  numeric(10,2),
  preco_g                  numeric(10,2),
  custo_variavel           numeric(10,2) not null default 0,
  porcentagem_profissional numeric(5,2)  not null default 40,
  ativo                    boolean not null default true,
  criado_em                timestamptz default now(),
  unique(salao_id, nome)
);

create table atendimentos (
  id                  uuid primary key default uuid_generate_v4(),
  salao_id            uuid not null references saloes(id) on delete cascade,
  data                date not null,
  horario             time not null,
  profissional_id     uuid not null references profissionais(id),
  procedimento_id     uuid not null references procedimentos(id),
  comprimento         comprimento_enum,
  cliente             text not null,
  valor_cobrado       numeric(10,2),
  valor_maquininha    numeric(10,2),
  valor_profissional  numeric(10,2),
  custo_fixo          numeric(10,2),
  custo_variavel      numeric(10,2),
  lucro_liquido       numeric(10,2),
  lucro_possivel      numeric(10,2),
  pago                boolean not null default false,
  executado           boolean not null default false,
  status              status_enum not null default 'AGENDADO',
  obs                 text,
  criado_em           timestamptz default now(),
  atualizado_em       timestamptz default now()
);

create index idx_atendimentos_data         on atendimentos(data);
create index idx_atendimentos_profissional on atendimentos(profissional_id, data);
create index idx_atendimentos_status       on atendimentos(status);

create table homecare (
  id              uuid primary key default uuid_generate_v4(),
  salao_id        uuid not null references saloes(id) on delete cascade,
  data            date not null,
  cliente         text not null,
  produto         text not null,
  custo_produto   numeric(10,2) not null default 0,
  valor_venda     numeric(10,2) not null,
  valor_pago      numeric(10,2) not null default 0,
  valor_pendente  numeric(10,2) generated always as (valor_venda - valor_pago) stored,
  lucro           numeric(10,2) generated always as (valor_venda - custo_produto) stored,
  obs             text,
  criado_em       timestamptz default now()
);

create index idx_homecare_data on homecare(data);

create table procedimentos_paralelos (
  id              uuid primary key default uuid_generate_v4(),
  salao_id        uuid not null references saloes(id) on delete cascade,
  data            date not null,
  profissional_id uuid references profissionais(id),
  descricao       text not null,
  cliente         text not null,
  valor           numeric(10,2) not null,
  valor_pago      numeric(10,2) not null default 0,
  valor_pendente  numeric(10,2) generated always as (valor - valor_pago) stored,
  criado_em       timestamptz default now()
);

create index idx_paralelos_data on procedimentos_paralelos(data);

create table despesas (
  id          uuid primary key default uuid_generate_v4(),
  salao_id    uuid not null references saloes(id) on delete cascade,
  data        date not null,
  descricao   text not null,
  tipo        tipo_despesa_enum not null default 'OUTRO',
  valor       numeric(10,2) not null,
  pago        boolean not null default false,
  criado_em   timestamptz default now()
);

create index idx_despesas_data on despesas(data);

-- =======================
--  3. FUNÇÕES MATEMÁTICAS E TRIGGERS
-- =======================

create or replace function fn_calcular_atendimento()
returns trigger language plpgsql as $$
declare
  v_proc    procedimentos%rowtype;
  v_cfg     configuracoes%rowtype;
  v_preco   numeric(10,2);
begin
  select * into v_proc from procedimentos where id = new.procedimento_id;
  select * into v_cfg  from configuracoes   where salao_id = new.salao_id;

  if not v_proc.requer_comprimento or new.comprimento = 'P' then
    v_preco := v_proc.preco_p;
  elsif new.comprimento = 'M' then
    v_preco := coalesce(v_proc.preco_m, v_proc.preco_p);
  elsif new.comprimento = 'G' then
    v_preco := coalesce(v_proc.preco_g, v_proc.preco_p);
  else
    v_preco := coalesce(v_proc.preco_p, 0);
  end if;

  if new.valor_cobrado is null then
    new.valor_cobrado := v_preco;
  end if;

  if v_cfg.id is null then
     new.valor_maquininha := 0;
     new.custo_fixo       := 0;
  else
     new.valor_maquininha   := round(new.valor_cobrado * coalesce(v_cfg.taxa_maquininha_pct, 0) / 100, 2);
     new.custo_fixo         := coalesce(v_cfg.custo_fixo_por_atendimento, 0);
  end if;

  new.valor_profissional := round(new.valor_cobrado * v_proc.porcentagem_profissional / 100, 2);
  new.custo_variavel     := v_proc.custo_variavel;

  new.lucro_liquido := new.valor_cobrado
    - new.valor_maquininha
    - new.valor_profissional
    - new.custo_fixo
    - new.custo_variavel;

  new.lucro_possivel := new.valor_cobrado
    - new.valor_profissional
    - new.custo_fixo
    - new.custo_variavel;

  if new.status = 'CANCELADO' then
    new.valor_maquininha   := 0;
    new.valor_profissional := 0;
    new.lucro_liquido      := 0;
    new.lucro_possivel     := 0;
  end if;

  new.atualizado_em := now();
  return new;
end;
$$;

create trigger trg_calcular_atendimento
  before insert or update on atendimentos
  for each row execute function fn_calcular_atendimento();

-- Função Inteligente de Criação de Usuário
create or replace function public.handle_new_user_salao()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_salao_id uuid;
  v_cargo cargo_enum;
begin
  v_salao_id := (new.raw_user_meta_data->>'salao_id')::uuid;
  v_cargo    := coalesce((new.raw_user_meta_data->>'cargo')::cargo_enum, 'PROPRIETARIO'::cargo_enum);

  if v_salao_id is null then
    insert into public.saloes (nome)
    values ('Salão de ' || coalesce(new.email, 'Usuário'))
    returning id into v_salao_id;

    insert into public.configuracoes (salao_id, custo_fixo_por_atendimento, taxa_maquininha_pct)
    values (v_salao_id, 29.00, 5.00);
  end if;

  insert into public.perfis_acesso (auth_user_id, salao_id, cargo)
  values (new.id, v_salao_id, v_cargo);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user_salao();

-- =======================
--  4. VIEWS DE RESULTADO (SEGURAS COM SECURITY_INVOKER)
-- =======================

create or replace view agenda_do_dia with (security_invoker = true) as
select
  a.id, a.salao_id, a.data, a.horario, a.cliente, a.comprimento, a.valor_cobrado,
  a.valor_profissional, a.lucro_liquido, a.lucro_possivel,
  a.pago, a.executado, a.status, a.obs,
  p.id as profissional_id, p.nome as profissional_nome, p.cargo,
  pr.id as procedimento_id, pr.nome as procedimento_nome,
  pr.categoria, pr.requer_comprimento
from atendimentos a
join profissionais  p  on p.id  = a.profissional_id
join procedimentos  pr on pr.id = a.procedimento_id
order by a.data, a.horario, p.nome;

create or replace view fechamento_mensal with (security_invoker = true) as
with base as (
  select salao_id, date_trunc('month', data)::date as mes from atendimentos
  union select salao_id, date_trunc('month', data)::date from homecare
  union select salao_id, date_trunc('month', data)::date from procedimentos_paralelos
  union select salao_id, date_trunc('month', data)::date from despesas
),
atend as (
  select
    salao_id, date_trunc('month', data)::date as mes,
    sum(valor_cobrado) filter (where status <> 'CANCELADO') as receita_bruta,
    sum(valor_cobrado) filter (where pago = true) as receita_recebida,
    sum(valor_cobrado) filter (where executado = true and pago = false) as pendencias,
    sum(valor_maquininha) filter (where status <> 'CANCELADO') as total_maquininha,
    sum(valor_profissional) filter (where status <> 'CANCELADO') as total_profissionais,
    sum(custo_fixo) filter (where status <> 'CANCELADO') as total_custo_fixo,
    sum(custo_variavel) filter (where status <> 'CANCELADO') as total_custo_variavel,
    sum(lucro_liquido) filter (where status <> 'CANCELADO') as lucro_liquido,
    sum(lucro_possivel) filter (where status <> 'CANCELADO') as lucro_possivel,
    count(*) filter (where status <> 'CANCELADO') as total_atendimentos,
    count(*) filter (where status = 'CANCELADO') as total_cancelamentos
  from atendimentos group by 1,2
),
hc as (
  select salao_id, date_trunc('month', data)::date as mes, sum(valor_venda) as receita_homecare,
  sum(valor_pago) as recebido_homecare, sum(valor_pendente) as pendente_homecare, sum(lucro) as lucro_homecare
  from homecare group by 1,2
),
pp as (
  select salao_id, date_trunc('month', data)::date as mes, sum(valor) as receita_paralelos,
  sum(valor_pago) as recebido_paralelos, sum(valor_pendente) as pendente_paralelos
  from procedimentos_paralelos group by 1,2
),
desp as (
  select salao_id, date_trunc('month', data)::date as mes, sum(valor) as total_despesas
  from despesas group by 1,2
),
sal as (
  select salao_id, sum(salario_fixo) as total_salarios_fixos
  from profissionais where ativo = true and cargo = 'FUNCIONARIO' group by salao_id
)
select
  b.salao_id,
  b.mes,
  coalesce(a.receita_bruta, 0)            as receita_bruta,
  coalesce(a.receita_recebida, 0)         as receita_recebida,
  coalesce(a.pendencias, 0)               as pendencias,
  coalesce(a.total_maquininha, 0)         as total_maquininha,
  coalesce(a.total_profissionais, 0)      as total_profissionais,
  coalesce(a.total_custo_fixo, 0)         as total_custo_fixo,
  coalesce(a.total_custo_variavel, 0)     as total_custo_variavel,
  coalesce(a.lucro_liquido, 0)            as lucro_liquido_atendimentos,
  coalesce(a.lucro_possivel, 0)           as lucro_possivel_atendimentos,
  coalesce(a.total_atendimentos, 0)       as total_atendimentos,
  coalesce(a.total_cancelamentos, 0)      as total_cancelamentos,
  coalesce(h.receita_homecare, 0)         as receita_homecare,
  coalesce(h.lucro_homecare, 0)           as lucro_homecare,
  coalesce(h.pendente_homecare, 0)        as pendente_homecare,
  coalesce(p.receita_paralelos, 0)        as receita_paralelos,
  coalesce(p.pendente_paralelos, 0)       as pendente_paralelos,
  coalesce(d.total_despesas, 0)           as total_despesas,
  coalesce(s.total_salarios_fixos, 0)     as total_salarios_fixos,
  coalesce(a.receita_bruta, 0) + coalesce(h.receita_homecare, 0) + coalesce(p.receita_paralelos, 0) as receita_total,
  coalesce(a.lucro_liquido, 0) + coalesce(h.lucro_homecare, 0) - coalesce(d.total_despesas, 0) - coalesce(s.total_salarios_fixos, 0) as saude_financeira
from base b
left join atend a on a.salao_id = b.salao_id and a.mes = b.mes
left join hc    h on h.salao_id = b.salao_id and h.mes = b.mes
left join pp    p on p.salao_id = b.salao_id and p.mes = b.mes
left join desp  d on d.salao_id = b.salao_id and d.mes = b.mes
left join sal   s on s.salao_id = b.salao_id
order by b.mes desc;

-- ← ADICIONADO: view ranking_procedimentos
create or replace view ranking_procedimentos with (security_invoker = true) as
select
  a.salao_id,
  date_trunc('month', a.data)::date as mes,
  pr.nome as procedimento,
  count(*) filter (where a.status <> 'CANCELADO') as quantidade,
  sum(a.valor_cobrado) filter (where a.status <> 'CANCELADO') as receita_total,
  sum(a.lucro_liquido) filter (where a.status <> 'CANCELADO') as lucro_total,
  round(
    sum(a.valor_cobrado) filter (where a.status <> 'CANCELADO') /
    nullif(count(*) filter (where a.status <> 'CANCELADO'), 0)
  , 2) as ticket_medio
from atendimentos a
join procedimentos pr on pr.id = a.procedimento_id
group by a.salao_id, date_trunc('month', a.data)::date, pr.nome;

-- ← ADICIONADO: view rendimento_por_profissional
create or replace view rendimento_por_profissional with (security_invoker = true) as
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

-- =======================
--  5. SEGURANÇA MÁXIMA (RLS)
-- =======================
alter table saloes                  enable row level security;
alter table perfis_acesso           enable row level security;
alter table configuracoes           enable row level security;
alter table profissionais           enable row level security;
alter table procedimentos           enable row level security;
alter table atendimentos            enable row level security;
alter table homecare                enable row level security;
alter table procedimentos_paralelos enable row level security;
alter table despesas                enable row level security;

create policy "Saloes isolation"    on saloes for all to authenticated using (id in (select salao_id from perfis_acesso where auth_user_id = auth.uid()));
create policy "Read own profile"    on perfis_acesso for select to authenticated using (auth_user_id = auth.uid());
create policy "Isolar configuracoes" on configuracoes for all to authenticated using (salao_id in (select salao_id from perfis_acesso where auth_user_id = auth.uid()));
create policy "Isolar profs"        on profissionais for all to authenticated using (salao_id in (select salao_id from perfis_acesso where auth_user_id = auth.uid()));
create policy "Isolar procs"        on procedimentos for all to authenticated using (salao_id in (select salao_id from perfis_acesso where auth_user_id = auth.uid()));
create policy "Isolar atendim"      on atendimentos for all to authenticated using (salao_id in (select salao_id from perfis_acesso where auth_user_id = auth.uid()));
create policy "Isolar homecare"     on homecare for all to authenticated using (salao_id in (select salao_id from perfis_acesso where auth_user_id = auth.uid()));
create policy "Isolar parale"       on procedimentos_paralelos for all to authenticated using (salao_id in (select salao_id from perfis_acesso where auth_user_id = auth.uid()));
create policy "Isolar despes"       on despesas for all to authenticated using (salao_id in (select salao_id from perfis_acesso where auth_user_id = auth.uid()));
