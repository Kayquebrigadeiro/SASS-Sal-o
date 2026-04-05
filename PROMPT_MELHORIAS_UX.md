# PROMPT — Melhorias de UX e Cadastro Dinâmico
## Para: Cursor / GitHub Copilot / VS Code AI
## Projeto: SaaS para Salões de Beleza (React + Vite + Tailwind + Supabase)

---

## CONTEXTO DO PROJETO

Sistema de gestão de salão convertido de uma planilha Excel complexa.
Stack: React + Vite + Tailwind CSS + Supabase (PostgreSQL + Auth).

**Arquivos existentes em `src/`:**
- `App.jsx` — roteador com React Router, controle de sessão e role
- `Sidebar.jsx` — menu lateral com navegação por role
- `Login.jsx` — tela de login
- `Agenda.jsx` — grade de horários × profissionais
- `Dashboard.jsx` — painel financeiro completo
- `HomeCar.jsx` — vendas de kits
- `Paralelos.jsx` — procedimentos paralelos (cílios, busso)
- `Despesas.jsx` — lançamento de despesas
- `Configuracoes.jsx` — configurações com 3 abas

**Banco de dados (Supabase):**
```
configuracoes    → nome_salao, custo_fixo_por_atendimento (R$29), taxa_maquininha_pct (5%), prolabore_mensal
profissionais    → id, salao_id, nome, cargo, salario_fixo, ativo
procedimentos    → id, salao_id, nome, categoria, requer_comprimento, preco_p, preco_m, preco_g, custo_variavel, porcentagem_profissional, ativo
atendimentos     → id, salao_id, data, horario, profissional_id, procedimento_id, comprimento, cliente, valor_cobrado, valor_maquininha, valor_profissional, custo_fixo, custo_variavel, lucro_liquido, lucro_possivel, pago, executado, status, obs
homecare         → id, salao_id, data, cliente, produto, custo_produto, valor_venda, valor_pago, valor_pendente (generated), lucro (generated)
procedimentos_paralelos → id, salao_id, data, profissional_id, descricao, cliente, valor, valor_pago, valor_pendente (generated)
despesas         → id, salao_id, data, descricao, tipo (enum), valor, pago
```

**Views já criadas no Supabase:**
- `fechamento_mensal` — agrega receita, custos, lucro por mês
- `rendimento_por_profissional` — comissões e rendimento por profissional/mês
- `ranking_procedimentos` — ranking de serviços por receita/lucro

---

## O QUE PRECISA SER MELHORADO

### 1. CONFIGURAÇÕES — ABA PROCEDIMENTOS (prioridade máxima)

A planilha Excel original tinha uma tabela de procedimentos muito mais rica.
O objetivo é replicar essa experiência de forma dinâmica.

**Como deve funcionar:**

**Tabela principal de procedimentos** com as colunas:
- Nome do procedimento
- Categoria (badge colorido: CABELO=verde, UNHAS=rosa, CÍLIOS=roxo, SOBRANCELHAS=âmbar, OUTRO=cinza)
- Requer comprimento? (toggle sim/não inline)
- Preço P / Preço M / Preço G (inputs inline editáveis ao clicar, com P/M/G em abas ou colunas agrupadas)
- Custo variável (R$) — quanto custa o produto por atendimento
- % Profissional — quanto vai para quem executou
- Ativo? (toggle)
- Preview do lucro estimado (campo calculado em tempo real: preco_p - custo_variavel - R$29 - preco_p×pct_prof% - preco_p×5%)

**Edição inline:** ao clicar em qualquer célula de preço, ela vira um input. Ao pressionar Enter ou sair do campo (onBlur), salva automaticamente no Supabase sem precisar de botão. Mostrar um indicador sutil de "salvo ✓" por 2 segundos.

**Adicionar novo procedimento:** botão "+ Adicionar procedimento" que abre uma linha nova vazia no topo da tabela, já em modo edição. O usuário preenche nome, categoria e preços diretamente na tabela.

**Cálculo de lucro em tempo real:** enquanto o usuário digita os preços, mostrar na coluna "Lucro est." o cálculo:
```
lucro = preco_p - (preco_p × taxa_maquininha%) - (preco_p × porcentagem_profissional%) - custo_variavel - custo_fixo
```

**Lista de procedimentos pré-definidos** para adicionar com 1 clique (tirados da planilha original):
Progressiva, Botox, Coloração, Luzes, Fusion, Hidratação, Reconstrução, Kit Lavatório, Corte, Unhas, Sobrancelha, Extensão de Cílios, Busso, Axila, Depilação, Detox, Plástica dos Fios, Nutrição

