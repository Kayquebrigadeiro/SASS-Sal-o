# ✅ CHECKLIST DE IMPLEMENTAÇÃO

## 🚀 Deploy das Melhorias UX — SaaS Salão

**Data:** 2026-04-04  
**Versão:** 1.0  
**Responsável:** [Seu Nome]

---

## 📋 PHASE 1: PREPARAÇÃO

- [ ] **1.1** — Fazer backup do banco de dados Supabase
  - Acesse: https://app.supabase.com/project/[seu-projeto]/settings/backups
  - Clique: "Create manual backup"

- [ ] **1.2** — Verificar que está no projeto correto
  - URL deve ser: `https://app.supabase.com/project/[seu-projeto]/sql/editor`

- [ ] **1.3** — Baixar/copiar arquivo de migrations
  - Arquivo: `MIGRATIONS_MELHORIAS_UX.sql`
  - Localização: `/projeto-sass/SASS-Salão/`

---

## 💾 PHASE 2: APLICAR SQL

- [ ] **2.1** — Abrir SQL Editor no Supabase
  - https://app.supabase.com/project/[seu-projeto]/sql/editor

- [ ] **2.2** — Criar Nova Query
  - Clique: **"+ New Query"**

- [ ] **2.3** — Copiar conteúdo completo de `MIGRATIONS_MELHORIAS_UX.sql`

- [ ] **2.4** — Colar no Editor SQL

- [ ] **2.5** — Executar Query
  - Botão: **"Run"** (canto superior direito)
  - Ou: **Cmd/Ctrl + Enter**

- [ ] **2.6** — Verificar resultado
  - Status deve ser: **"Success"** (em verde)
  - Sem mensagens de erro (em vermelho)

---

## ✔️ PHASE 3: VALIDAR CRIAÇÃO

### 3.1 — Verificar Tabela

```sql
-- Execute esta query no SQL Editor:
SELECT table_name FROM information_schema.tables 
WHERE table_name = 'gastos_pessoais';
```

✅ **Esperado:** 1 linha com `gastos_pessoais`

- [ ] Tabela foi criada com sucesso

### 3.2 — Verificar Colunas

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'gastos_pessoais'
ORDER BY ordinal_position;
```

✅ **Esperado:** 6 colunas (id, salao_id, descricao, valor, criado_em, atualizado_em)

- [ ] Todas as colunas existem

### 3.3 — Verificar RLS Policy

```sql
SELECT policyname, tablename FROM pg_policies 
WHERE tablename = 'gastos_pessoais';
```

✅ **Esperado:** 1 linha com `"Isolar gastos pessoais por salao"`

- [ ] RLS policy foi criada

### 3.4 — Verificar Trigger

```sql
SELECT trigger_name FROM information_schema.triggers 
WHERE trigger_name LIKE '%gastos%';
```

✅ **Esperado:** 1 linha com `trigger_atualizar_timestamp_gastos_pessoais`

- [ ] Trigger foi criado

### 3.5 — Verificar View (Opcional)

```sql
SELECT * FROM public.gastos_pessoais_resumo;
```

✅ **Esperado:** Query executa sem erro (pode estar vazia)

- [ ] View foi criada com sucesso

---

## 🧪 PHASE 4: TESTE DE FUNCIONAMENTO

### 4.1 — Testar INSERT

```sql
-- Primeiro, pegue um salao_id real:
SELECT id, nome FROM public.saloes LIMIT 1;

-- Depois, insira um teste (substitua seu-salao-id):
INSERT INTO public.gastos_pessoais (salao_id, descricao, valor)
VALUES ('seu-salao-id-aqui'::uuid, 'Teste - Aluguel', 2000.00);
```

✅ **Esperado:** "1 row inserted"

- [ ] INSERT funciona

### 4.2 — Testar SELECT

```sql
SELECT id, descricao, valor, criado_em 
FROM public.gastos_pessoais 
ORDER BY criado_em DESC LIMIT 1;
```

✅ **Esperado:** 1 linha com seus dados de teste

- [ ] SELECT funciona

### 4.3 — Testar UPDATE (Automático)

```sql
-- Aguarde 5 segundos, depois execute:
SELECT atualizado_em, criado_em 
FROM public.gastos_pessoais 
ORDER BY criado_em DESC LIMIT 1;

-- Agora, update a descrição:
UPDATE public.gastos_pessoais 
SET descricao = 'Teste - Aluguel (atualizado)' 
WHERE descricao = 'Teste - Aluguel';

-- Verifique que atualizado_em mudou:
SELECT atualizado_em FROM public.gastos_pessoais 
WHERE descricao = 'Teste - Aluguel (atualizado)';
```

✅ **Esperado:** `atualizado_em` é mais recente que `criado_em`

- [ ] UPDATE funciona
- [ ] Trigger atualiza timestamp automaticamente

### 4.4 — Testar DELETE

```sql
DELETE FROM public.gastos_pessoais 
WHERE descricao = 'Teste - Aluguel (atualizado)';

