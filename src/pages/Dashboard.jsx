import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../hooks/useAuth';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, ReferenceLine, ComposedChart, Line, Legend
} from 'recharts';

const Dashboard = () => {
  const { salaoId, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [alertasPrejuizo, setAlertasPrejuizo] = useState([]);
  const [dados, setDados] = useState({
    faturamentoMensal: [],
    rankingPossivel: [],
    lucroReal: [],
    rendimentoEquipe: [],
    comparativoGeral: [],
    kpis: { bruto: 0, possivel: 0, real: 0 }
  });

  // Cores da sua Planilha
  const COLORS = {
    primary: '#E85D24', // Laranja/Vermelho principal
    danger: '#A32D2D',  // Vermelho escuro de prejuízo
    teta: '#BA7517',    // Destaque da Teta
    light: '#E6F1FB'
  };

  const fmt = (val) => Number(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });


  useEffect(() => {
    if (authLoading || !salaoId) return;
    fetchDadosSaaS();
  }, [salaoId, authLoading]);

  const fetchDadosSaaS = async () => {
    setLoading(true);
    try {
      // 1. Faturamento Mensal (últimos 9 meses)
      const { data: atendimentos } = await supabase
        .from('atendimentos')
        .select('data, valor_cobrado, procedimentos(nome), profissionais(nome)')
        .eq('salao_id', salaoId)
        .eq('executado', true)
        .neq('status', 'CANCELADO');

      // 2. Agregar por mês
      const faturamentoMap = {};
      (atendimentos || []).forEach(a => {
        if (!a.data || !a.valor_cobrado) return;
        const mes = new Date(a.data).toLocaleString('pt-BR', { month: 'short', year: '2-digit' }).slice(0, 3).toLowerCase();
        if (!faturamentoMap[mes]) faturamentoMap[mes] = { mes, valor: 0, qtd: 0 };
        faturamentoMap[mes].valor += Number(a.valor_cobrado);
        faturamentoMap[mes].qtd += 1;
      });
      const faturamentoMensal = Object.values(faturamentoMap).slice(-9);

      // 3. Buscar configurações
      const { data: config } = await supabase
        .from('configuracoes')
        .select('custo_fixo_por_atendimento, taxa_maquininha_pct')
        .eq('salao_id', salaoId)
        .single();

      const custoFixo = Number(config?.custo_fixo_por_atendimento || 29);
      const taxaMaq = Number(config?.taxa_maquininha_pct || 5) / 100;
      const comissaoPadrao = 0.60; // 60% para funcionárias

      // 4. Função para calcular lucro real (conforme planilha)
      const calcularLucroReal = (valorBruto) => {
        const maquininha = valorBruto * taxaMaq;
        const valorBaseComissao = valorBruto - maquininha;
        const comissao = valorBaseComissao * comissaoPadrao;
        const lucro = valorBruto - maquininha - custoFixo - comissao;
        return lucro;
      };

      // 5. Lucro Possível (sem maquininha, com custo fixo e comissão)
      const calcularLucroPossivel = (valorBruto) => {
        const valorBaseComissao = valorBruto;
        const comissao = valorBaseComissao * comissaoPadrao;
        const lucro = valorBruto - custoFixo - comissao;
        return lucro;
      };

      // 6. Ranking por procedimento (lucro possível)
      const rankingMap = {};
      (atendimentos || []).forEach(a => {
        if (!a.procedimentos?.nome || !a.valor_cobrado) return;
        const nome = a.procedimentos.nome;
        if (!rankingMap[nome]) rankingMap[nome] = 0;
        rankingMap[nome] += calcularLucroPossivel(Number(a.valor_cobrado));
      });
      const rankingPossivel = Object.entries(rankingMap)
        .map(([nome, valor]) => ({ nome, valor: Math.round(valor * 100) / 100 }))
        .sort((a, b) => b.valor - a.valor)
        .slice(0, 10);

      // 7. Lucro Real por procedimento (com todos os custos)
      const lucroRealMap = {};
      const servicosComPrejuizo = [];
      (atendimentos || []).forEach(a => {
        if (!a.procedimentos?.nome || !a.valor_cobrado) return;
        const nome = a.procedimentos.nome;
        const lucroPorServico = calcularLucroReal(Number(a.valor_cobrado));
        if (!lucroRealMap[nome]) lucroRealMap[nome] = 0;
        lucroRealMap[nome] += lucroPorServico;
        // Detectar serviços com prejuízo
        if (lucroPorServico < 0) {
          servicosComPrejuizo.push({ procedimento: nome, lucro: lucroPorServico, valor: Number(a.valor_cobrado) });
        }
      });
      const lucroReal = Object.entries(lucroRealMap)
        .map(([nome, valor]) => ({ nome, valor: Math.round(valor * 100) / 100 }))
        .sort((a, b) => b.valor - a.valor)
        .slice(0, 10);
      
      // Agrupar alertas por procedimento para evitar duplicatas
      const alertasUnicos = Array.from(new Set(servicosComPrejuizo.map(s => s.procedimento)));
      setAlertasPrejuizo(alertasUnicos);

      // 8. Rendimento por profissional (apenas faturamento bruto)
      const rendimentoMap = {};
      (atendimentos || []).forEach(a => {
        if (!a.profissionais?.nome || !a.valor_cobrado) return;
        const nome = a.profissionais.nome;
        const valor = Number(a.valor_cobrado);
        if (!rendimentoMap[nome]) rendimentoMap[nome] = 0;
        rendimentoMap[nome] += valor;
      });
      const rendimentoEquipe = Object.entries(rendimentoMap)
        .map(([nome, valor]) => ({ nome, valor: Math.round(valor * 100) / 100 }))
        .sort((a, b) => b.valor - a.valor);

      // 9. KPIs
      const totalBruto = (atendimentos || []).reduce((sum, a) => sum + Number(a.valor_cobrado || 0), 0);
      const totalLucroPossivel = (atendimentos || []).reduce((sum, a) => sum + calcularLucroPossivel(Number(a.valor_cobrado || 0)), 0);
      const totalLucroReal = (atendimentos || []).reduce((sum, a) => sum + calcularLucroReal(Number(a.valor_cobrado || 0)), 0);

      // 10. Comparativo
      const comparativoGeral = [
        { label: 'Lucro possível', valor: Math.round(totalLucroPossivel * 100) / 100 },
        { label: 'Lucro real', valor: Math.round(totalLucroReal * 100) / 100 }
      ];

      setDados({
        kpis: { bruto: totalBruto, possivel: totalLucroPossivel, real: totalLucroReal },
        faturamentoMensal,
        rankingPossivel,
        lucroReal,
        rendimentoEquipe,
        comparativoGeral
      });
    } catch (e) { 
      console.error('Erro ao buscar dados:', e); 
    } finally { 
      setLoading(false); 
    }
  };


  if (loading || authLoading || !salaoId) return <div className="p-10 text-center text-gray-400">Processando fechamento...</div>;

  return (
    <div className="bg-white min-h-screen p-4 md:p-8 font-sans">
      
      {/* BANNER DE ALERTA CRÍTICO */}
      {alertasPrejuizo.length > 0 && (
        <div className="mb-8 bg-red-600 text-white p-5 rounded-2xl shadow-lg border-4 border-red-800 animate-bounce">
          <div className="flex items-center justify-between flex-col md:flex-row gap-4">
            <div className="flex items-center gap-3">
              <span className="text-4xl">🚨</span>
              <div>
                <h3 className="text-xl font-bold uppercase tracking-tighter">
                  Alerta de Sangramento de Caixa!
                </h3>
                <p className="text-red-100 text-sm">
                  Os procedimentos abaixo estão custando mais caro do que o valor cobrado:
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {alertasPrejuizo.map(nome => (
                    <span key={nome} className="bg-white text-red-700 px-3 py-1 rounded-full text-xs font-bold shadow-sm">
                      {nome}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="text-right text-xs opacity-80">
              <p>Ajuste os preços ou reduza o custo de material imediatamente.</p>
            </div>
          </div>
        </div>
      )}
      
      {/* KPIs DO TOPO (Estilo Field da Planilha) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
          <p className="text-[11px] uppercase tracking-wider text-gray-500 font-bold">Total faturado bruto</p>
          <p className="text-2xl font-semibold text-gray-900 mt-1">R$ {fmt(dados.kpis.bruto)}</p>
        </div>
        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
          <p className="text-[11px] uppercase tracking-wider text-gray-500 font-bold">Lucro possível</p>
          <p className="text-2xl font-semibold text-gray-900 mt-1 text-gray-400">R$ {fmt(dados.kpis.possivel)}</p>
        </div>
        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 ring-2 ring-emerald-500/20">
          <p className="text-[11px] uppercase tracking-wider text-emerald-600 font-bold">Lucro real</p>
          <p className="text-2xl font-semibold text-emerald-700 mt-1">R$ {fmt(dados.kpis.real)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        
        {/* GRÁFICO 1 — Faturamento Mensal */}
        <section>
          <h2 className="text-[13px] font-medium text-gray-400 uppercase tracking-widest border-b pb-2 mb-4">Gráfico 1 — Valor faturado bruto por mês</h2>
          <div className="bg-white border border-gray-100 rounded-xl p-5">
            <h3 className="text-base font-medium text-gray-800">Faturamento + Quantidade</h3>
            <div className="h-64 mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dados.faturamentoMensal}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#999'}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#999'}} tickFormatter={v => `R$${v/1000}k`} />
                  <Tooltip cursor={{fill: '#f8f8f8'}} formatter={(v) => [`R$ ${v.toLocaleString()}`, 'Faturamento']} />
                  <Bar dataKey="valor" fill={COLORS.primary} radius={[4, 4, 0, 0]} label={{ position: 'top', fill: '#E85D24', fontSize: 10, formatter: (v, i) => `${dados.faturamentoMensal[i.index].qtd} at.` }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        {/* GRÁFICO 3 — Lucro Real (Com alerta de barras negativas) */}
        <section>
          <h2 className="text-[13px] font-medium text-gray-400 uppercase tracking-widest border-b pb-2 mb-4">Gráfico 3 — Lucro real por procedimento</h2>
          <div className="bg-white border border-gray-100 rounded-xl p-5">
            <h3 className="text-base font-medium text-gray-800">O que cada serviço realmente deu de lucro</h3>
            <div className="h-64 mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dados.lucroReal} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                  <YAxis dataKey="nome" type="category" width={90} axisLine={false} tickLine={false} tick={{fontSize: 11}} />
                  <Tooltip />
                  <ReferenceLine x={0} stroke="#000" strokeWidth={1} />
                  <Bar dataKey="valor" radius={[0, 4, 4, 0]}>
                    {dados.lucroReal.map((entry, index) => (
                      <Cell key={index} fill={entry.valor < 0 ? COLORS.danger : COLORS.primary} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            {dados.lucroReal.some(v => v.valor < 0) && (
              <div className="mt-4 p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-100">
                ⚠️ <strong>Atenção:</strong> Serviços em vermelho estão com custos superiores à receita.
              </div>
            )}
          </div>
        </section>

        {/* GRÁFICO 4 — Rendimento Equipe */}
        <section>
          <h2 className="text-[13px] font-medium text-gray-400 uppercase tracking-widest border-b pb-2 mb-4">Gráfico 4 — Rendimento líquido por funcionária</h2>
          <div className="bg-white border border-gray-100 rounded-xl p-5">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dados.rendimentoEquipe}>
                  <XAxis dataKey="nome" axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip />
                  <Bar dataKey="valor" radius={[4, 4, 0, 0]} label={{ position: 'top', fontSize: 11 }}>
                    {dados.rendimentoEquipe.map((entry, index) => (
                      <Cell key={index} fill={entry.nome === 'Teta' ? COLORS.teta : COLORS.primary} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        {/* GRÁFICO 5 — Possível vs Real */}
        <section>
          <h2 className="text-[13px] font-medium text-gray-400 uppercase tracking-widest border-b pb-2 mb-4">Gráfico 5 — Lucro possível vs real</h2>
          <div className="bg-white border border-gray-100 rounded-xl p-5 flex items-center">
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dados.comparativoGeral} barSize={60}>
                  <XAxis dataKey="label" axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip />
                  <Bar dataKey="valor" radius={[6, 6, 0, 0]}>
                    <Cell fill={COLORS.primary} />
                    <Cell fill={COLORS.teta} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
};

export default Dashboard;