---

### 2. AGENDA — Modal de novo agendamento mais inteligente

**Problema atual:** o modal pede procedimento + comprimento e o usuário precisa lembrar o preço. É burocrático.

**Como deve ser:**

Ao selecionar o procedimento no dropdown, mostrar imediatamente um preview do preço abaixo do campo:
```
┌─────────────────────────────────────┐
│ Procedimento: [Coloração ▾]         │
│ ✓ Preço sugerido: R$ 80,00          │
│   (pode ser editado abaixo)         │
└─────────────────────────────────────┘
```

Ao selecionar comprimento (P/M/G), o preço atualiza automaticamente:
- P → preco_p
- M → preco_m
- G → preco_g

O campo "Valor cobrado" deve:
1. Ser pré-preenchido automaticamente ao selecionar procedimento/comprimento
2. Ser editável (para dar desconto)
3. Mostrar em tempo real o lucro estimado abaixo: "Lucro estimado: R$ XX,XX"

**Atalho de comprimento:** em vez de dropdown, usar 3 botões P / M / G destacados:
```
[  P  ] [  M  ] [  G  ]   (selecionado fica escuro)
```

---

### 3. AGENDA — Cards de atendimento mais informativos

**Como são agora:** mostram só nome do cliente e procedimento.

**Como devem ser:**
```
┌──────────────────────────┐
│ LILYA                    │
│ Luzes · G                │
│ R$ 230                   │
│ ● Agendado               │
└──────────────────────────┘
```

A cor da bolinha/borda indica o status:
- ● Azul = Agendado
- ● Amarelo = Executado (aguardando pagamento)
- ● Verde = Pago
- ● Cinza = Cancelado

---

### 4. CONFIGURAÇÕES — ABA PROFISSIONAIS mais fluida

**Problema atual:** lista estática, precisar clicar em botão para editar.

**Como deve ser:**

Edição inline de salário fixo — clicar no valor do salário vira um input, salva ao sair do campo.

Ao adicionar nova profissional, mostrar uma linha nova no topo da tabela já em modo edição (igual aos procedimentos).

Campo de usuário do sistema: ao lado de cada profissional, mostrar se ela já tem login no sistema (sim/não). Se não, botão "Convidar" que chama `supabase.auth.admin.inviteUserByEmail()` para criar o acesso dela.

---

### 5. CONFIGURAÇÕES — ABA SALÃO com calculadora de pró-labore

A aba Salão deve ter uma seção extra: **"Calculadora de pró-labore"** inspirada na planilha original (aba DESPESAS-RECEITA oculta).

**3 passos visuais:**

**Passo 1 — Gastos pessoais mensais:**
Lista editável dos gastos da proprietária:
```
[  Filho       ] [ R$ 400  ]  ✕
[  Energia     ] [ R$  75  ]  ✕
[  Alimentação ] [ R$ 380  ]  ✕
[  Aluguel     ] [ R$   0  ]  ✕
[  Internet    ] [ R$ 109  ]  ✕
[  Acessórios  ] [ R$ 530  ]  ✕
[  Aleatórios  ] [ R$ 406  ]  ✕
                  ──────────
                  Total: R$ 1.900
                 [+ Adicionar gasto]
```

**Passo 2 — O salão está pagando?**
Comparar o `prolabore_mensal` com o resultado real do mês (buscar da view `fechamento_mensal`):
```
Você precisa retirar:   R$ 1.900
O salão gerou (saúde):  R$ 2.340
Diferença:              + R$ 440  ← ícone verde
```

**Passo 3 — Resumo da saúde:**
```
✓ O salão está saudável este mês!
  Sobrou R$ 440 além do seu pró-labore.
```
ou
```
⚠ Atenção: faltaram R$ 200 para cobrir seu pró-labore.
  O salão gerou R$ 1.700 mas você precisa de R$ 1.900.
```

Salvar a lista de gastos pessoais em uma tabela `gastos_pessoais` no Supabase:
```sql
create table gastos_pessoais (
  id uuid primary key default uuid_generate_v4(),
  salao_id uuid references saloes(id),
  descricao text not null,
  valor numeric(10,2) not null,
  criado_em timestamptz default now()
);
```

---

### 6. DASHBOARD — Melhorias visuais

**Gráfico de barras:** usar `recharts` (já está no package.json como dependência do Vite/React ecosystem). Substituir as barrinhas DIV manuais por um `BarChart` real do recharts com tooltip ao hover.

