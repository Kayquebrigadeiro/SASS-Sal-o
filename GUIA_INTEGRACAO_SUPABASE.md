# 🔗 GUIA DE INTEGRAÇÃO DO SUPABASE

## Seu Schema + Melhorias UX

Este documento explicava como integrar o arquivo `MIGRATIONS_MELHORIAS_UX.sql` com seu schema existente.

---

## ✅ Compatibilidade Verificada

Seu schema em Supabase já tem:

✅ **Multi-tenancy** — `salao_id` em todas as tabelas  
✅ **RLS Policies** — Isolamento por salão  
✅ **Triggers automáticos** — Cálculos em `fn_calcular_atendimento()`  
✅ **Views seguras** — `security_invoker = true` em todas as views  
✅ **Type enums** — `categoria_enum`, `status_enum`, etc.  

---

## 🚀 Passo-a-Passo para Aplicar as Melhorias

### **PASSO 1: Executar o SQL**

1. Abra o **Supabase Dashboard** do seu projeto
2. Vá para **SQL Editor** → **+ New Query**
3. Copie TODO o conteúdo de [`MIGRATIONS_MELHORIAS_UX.sql`](../MIGRATIONS_MELHORIAS_UX.sql)
4. Cole no editor
5. Clique em **Run** (ou Cmd/Ctrl + Enter)

**Esperado:** Sem erros. Status "Success".

### **PASSO 2: Verificar Criação da Tabela**

Execute esta query no SQL Editor:

```sql
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'gastos_pessoais'
ORDER BY ordinal_position;
```

**Esperado Output:**
```
table_name        | column_name  | data_type | is_nullable
------------------|--------------|-----------|------------
gastos_pessoais   | id           | uuid      | NO
gastos_pessoais   | salao_id     | uuid      | NO
gastos_pessoais   | descricao    | text      | NO
gastos_pessoais   | valor        | numeric   | NO
gastos_pessoais   | criado_em    | timestamp | YES
gastos_pessoais   | atualizado_em| timestamp | YES
```

### **PASSO 3: Verificar RLS Policies**

Execute:

```sql
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'gastos_pessoais'
ORDER BY policyname;
```

**Esperado:**
- 1 policy: `"Isolar gastos pessoais por salao"`
- Cobre: SELECT, INSERT, UPDATE, DELETE
- Baseia-se em: `salao_id IN (SELECT salao_id FROM perfis_acesso WHERE auth_user_id = auth.uid())`

### **PASSO 4: Verificar Trigger**

Execute:

```sql
SELECT 
  trigger_name,
  event_object_table,
  trigger_timing,
  event_manipulation
FROM information_schema.triggers
WHERE trigger_name LIKE '%gastos%';
```

**Esperado:**
```
trigger_name                             | event_object_table | trigger_timing | event_manipulation
-----------------------------------------|-------------------|----------------|--------------------
trigger_atualizar_timestamp_gastos_pessoais | gastos_pessoais  | BEFORE         | UPDATE
```

### **PASSO 5: Verificar View (Opcional)**

Execute:

```sql
SELECT * FROM public.gastos_pessoais_resumo LIMIT 1;
```

**Esperado:** Sem erros (pode estar vazu se sem dados ainda).

### **PASSO 6: Teste de Inserção**

Para testar, você precisa primeiro de um `salao_id` válido. Execute:

```sql
-- Ver seus salões
SELECT id, nome FROM public.saloes LIMIT 5;
```

Depois, substitua `seu-salao-uuid-aqui`:

```sql
INSERT INTO public.gastos_pessoais (salao_id, descricao, valor)
VALUES (
  'seu-salao-uuid-aqui'::uuid,
  'Teste - Aluguel',
  2000.00
);

-- Verifique se foi inserido
SELECT * FROM public.gastos_pessoais ORDER BY criado_em DESC LIMIT 1;
```

---

## 📱 Integração com Frontend (React)

Seu frontend em React já foi atualizado para usar a tabela `gastos_pessoais`. 

### Arquivo Modificado: `src/pages/Configuracoes.jsx`

**Função `AbaSalao`:**

```javascript
// Carrega dados incluindo gastos pessoais
const carregarDados = async () => {
  const [{ data: cfgData }, { data: gastosData }, { data: fechData }] = 
    await Promise.all([
      supabase.from('configuracoes').select('*').eq('salao_id', salaoId).single(),
      supabase.from('gastos_pessoais').select('*').eq('salao_id', salaoId),
      supabase.from('fechamento_mensal').select('...').eq('salao_id', salaoId)...
    ]);
};

// Adicionar gasto pessoal
const adicionarGasto = async (e) => {
  await supabase.from('gastos_pessoais').insert([{
    salao_id: salaoId,
    descricao: novoGasto.descricao,
    valor: Number(novoGasto.valor),
  }]);
};

// Remover gasto pessoal
const removerGasto = async (id) => {
  await supabase.from('gastos_pessoais').delete().eq('id', id);
};
```

**Você não precisa fazer nada no frontend** — já foi integrado! ✅

