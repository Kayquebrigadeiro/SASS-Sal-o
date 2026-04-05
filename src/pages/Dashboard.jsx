import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

function fmt(val) {
  return Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function Card({ label, valor, cor, variacao }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-500 mb-1">{label}</p>
          <p className={`text-2xl font-semibold ${cor || 'text-gray-800'}`}>{fmt(valor)}</p>
        </div>
        {variacao !== undefined && (
          <div className={`text-xs font-bold px-2 py-1 rounded-full ${variacao >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {variacao >= 0 ? '▲' : '▼'} {Math.abs(variacao).toFixed(1)}%
          </div>
        )}
      </div>
    </div>
  );
}

export default function Dashboard({ salaoId }) {
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [dados, setDados] = useState(null);
  const [historico, setHistorico] = useState([]);
  const [ranking, setRanking] = useState([]);
  const [rendimento, setRendimento] = useState([]);
  const [pendentes, setPendentes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!salaoId) return;
    carregar();
  }, [salaoId, ano, mes]);

  const mesISO = `${ano}-${String(mes).padStart(2,'0')}-01`;

  const carregar = async () => {
    setLoading(true);

    const [
      { data: fechamento },
      { data: hist },
      { data: rank },
      { data: rend },
      { data: pend },
    ] = await Promise.all([
      supabase.from('fechamento_mensal').select('*').eq('salao_id', salaoId).eq('mes', mesISO).single(),
      supabase.from('fechamento_mensal').select('mes,receita_bruta,lucro_liquido_atendimentos,lucro_possivel_atendimentos').eq('salao_id', salaoId).order('mes', { ascending: false }).limit(6),
      supabase.from('ranking_procedimentos').select('*').eq('salao_id', salaoId).eq('mes', mesISO).order('receita_total', { ascending: false }),
      supabase.from('rendimento_por_profissional').select('*').eq('salao_id', salaoId).eq('mes', mesISO).order('receita_gerada', { ascending: false }),
      supabase.from('atendimentos').select('cliente, valor_cobrado, procedimentos(nome), horario').eq('salao_id', salaoId).gte('data', mesISO).lt('data', `${ano}-${String(mes+1).padStart(2,'0')}-01`).eq('executado', true).eq('pago', false).neq('status', 'CANCELADO'),
    ]);

    setDados(fechamento || {});
    setHistorico((hist || []).reverse());
    setRanking(rank || []);
    setRendimento(rend || []);
    setPendentes(pend || []);
    setLoading(false);
  };

  const maxReceita = Math.max(...historico.map(h => Number(h.receita_bruta || 0)), 1);
  
  // Calcular variação com mês anterior
  const mesAnterior = historico.slice(1, 2)[0];
  const variacaoReceita = mesAnterior && Number(dados?.receita_total || 0) > 0 
    ? (((Number(dados?.receita_total) - Number(mesAnterior.receita_bruta)) / Number(mesAnterior.receita_bruta)) * 100)
    : undefined;

  const variacaoLucro = mesAnterior && Number(dados?.lucro_liquido_atendimentos || 0) > 0
    ? (((Number(dados?.lucro_liquido_atendimentos) - Number(mesAnterior.lucro_liquido_atendimentos)) / Number(mesAnterior.lucro_liquido_atendimentos)) * 100)
    : undefined;

  return (
    <div className="p-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-xl font-semibold text-gray-800">Dashboard</h1>
        <div className="flex items-center gap-2 ml-auto">
          <select
            value={mes}
            onChange={e => setMes(Number(e.target.value))}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
          >
            {MESES.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
          </select>
          <select
            value={ano}
            onChange={e => setAno(Number(e.target.value))}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
          >
            {[2023,2024,2025,2026].map(a => <option key={a}>{a}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Carregando...</p>
      ) : (
        <>
          {/* Cards de métricas */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card label="Receita total" valor={dados?.receita_total} variacao={variacaoReceita} />
            <Card label="Receita recebida" valor={dados?.receita_recebida} cor="text-green-700" />
            <Card label="Pendências" valor={dados?.pendencias} cor="text-yellow-600" />
            <Card
              label="Saúde financeira"
              valor={dados?.saude_financeira}
              cor={Number(dados?.saude_financeira || 0) >= 0 ? 'text-green-700' : 'text-red-600'}
              variacao={variacaoLucro}
            />
          </div>

          {/* Histórico com Recharts */}
          {historico.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
              <p className="text-sm font-medium text-gray-700 mb-4">Receita vs Lucro — últimos meses</p>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={historico.map(h => ({
                  mes: MESES[new Date(h.mes).getMonth()],
                  receita: Number(h.receita_bruta || 0),
                  lucro: Number(h.lucro_liquido_atendimentos || 0),
                }))}>
                  <XAxis dataKey="mes" />
                  <YAxis />
                  <Tooltip 
                    formatter={(value) => fmt(value)}
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc', borderRadius: '8px' }}
                  />
                  <Legend />
                  <Bar dataKey="receita" fill="#808080" name="Receita Bruta" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="lucro" fill="#22c55e" name="Lucro Líquido" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Lucro real vs possível */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-xs text-gray-500 mb-1">Lucro líquido (real)</p>
              <p className={`text-2xl font-semibold ${Number(dados?.lucro_liquido_atendimentos || 0) >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                {fmt(dados?.lucro_liquido_atendimentos)}
              </p>
              <p className="text-xs text-gray-400 mt-1">Após maquininha, comissões e custos</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-xs text-gray-500 mb-1">Lucro possível (sem maquininha)</p>
              <p className="text-2xl font-semibold text-blue-700">{fmt(dados?.lucro_possivel_atendimentos)}</p>
              <p className="text-xs text-gray-400 mt-1">Se todos pagassem em dinheiro/pix</p>
            </div>
          </div>

          {/* Custos detalhados */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
            <p className="text-sm font-medium text-gray-700 mb-4">Custos e deduções do mês</p>
            <div className="space-y-2 text-sm">
              {[
                ['Maquininha (5%)', dados?.total_maquininha],
                ['Comissões profissionais', dados?.total_profissionais],
                ['Custo fixo por atendimento (R$29)', dados?.total_custo_fixo],
                ['Custo variável (produtos)', dados?.total_custo_variavel],
                ['Despesas lançadas', dados?.total_despesas],
                ['Salários fixos', dados?.total_salarios_fixos],
              ].map(([label, val]) => (
                <div key={label} className="flex justify-between py-1 border-b border-gray-50 last:border-0">
                  <span className="text-gray-600">{label}</span>
                  <span className="font-medium text-red-600">{fmt(val)}</span>
                </div>
              ))}
              <div className="flex justify-between pt-2 font-semibold">
                <span>Total de custos</span>
                <span className="text-red-700">
                  {fmt(
                    [dados?.total_maquininha, dados?.total_profissionais, dados?.total_custo_fixo,
                     dados?.total_custo_variavel, dados?.total_despesas, dados?.total_salarios_fixos]
                    .reduce((s, v) => s + Number(v || 0), 0)
                  )}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Ranking de procedimentos */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-sm font-medium text-gray-700 mb-4">Procedimentos mais rentáveis</p>
              {ranking.length === 0 ? (
                <p className="text-sm text-gray-400">Sem dados neste mês.</p>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-400 border-b border-gray-100">
                      <th className="text-left pb-2">Procedimento</th>
                      <th className="text-right pb-2">Qtd</th>
                      <th className="text-right pb-2">Receita</th>
                      <th className="text-right pb-2">Lucro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ranking.map((r, i) => (
                      <tr key={i} className="border-b border-gray-50 last:border-0">
                        <td className="py-1.5 text-gray-700">{r.procedimento}</td>
                        <td className="py-1.5 text-right text-gray-500">{r.quantidade}</td>
                        <td className="py-1.5 text-right text-gray-700">{fmt(r.receita_total)}</td>
                        <td className={`py-1.5 text-right font-medium ${Number(r.lucro_total) >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                          {fmt(r.lucro_total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Rendimento por profissional */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-sm font-medium text-gray-700 mb-4">Rendimento por profissional</p>
              {rendimento.length === 0 ? (
                <p className="text-sm text-gray-400">Sem dados neste mês.</p>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-400 border-b border-gray-100">
                      <th className="text-left pb-2">Nome</th>
                      <th className="text-right pb-2">Atend.</th>
                      <th className="text-right pb-2">Receita</th>
                      <th className="text-right pb-2">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rendimento.map((r, i) => (
                      <tr key={i} className="border-b border-gray-50 last:border-0">
                        <td className="py-1.5 text-gray-700">{r.profissional}</td>
                        <td className="py-1.5 text-right text-gray-500">{r.total_atendimentos}</td>
                        <td className="py-1.5 text-right text-gray-700">{fmt(r.receita_gerada)}</td>
                        <td className="py-1.5 text-right font-medium text-gray-800">{fmt(r.rendimento_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Home Car + Paralelos */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-xs text-gray-500 mb-1">Receita Home Car</p>
              <p className="text-xl font-semibold text-gray-800">{fmt(dados?.receita_homecare)}</p>
              <p className="text-xs text-yellow-600 mt-1">Pendente: {fmt(dados?.pendente_homecare)}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-xs text-gray-500 mb-1">Receita Paralelos</p>
              <p className="text-xl font-semibold text-gray-800">{fmt(dados?.receita_paralelos)}</p>
              <p className="text-xs text-yellow-600 mt-1">Pendente: {fmt(dados?.pendente_paralelos)}</p>
            </div>
          </div>

          {/* Pendentes */}
          {pendentes.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-sm font-medium text-gray-700 mb-4">
                Clientes pendentes — executado mas não pago ({pendentes.length})
              </p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-100">
                    <th className="text-left pb-2">Cliente</th>
                    <th className="text-left pb-2">Procedimento</th>
                    <th className="text-left pb-2">Horário</th>
                    <th className="text-right pb-2">Valor</th>
                    <th className="text-right pb-2">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {pendentes.map((p, i) => (
                    <tr key={i} className="border-b border-gray-50 last:border-0">
                      <td className="py-1.5 text-gray-700 font-medium">{p.cliente}</td>
                      <td className="py-1.5 text-gray-500">{p.procedimentos?.nome}</td>
                      <td className="py-1.5 text-gray-400">{p.horario?.slice(0,5)}</td>
                      <td className="py-1.5 text-right font-medium text-yellow-700">{fmt(p.valor_cobrado)}</td>
                      <td className="py-1.5 text-right">
                        <button
                          onClick={async () => {
                            await supabase.from('atendimentos').update({ pago: true }).eq('id', p.id);
                            carregar();
                          }}
                          className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded hover:bg-green-200 font-bold"
                        >
                          Marcar pago
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