```jsx
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

// Mostrar lado a lado: Receita Bruta (cinza) vs Lucro Líquido (verde)
```

**Cards de métricas:** adicionar uma setinha de comparação com o mês anterior:
```
Receita total
R$ 3.420
▲ +12% vs mês anterior
```

**Tabela de pendentes:** adicionar botão "Marcar pago" direto na tabela, sem precisar ir para a agenda. Chamar `supabase.from('atendimentos').update({pago: true})` ao clicar.

---

### 7. AGENDA — Navegação por semana (opcional, bônus)

Botão de toggle "Dia | Semana" no toolbar.

Na visão semana: colunas = dias da semana (Seg a Sab), linhas = horários.
Os atendimentos aparecem nos slots correspondentes.
Clicar em atendimento existente abre o modal de detalhes.
Clicar em slot vazio abre modal de novo agendamento com data pré-preenchida do dia da coluna.

---

## INSTRUÇÕES DE IMPLEMENTAÇÃO

1. **Edição inline com autosave:** usar o padrão `onBlur` + debounce de 300ms para salvar no Supabase. Mostrar estado de loading/salvo com um indicador sutil (não um alert/toast intrusivo — uma checkmark verde que some em 2s).

2. **Cálculos em tempo real:** todos os previews de lucro devem ser calculados no frontend com JavaScript, não fazer chamada ao banco. Os valores reais são salvos apenas quando o atendimento é criado (aí o trigger do banco recalcula).

3. **Estados de loading:** usar skeleton loading (divs cinzas animadas com `animate-pulse` do Tailwind) em vez de texto "Carregando...".

4. **Feedback de ações:** substituir `alert()` por um componente de toast simples no canto superior direito que some em 3 segundos. Pode ser implementado com um `useState` no App.jsx e passado via Context ou prop drilling simples.

5. **Responsividade:** manter foco no desktop (>= 1280px). Não precisa ser mobile-first.

6. **Consistência visual:** manter o padrão atual — fundo `bg-gray-50`, cards brancos com `border border-gray-200 rounded-xl`, textos `text-gray-800` / `text-gray-500`, botões primários `bg-gray-800 text-white`.

---

## ORDEM DE PRIORIDADE

1. Procedimentos — edição inline com cálculo de lucro em tempo real ← **mais impactante**
2. Modal da agenda — preço automático + botões P/M/G
3. Cards da agenda — mais informativos
4. Calculadora de pró-labore no painel Salão
5. Dashboard — gráfico recharts + comparação mês anterior
6. Profissionais — edição inline
7. Visão semana na agenda ← bônus

---

## EXEMPLO DE EDIÇÃO INLINE (padrão a seguir)

```jsx
function CelulaEditavel({ valor, onSave, tipo = 'number' }) {
  const [editando, setEditando] = useState(false);
  const [local, setLocal] = useState(valor);
  const [salvo, setSalvo] = useState(false);

  const handleBlur = async () => {
    setEditando(false);
    if (local !== valor) {
      await onSave(local);
      setSalvo(true);
      setTimeout(() => setSalvo(false), 2000);
    }
  };

  if (editando) {
    return (
      <input
        autoFocus
        type={tipo}
        value={local}
        onChange={e => setLocal(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={e => e.key === 'Enter' && handleBlur()}
        className="w-24 border border-blue-400 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-300"
      />
    );
  }

  return (
    <span
      onClick={() => setEditando(true)}
      className="cursor-pointer hover:bg-blue-50 px-2 py-1 rounded text-xs group flex items-center gap-1"
    >
      {local}
      {salvo && <span className="text-green-600 text-[10px]">✓</span>}
      <span className="text-gray-300 text-[10px] opacity-0 group-hover:opacity-100">✏</span>
    </span>
  );
}
```

---

## RESUMO DO QUE ENTREGAR

- [ ] `Configuracoes.jsx` refatorado — aba procedimentos com tabela inline rica
- [ ] `Configuracoes.jsx` — aba salão com calculadora pró-labore
- [ ] `Agenda.jsx` — modal atualizado com preview de preço e botões P/M/G
- [ ] `Agenda.jsx` — cards mais informativos
- [ ] `Dashboard.jsx` — gráfico recharts + comparativo mês anterior + marcar pago inline
- [ ] `gastos_pessoais.sql` — SQL da nova tabela para Supabase
- [ ] (bônus) `Agenda.jsx` — visão por semana