---

## 🎯 Fluxo de Dados Completo

```
┌─────────────────────────────────────────────────┐
│  React: Configurações > Aba Salão              │
│  "Calculadora de Pró-labore"                   │
└──────────────────┬──────────────────────────────┘
                   │
       ┌───────────┼───────────┐
       │           │           │
       ▼           ▼           ▼
   SELECT      SELECT      SELECT
   gastos_     fechamento_ config-
   pessoais    mensal      urações
       │           │           │
       └───────────┼───────────┘
                   │
       ┌───────────▼───────────┐
       │  Cálculos no Frontend │
       │  (JavaScript puro)    │
       │                       │
       │ totalGastos = SUM($)  │
       │ receita = DB["sal"]   │
       │ diferenca = receita - │
       │            totalGastos│
       └───────────┬───────────┘
                   │
       ┌───────────▼───────────┐
       │  Render Card com      │
       │  Status 🟢 ou 🔴     │
       └───────────────────────┘

INSERT/DELETE gastos_pessoais
       │
       ▼
RLS Policy
(auth_user_id → salao_id)
       │
       ▼
Supabase DB
       │
       ▼
Trigger: atualizar_timestamp_gastos_pessoais()
       │
       ▼
Success ✅
```

---

## 🔒 Segurança (RLS)

A política `"Isolar gastos pessoais por salao"` garante:

```javascript
// Um usuário autenticado em salao_id = "ABC"
// Consegue VER/EDITAR apenas gastos onde salao_id = "ABC"

// Mesmo que faça:
SELECT * FROM gastos_pessoais; -- Retorna apenas de ABC ✓

// Não consegue:
INSERT INTO gastos_pessoais (salao_id, ...) 
VALUES ('XYZ-outro-salao', ...); -- RLS bloqueia ✗

DELETE FROM gastos_pessoais WHERE salao_id = 'XYZ'; -- RLS bloqueia ✗
```

---

## ⚠️ Troubleshooting

### Erro: "Table does not exist"

**Causa:** O SQL não foi executado com sucesso.  
**Solução:**
1. Verifique se não há erros na execução
2. Verifique que está no projeto Supabase correto
3. Execute novamente

### Erro: "No rows returned" ao consultar gastos_pessoais

**Causa:** Ainda não há dados (tabela vazia).  
**Solução:** Isto é normal! Adicione o primeiro gasto pela interface do React.

### Erro: "RLS policy violation"

**Causa:** O usuário tenta acessar gastos de outro salão.  
**Solução:** Verificar que `auth.uid()` está sendo passado corretamente. Isto é segurança funcionando! ✓

### Erro: "Function atualizar_timestamp_gastos does not exist"

**Causa:** O trigger não foi criado.  
**Solução:** Execute novamente o SQL migration completo.

---

## 📊 Dados de Teste (Opcional)

Para testar a calculadora com alguns gastos iniciais:

```sql
-- Substitua os salao_ids reais de seu projeto
DO $$
DECLARE
  v_salao_id UUID;
BEGIN
  -- Pegar primeiro salão
  SELECT id INTO v_salao_id FROM public.saloes LIMIT 1;
  
  IF v_salao_id IS NOT NULL THEN
    INSERT INTO public.gastos_pessoais (salao_id, descricao, valor) VALUES
      (v_salao_id, 'Aluguel', 2000.00),
      (v_salao_id, 'Energia', 150.00),
      (v_salao_id, 'Água', 50.00),
      (v_salao_id, 'Internet', 100.00),
      (v_salao_id, 'Alimentação', 800.00),
      (v_salao_id, 'Transporte', 300.00),
      (v_salao_id, 'Acessórios', 200.00);
    
    RAISE NOTICE 'Dados de teste inseridos para salao_id: %', v_salao_id;
  ELSE
    RAISE NOTICE 'Nenhum salão encontrado!';
  END IF;
END $$;

-- Verificar
SELECT COUNT(*) as total_gastos, SUM(valor) as total_valor
FROM public.gastos_pessoais;
```

---

## 🎓 Próximos Passos

1. ✅ Execute o SQL
2. ✅ Teste inserir/deletar gastos na UI
3. ✅ Verifique que a calculadora mostra valores corretos
4. ✅ Teste RLS deslogando e logando com outro usuário para confirmar isolamento

---

## 📚 Documentação Relacionada

- [`MIGRATIONS_MELHORIAS_UX.sql`](../MIGRATIONS_MELHORIAS_UX.sql) — SQL completo
- [`IMPLEMENTACAO_MELHORIAS_RESUMO.md`](../IMPLEMENTACAO_MELHORIAS_RESUMO.md) — Resumo das melhorias
- [`src/pages/Configuracoes.jsx`](../src/pages/Configuracoes.jsx) — Frontend code
- Seu schema SQL original (neste documento anterior)

---

✅ **Tudo pronto para integrar!**

Qualquer dúvida, consulte este guia ou o arquivo SQL comentado.

**Data:** 2026-04-04 | **Versão:** 1.0
