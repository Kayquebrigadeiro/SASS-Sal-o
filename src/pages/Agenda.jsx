import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../hooks/useAuth';

// ── Helpers ────────────────────────────────────────────────────────────────

const HORARIOS = [
  '08:00','08:30','09:00','09:30','10:00','10:30',
  '11:00','11:30','12:00','12:30','13:00','13:30',
  '14:00','14:30','15:00','15:30','16:00','16:30',
  '17:00','17:30','18:00','18:30','19:00',
];

const DIAS_PT = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
const MESES_PT = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];

function formatarData(date) {
  const d = DIAS_PT[date.getDay()];
  const dia = date.getDate();
  const mes = MESES_PT[date.getMonth()];
  const ano = date.getFullYear();
  return `${d}, ${dia} ${mes} ${ano}`;
}

function toISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDias(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function classeEvento(atendimento) {
  if (atendimento.status === 'CANCELADO')
    return 'bg-gray-100 border-l-2 border-gray-400 text-gray-500';
  if (atendimento.pago)
    return 'bg-green-50 border-l-2 border-green-500 text-green-900';
  if (atendimento.executado)
    return 'bg-yellow-50 border-l-2 border-yellow-500 text-yellow-900';
  return 'bg-blue-50 border-l-2 border-blue-500 text-blue-900';
}

// ── Componente principal ───────────────────────────────────────────────────

export default function Agenda() {
  const { salaoId } = useAuth();
  
  const [dataSelecionada, setDataSelecionada] = useState(new Date());
  const [profissionais, setProfissionais]     = useState([]);
  const [procedimentos, setProcedimentos]     = useState([]);
  const [atendimentos, setAtendimentos]       = useState([]);
  const [loading, setLoading]                 = useState(true);

  // Modal novo agendamento
  const [modalAberto, setModalAberto]         = useState(false);
  const [slotSelecionado, setSlotSelecionado] = useState(null);

  // Modal detalhes / ações
  const [detalheAberto, setDetalheAberto]     = useState(false);
  const [atendSelecionado, setAtendSelecionado] = useState(null);

  // Formulário
  const [cliente, setCliente]                 = useState('');
  const [procedimentoId, setProcedimentoId]   = useState('');
  const [comprimento, setComprimento]         = useState('');
  const [valorCobrado, setValorCobrado]       = useState('');
  const [salvando, setSalvando]               = useState(false);

  // ── Carregamento de dados ────────────────────────────────────────────────

  const carregarEstaticos = useCallback(async () => {
    if (!salaoId) return;

    // Cache de 1h no sessionStorage — profissionais e procedimentos raramente mudam
    const chave = `estaticos_${salaoId}`;
    const cache = sessionStorage.getItem(chave);
    if (cache) {
      const { profs, procs, ts } = JSON.parse(cache);
      if (Date.now() - ts < 3600000) {
        setProfissionais(profs);
        setProcedimentos(procs);
        return;
      }
    }

    const [{ data: profs }, { data: procs }] = await Promise.all([
      supabase.from('profissionais').select('*').eq('salao_id', salaoId).eq('ativo', true).order('nome'),
      supabase.from('procedimentos').select('*').eq('salao_id', salaoId).eq('ativo', true).order('nome'),
    ]);
    if (profs) setProfissionais(profs);
    if (procs) setProcedimentos(procs);
    if (profs && procs) sessionStorage.setItem(chave, JSON.stringify({ profs, procs, ts: Date.now() }));
  }, [salaoId]);

  const carregarAtendimentos = useCallback(async (data, silencioso = false) => {
    if (!salaoId) return;
    if (!silencioso) setLoading(true);
    const { data: aten } = await supabase
      .from('atendimentos')
      .select(`*, procedimentos(nome, requer_comprimento), profissionais(nome)`)
      .eq('salao_id', salaoId)
      .eq('data', toISO(data))
      .order('horario');
    if (aten) setAtendimentos(aten);
    setLoading(false);
  }, [salaoId]);

  useEffect(() => { carregarEstaticos(); }, [carregarEstaticos]);
  useEffect(() => { carregarAtendimentos(dataSelecionada); }, [dataSelecionada, carregarAtendimentos]);

  // ── Preenchimento automático do valor ao escolher procedimento/comprimento ─

  useEffect(() => {
    if (!procedimentoId) return;
    const proc = procedimentos.find(p => p.id === procedimentoId);
    if (!proc) return;
    let preco = proc.preco_p;
    if (comprimento === 'M' && proc.preco_m) preco = proc.preco_m;
    if (comprimento === 'G' && proc.preco_g) preco = proc.preco_g;
    if (preco) setValorCobrado(String(preco));
  }, [procedimentoId, comprimento, procedimentos]);

  // ── Ações ────────────────────────────────────────────────────────────────

  const abrirNovoAgendamento = (prof, horario) => {
    setSlotSelecionado({ profissional: prof, horario });
    setCliente(''); setProcedimentoId(''); setComprimento(''); setValorCobrado('');
    setModalAberto(true);
  };

  const salvarAgendamento = async (e) => {
    e.preventDefault();
    setSalvando(true);
    const { error } = await supabase.from('atendimentos').insert([{
      salao_id:         salaoId,
      data:             toISO(dataSelecionada),
      horario:          slotSelecionado.horario,
      profissional_id:  slotSelecionado.profissional.id,
      procedimento_id:  procedimentoId,
      comprimento:      comprimento || null,
      cliente,
      valor_cobrado:    valorCobrado ? Number(valorCobrado) : null,
      status:           'AGENDADO',
    }]);
    setSalvando(false);
    if (error) { alert('Erro ao salvar: ' + error.message); return; }
    setModalAberto(false);
    carregarAtendimentos(dataSelecionada, true);
  };

  const marcarPago = async (id, pago) => {
    setDetalheAberto(false);
    await supabase.from('atendimentos').update({ pago: !pago }).eq('id', id);
    carregarAtendimentos(dataSelecionada, true);
  };

  const marcarExecutado = async (id, executado) => {
    const novoStatus = !executado ? 'EXECUTADO' : 'AGENDADO';
    setDetalheAberto(false);
    await supabase.from('atendimentos')
      .update({ executado: !executado, status: novoStatus })
      .eq('id', id);
    carregarAtendimentos(dataSelecionada, true);
  };

  const cancelarAtendimento = async (id) => {
    if (!confirm('Cancelar este atendimento?')) return;
    setDetalheAberto(false);
    await supabase.from('atendimentos')
      .update({ status: 'CANCELADO', pago: false, executado: false })
      .eq('id', id);
    carregarAtendimentos(dataSelecionada, true);
  };

  // ── Helpers de UI ────────────────────────────────────────────────────────

  const procSelecionado     = procedimentos.find(p => p.id === procedimentoId);
  const requerComprimento   = procSelecionado?.requer_comprimento;
  const eHoje               = toISO(dataSelecionada) === toISO(new Date());

  const totalDia = atendimentos
    .filter(a => a.status !== 'CANCELADO')
    .reduce((acc, a) => acc + (a.valor_cobrado || 0), 0);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-full">
      <main className="p-8 max-w-full">
        {/* ── Toolbar da agenda ── */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => setDataSelecionada(d => addDias(d, -1))}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm hover:bg-gray-100 bg-white"
          >‹</button>

          <span className="text-lg font-bold text-gray-800 min-w-56 text-center">
            {formatarData(dataSelecionada)}
          </span>

          <button
            onClick={() => setDataSelecionada(d => addDias(d, 1))}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm hover:bg-gray-100 bg-white"
          >›</button>

          {!eHoje && (
            <button
               onClick={() => setDataSelecionada(new Date())}
               className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm hover:bg-gray-100 bg-white text-gray-600"
            >
              Ir para Hoje
             </button>
          )}

          {/* Totalizador do dia */}
          {totalDia > 0 && (
            <div className="ml-4 bg-green-50 border border-green-200 rounded-lg px-4 py-1.5">
               <span className="text-xs text-green-700 font-bold">
                 Total Receita: R$ {totalDia.toFixed(2).replace('.', ',')}
               </span>
            </div>
          )}

          {/* Legenda escondida em telas finas */}
          <div className="ml-auto hidden md:flex items-center gap-4 text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
            <span className="flex items-center gap-1.5">
               <span className="w-3 h-3 rounded-full bg-blue-400 inline-block"></span> Agendado
            </span>
            <span className="flex items-center gap-1.5">
               <span className="w-3 h-3 rounded-full bg-yellow-400 inline-block"></span> Executado
            </span>
            <span className="flex items-center gap-1.5">
               <span className="w-3 h-3 rounded-full bg-green-500 inline-block"></span> Pago
            </span>
          </div>
        </div>

        {/* ── Grade ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-auto">
          {loading ? (
             <div className="p-16 text-center text-gray-400 text-sm">Atualizando horários...</div>
          ) : (
            <table className="w-full text-sm border-collapse">
               <thead>
                 <tr className="border-b border-gray-200">
                   <th className="w-20 text-center py-3 px-4 text-xs font-semibold text-gray-500 bg-gray-50 border-r border-gray-200">
                     Horário
                   </th>
                   {profissionais.map(prof => (
                     <th key={prof.id} className="py-3 px-4 text-center border-r border-gray-200 bg-gray-50 last:border-r-0">
                       <div className="text-xs font-bold text-gray-800 uppercase tracking-wide">{prof.nome}</div>
                       <div className="text-[10px] text-gray-400 mt-0.5 capitalize font-medium">
                         {prof.cargo === 'PROPRIETARIO' ? 'Proprietário' : 'Funcionário'}
                       </div>
                     </th>
                   ))}
                 </tr>
               </thead>
               <tbody>
                 {HORARIOS.map((horario, idx) => (
                   <tr key={horario} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}>
                     <td className="py-2 px-4 text-center text-xs font-semibold text-gray-400 border-r border-gray-100 bg-gray-50/50">
                       {horario}
                     </td>
                     {profissionais.map(prof => {
                       const agendado = atendimentos.find(a =>
                         a.profissional_id === prof.id &&
                         a.horario.startsWith(horario)
                       );

                       if (agendado) {
                         return (
                           <td
                             key={`${prof.id}-${horario}`}
                             className="py-1.5 px-2 border-r border-gray-100 last:border-r-0 cursor-pointer align-top"
                             onClick={() => { setAtendSelecionado(agendado); setDetalheAberto(true); }}
                           >
                             <div className={`rounded-xl px-2.5 py-2 text-xs shadow-sm shadow-black/5 hover:shadow-md transition-shadow ${classeEvento(agendado)}`}>
                               <div className="font-bold truncate text-gray-900">{agendado.cliente}</div>
                               <div className="truncate opacity-80 text-[10px] mt-0.5 font-medium leading-tight">
                                 {agendado.procedimentos?.nome}
                                 {agendado.comprimento && ` (${agendado.comprimento})`}
                               </div>
                               {agendado.valor_cobrado && (
                                 <div className="text-[10px] mt-1 opacity-70 font-bold bg-black/5 inline-block px-1.5 py-0.5 rounded">
                                   R$ {Number(agendado.valor_cobrado).toFixed(2).replace('.', ',')}
                                 </div>
                               )}
                             </div>
                           </td>
                         );
                       }

                       return (
                         <td
                           key={`${prof.id}-${horario}`}
                           className="py-1 px-2 border-r border-gray-100 last:border-r-0 cursor-pointer hover:bg-blue-50/50 group h-[52px]"
                           onClick={() => abrirNovoAgendamento(prof, horario)}
                         >
                           <span className="text-blue-400 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity block text-center font-semibold">
                             + agendar
                           </span>
                         </td>
                       );
                     })}
                   </tr>
                 ))}
               </tbody>
            </table>
          )}
        </div>
      </main>

      {/* ══ MODAL — Novo agendamento ════════════════════════════════════════ */}
      {modalAberto && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm shadow-2xl flex items-center justify-center p-4 z-50 transition-all"
          onClick={(e) => e.target === e.currentTarget && setModalAberto(false)}
        >
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-7 border border-gray-100">
            <h2 className="text-xl font-black text-gray-900 mb-1 tracking-tight">Novo Agendamento</h2>
            <p className="text-sm text-gray-500 mb-6 font-medium">
              {slotSelecionado?.profissional.nome} · {slotSelecionado?.horario} · {formatarData(dataSelecionada)}
            </p>

            <form onSubmit={salvarAgendamento} className="space-y-4">

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">Nome da cliente</label>
                <input
                  type="text" required autoFocus
                  value={cliente} onChange={e => setCliente(e.target.value)}
                  className="w-full border border-gray-200 bg-gray-50 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:bg-white transition-all shadow-inner"
                  placeholder="Ex: Maria Silva"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">Procedimento</label>
                <select
                  required value={procedimentoId}
                  onChange={e => { setProcedimentoId(e.target.value); setComprimento(''); setValorCobrado(''); }}
                  className="w-full border border-gray-200 bg-gray-50 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:bg-white transition-all shadow-inner appearance-none"
                >
                  <option value="">Selecione na tabela...</option>
                  {procedimentos.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>

                {/* Preview de preço */}
                {procSelecionado && (
                  <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-blue-700">✓ Preço sugerido</span>
                      <span className="text-lg font-black text-blue-900">
                        R$ {(procSelecionado.preco_p || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                    <p className="text-[10px] text-blue-600 mt-1">(Pode ser editado abaixo)</p>
                  </div>
                )}
              </div>

              {requerComprimento && (
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wide">Tamanho do cabelo</label>
                  <div className="flex gap-2">
                    {['P','M','G'].map(c => (
                      <button
                        key={c} type="button"
                        onClick={() => setComprimento(c)}
                        className={`flex-1 py-2.5 text-sm font-bold rounded-xl border transition-all ${
                          comprimento === c
                            ? 'bg-gray-900 text-white border-gray-900 shadow-md ring-2 ring-gray-900 ring-offset-2'
                            : 'border-gray-200 text-gray-500 hover:border-gray-400 hover:bg-gray-50'
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5 uppercase tracking-wide">Valor cobrado (R$)</label>
                <input
                  type="number" step="0.01" min="0"
                  value={valorCobrado} onChange={e => setValorCobrado(e.target.value)}
                  className="w-full border border-gray-200 bg-gray-50 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:bg-white transition-all shadow-inner"
                  placeholder="0,00"
                />
                {valorCobrado && (
                  <div className="mt-2 text-xs text-gray-600 bg-gray-50 px-3 py-2 rounded-lg">
                    <p className="text-center font-bold text-gray-700">Lucro estimado</p>
                    <p className="text-center text-lg font-black text-green-700 mt-1">
                      R$ {(Number(valorCobrado) * 0.95 * 0.6 - 29).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className="text-[10px] text-gray-500 text-center mt-1">Taxa maq. 5% | Comissão prof. 40% | Custo fixo R$29</p>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button" onClick={() => setModalAberto(false)}
                  className="flex-1 py-3 text-sm font-bold text-gray-600 border border-transparent rounded-xl hover:bg-gray-100 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit" disabled={salvando}
                  className="flex-1 py-3 text-sm font-bold bg-gray-900 text-white rounded-xl shadow-lg shadow-gray-900/30 hover:bg-black hover:shadow-gray-900/50 disabled:opacity-50 transition-all transform hover:-translate-y-0.5"
                >
                  {salvando ? 'Agendando...' : 'Confirmar Agenda'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══ MODAL — Detalhes e ações ════════════════════════════════════════ */}
      {detalheAberto && atendSelecionado && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={(e) => e.target === e.currentTarget && setDetalheAberto(false)}
        >
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-7 border border-gray-100">
            <div className="flex items-start justify-between mb-5">
              <div>
                <h2 className="text-xl font-black text-gray-900 tracking-tight leading-tight">{atendSelecionado.cliente}</h2>
                <p className="text-sm font-medium text-gray-400 mt-1">
                  {atendSelecionado.horario?.slice(0,5)} · {atendSelecionado.profissionais?.nome}
                </p>
              </div>
              {/* Badge Visual */}
            </div>

            {/* Dados do atendimento */}
            <div className="bg-gray-50 border border-gray-100 rounded-2xl p-5 space-y-3 text-sm mb-6">
              <div className="flex justify-between items-center">
                <span className="text-gray-400 font-medium">Procedimento</span>
                <span className="font-bold text-gray-900 text-right">
                  {atendSelecionado.procedimentos?.nome}
                  {atendSelecionado.comprimento && <span className="opacity-60 font-normal ml-1">({atendSelecionado.comprimento})</span>}
                </span>
              </div>
              
              <div className="h-px bg-gray-200/50 w-full"></div>

              {atendSelecionado.valor_cobrado && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 font-medium">Tarifa aplicada</span>
                  <span className="font-black text-gray-900 text-base">
                    R$ {Number(atendSelecionado.valor_cobrado).toFixed(2).replace('.', ',')}
                  </span>
                </div>
              )}
              {atendSelecionado.lucro_liquido != null && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 font-medium tracking-wide">Liquido <span className="text-[10px] font-normal uppercase bg-gray-200/50 px-1 rounded ml-1">Banco</span></span>
                  <span className={`font-black text-sm px-2 py-0.5 rounded flex items-center gap-1 ${atendSelecionado.lucro_liquido > 0 ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-600'}`}>
                    R$ {Number(atendSelecionado.lucro_liquido).toFixed(2).replace('.', ',')}
                  </span>
                </div>
              )}
            </div>

            {/* Ações — só disponíveis se não cancelado */}
            {atendSelecionado.status !== 'CANCELADO' ? (
              <div className="space-y-3">
                <button
                  onClick={() => marcarExecutado(atendSelecionado.id, atendSelecionado.executado)}
                  className={`w-full py-3.5 text-sm font-bold rounded-xl border-2 transition-all flex items-center justify-center gap-2 ${
                    atendSelecionado.executado
                      ? 'bg-yellow-50 border-yellow-400 text-yellow-800 hover:bg-yellow-100 shadow-sm shadow-yellow-100'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <span className={`w-5 h-5 flex items-center justify-center rounded-full border-2 ${atendSelecionado.executado ? 'border-yellow-600 bg-yellow-400 text-yellow-900' : 'border-gray-300'}`}>
                    {atendSelecionado.executado && '✓'}
                  </span>
                  {atendSelecionado.executado ? 'Serviço Executado' : 'Marcar como Feito'}
                </button>

                <button
                  onClick={() => marcarPago(atendSelecionado.id, atendSelecionado.pago)}
                  className={`w-full py-3.5 text-sm font-bold rounded-xl border-2 transition-all flex items-center justify-center gap-2 ${
                    atendSelecionado.pago
                      ? 'bg-green-500 border-green-500 text-white shadow-lg shadow-green-500/30'
                      : 'bg-white border-green-200 text-green-600 hover:bg-green-50'
                  }`}
                >
                  <span className={`w-5 h-5 flex items-center justify-center rounded-full border-2 ${atendSelecionado.pago ? 'border-white bg-green-500' : 'border-green-300'}`}>
                    {atendSelecionado.pago && '✓'}
                  </span>
                  {atendSelecionado.pago ? 'Pago no Caixa' : 'Fechar Conta (Pago)'}
                </button>

                <div className="pt-2">
                  <button
                    onClick={() => cancelarAtendimento(atendSelecionado.id)}
                    className="w-full py-2.5 text-xs font-bold rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                  >
                    Excluir Agenda
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 rounded-xl p-4 text-center border-dashed border-2 border-gray-200">
                <span className="text-xl">🗑️</span>
                <p className="text-sm font-bold text-gray-400 mt-2">Agenda foi cancelada</p>
              </div>
            )}

            <button
              onClick={() => setDetalheAberto(false)}
              className="w-full mt-4 py-3 text-sm font-bold text-gray-400 hover:text-gray-800 transition-colors"
            >
              Voltar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