-- Verificar que foi deletado:
SELECT COUNT(*) FROM public.gastos_pessoais 
WHERE descricao = 'Teste - Aluguel (atualizado)';
```

✅ **Esperado:** 0 linhas (deletado com sucesso)

- [ ] DELETE funciona

---

## 👨‍💻 PHASE 5: TESTAR NO FRONTEND (React)

### 5.1 — Navegar para Configurações

- [ ] Abra o navegador
- [ ] Vá para: http://localhost:5173/configuracoes
- [ ] Clique na aba: **"Salão"**

### 5.2 — Expandir Calculadora de Pró-labore

- [ ] Clique no botão: **"📊 Calculadora de Pró-labore"**
- [ ] Deve expandir mostrando: "Gastos pessoais mensais"

### 5.3 — Adicionar Gasto Pessoal

- [ ] Preencha: Descrição = "Aluguel"
- [ ] Preencha: Valor = "2000"
- [ ] Clique: **"+ Adicionar"**
- [ ] Verifique que aparece na lista acima

- [ ] Item foi adicionado com sucesso

### 5.4 — Adicionar Outro Gasto

- [ ] Descrição = "Energia"
- [ ] Valor = "150"
- [ ] Clique: **"+ Adicionar"**

- [ ] Total atualiza para "2150"

### 5.5 — Remover Gasto

- [ ] Ao lado do gasto "Energia", clique: **"✕"**
- [ ] Confirme no dialog: **"Remover este gasto?"**
- [ ] Total volta para "2000"

- [ ] DELETE funciona pela UI

### 5.6 — Verificar Status

Deve mostrar seção "Resumo da saúde" com:
- À esquerda: "Total de gastos: R$ 2.000"
- Ao meio: "Receita do mês: R$ XXXX" (depende seus dados)
- À direita: "Diferença: +R$ XXXX ou −R$ XXXX"

- [ ] Cálculos estão corretos
- [ ] Cor é verde (✓ saudável) ou vermelha (⚠ precisa atenção)

---

## 🎨 PHASE 6: TESTAR OUTRAS MELHORIAS

### 6.1 — Aba Procedimentos

- [ ] Clique na aba: **"Procedimentos"**
- [ ] Verifique que aparecem todos os procedimentos
- [ ] Clique em um preço para editar (deve virar input)
- [ ] Digite novo valor + Enter
- [ ] Verifique ✓ verde ("salvo")

- [ ] Edição inline funciona

### 6.2 — Botão "+ Novo procedimento"

- [ ] Clique em: **"+ Novo procedimento"**
- [ ] Preencha: Nome, Categoria, Preço P, etc.
- [ ] Clique: **"Salvar novo"**
- [ ] Novo procedimento aparece na tabela

- [ ] Criação de novo procedimento funciona

### 6.3 — Agenda — Modal de Agendamento

- [ ] Clique em "Agenda"
- [ ] Clique em um slot vazio
- [ ] Modal abre
- [ ] Selecione um Procedimento
- [ ] Verifique: preview de preço aparece em box azul

- [ ] Preview de preço funciona

### 6.4 — Dashboard — Gráfico

- [ ] Clique em "Dashboard"
- [ ] Verifique se aparecem:
  - Gráfico com barras (Receita vs Lucro)
  - Cards com % de variação (▲/▼)
  - Última seção com botão "Marcar pago" inline

- [ ] Gráfico recharts está renderizando

---

## 🚨 PHASE 7: TROUBLESHOOTING

Se algo não funcionou, preencha a checklist abaixo:

### Erro: "Table does not exist"

- [ ] Volte para PHASE 2
- [ ] Verifique que não há erros vermelhos após executar o SQL
- [ ] Tente novamente

### Erro: "No results" ao consultar

- [ ] Tabela está vazia (isto é normal!)
- [ ] Tente inserir dados via PHASE 4

### RLS bloqueando acesso via React

- [ ] Verifique que está logado (auth.uid está definido)
- [ ] Abra DevTools (F12) > Console
- [ ] Verifique mensagens de erro do Supabase

### Componente React não renderiza dados

- [ ] Abra DevTools > Network
- [ ] Verifique que requests para gastos_pessoais retornam dados
- [ ] Se vazio, volte para PHASE 4 e adicione dados manualmente

---

## ✨ FASE 8: PÓS-DEPLOY

- [ ] Comunicar ao time que as melhorias estão live
- [ ] Documentar em Changelog/Release Notes
- [ ] Monitor a performance (views na DB)
- [ ] Coletar feedback dos users
- [ ] Reportar bugs encontrados

---

## 📞 SUPORTE

Se encontrar problemas:

1. Consulte [`GUIA_INTEGRACAO_SUPABASE.md`](./GUIA_INTEGRACAO_SUPABASE.md)
2. Verifique erros específicos na seção "Troubleshooting"
3. Revise [`IMPLEMENTACAO_MELHORIAS_RESUMO.md`](./IMPLEMENTACAO_MELHORIAS_RESUMO.md)

---

## 📝 NOTAS

```
Data início:     ___/___/______
Data conclusão:  ___/___/______
Testado por:     ____________________
Problemas encontrados: [ ] Nenhum [ ] SIM (descrever abaixo)
_________________________________________________________________
_________________________________________________________________

Observações:
_________________________________________________________________
_________________________________________________________________
```

---

**✅ CHECKLIST COMPLETO = DEPLOY SUCESSO! 🎉**

Parabéns! Todas as melhorias UX foram aplicadas com sucesso.
