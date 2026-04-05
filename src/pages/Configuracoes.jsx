import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function Configuracoes({ salaoId }) {
  const [aba, setAba] = useState('salao');

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-xl font-semibold text-gray-800 mb-6">Configurações</h1>
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {[['salao','Salão'],['profissionais','Profissionais'],['procedimentos','Procedimentos']].map(([id, label]) => (
          <button key={id} onClick={() => setAba(id)} className={`px-4 py-2.5 text-sm transition-colors border-b-2 -mb-px ${aba === id ? 'border-gray-800 text-gray-800 font-medium' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
            {label}
          </button>
        ))}
      </div>
      {aba === 'salao' && <AbaSalao salaoId={salaoId} />}
      {aba === 'profissionais' && <AbaProfissionais salaoId={salaoId} />}
      {aba === 'procedimentos' && <AbaProcedimentos salaoId={salaoId} />}
    </div>
  );
}

function AbaSalao({ salaoId }) {
  const [cfg, setCfg] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [gastos, setGastos] = useState([]);
  const [novoGasto, setNovoGasto] = useState({ descricao: '', valor: '' });
  const [fechamento, setFechamento] = useState(null);
  const [mostradorExpandido, setMostradorExpandido] = useState(false);

  useEffect(() => { if (salaoId) carregarDados(); }, [salaoId]);

  const carregarDados = async () => {
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = hoje.getMonth() + 1;
    const mesISO = `${ano}-${String(mes).padStart(2,'0')}-01`;

    const [{ data: cfgData }, { data: gastosData }, { data: fechData }] = await Promise.all([
      supabase.from('configuracoes').select('*').eq('salao_id', salaoId).single(),
      supabase.from('gastos_pessoais').select('*').eq('salao_id', salaoId).order('criado_em', { ascending: false }),
      supabase.from('fechamento_mensal').select('saude_financeira, receita_bruta').eq('salao_id', salaoId).eq('mes', mesISO).single(),
    ]);
    if (cfgData) setCfg(cfgData);
    setGastos(gastosData || []);
    setFechamento(fechData);
  };

  const salvar = async (e) => {
    e.preventDefault();
    setSalvando(true);
    await supabase.from('configuracoes').update({
      custo_fixo_por_atendimento: Number(cfg.custo_fixo_por_atendimento),
      taxa_maquininha_pct: Number(cfg.taxa_maquininha_pct),
      prolabore_mensal: Number(cfg.prolabore_mensal),
    }).eq('salao_id', salaoId);
    setSalvando(false);
    alert('Salvo!');
  };

  const adicionarGasto = async (e) => {
    e.preventDefault();
    if (!novoGasto.descricao || !novoGasto.valor) return;
    await supabase.from('gastos_pessoais').insert([{
      salao_id: salaoId,
      descricao: novoGasto.descricao,
      valor: Number(novoGasto.valor),
    }]);
    setNovoGasto({ descricao: '', valor: '' });
    carregarDados();
  };

  const removerGasto = async (id) => {
    if (confirm('Remover este gasto?')) {
      await supabase.from('gastos_pessoais').delete().eq('id', id);
      carregarDados();
    }
  };

  const totalGastos = gastos.reduce((sum, g) => sum + Number(g.valor || 0), 0);
  const receita = Number(fechamento?.receita_bruta || 0);
  const diferenca = receita - totalGastos;

  if (!cfg) return <p className="text-sm text-gray-400">Carregando...</p>;

  return (
    <div className="space-y-6">
      {/* Configurações básicas */}
      <form onSubmit={salvar} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4 max-w-2xl">
        <h3 className="text-sm font-bold text-gray-700">Parâmetros básicos</h3>
        <div><label className="text-xs text-gray-600 block mb-1 font-bold">Custo fixo por atendimento (R$)</label>
          <input type="number" step="0.01" value={cfg.custo_fixo_por_atendimento || ''} onChange={e => setCfg({...cfg, custo_fixo_por_atendimento: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          <p className="text-xs text-gray-400 mt-1">Rateio de aluguel, energia e água por atendimento. Padrão: R$29</p>
        </div>
        <div><label className="text-xs text-gray-600 block mb-1 font-bold">Taxa maquininha (%)</label>
          <input type="number" step="0.01" value={cfg.taxa_maquininha_pct || ''} onChange={e => setCfg({...cfg, taxa_maquininha_pct: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          <p className="text-xs text-gray-400 mt-1">% descontado do valor cobrado. Padrão: 5%</p>
        </div>
        <div><label className="text-xs text-gray-600 block mb-1 font-bold">Pró-labore mensal desejado (R$)</label>
          <input type="number" step="0.01" value={cfg.prolabore_mensal || ''} onChange={e => setCfg({...cfg, prolabore_mensal: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <button type="submit" disabled={salvando} className="bg-gray-800 text-white text-sm px-6 py-2.5 rounded-lg hover:bg-gray-900 disabled:opacity-50 font-bold">
          {salvando ? 'Salvando...' : 'Salvar configurações'}
        </button>
      </form>

      {/* Calculadora de pró-labore */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <button
          type="button"
          onClick={() => setMostradorExpandido(!mostradorExpandido)}
          className="w-full flex items-center justify-between mb-4 hover:bg-gray-50 p-2 rounded transition-colors"
        >
          <h3 className="text-sm font-bold text-gray-700">📊 Calculadora de Pró-labore</h3>
          <span className={`text-lg transition-transform ${mostradorExpandido ? 'rotate-180' : ''}`}>▼</span>
        </button>

        {mostradorExpandido && (
          <div className="space-y-6 border-t border-gray-200 pt-6">
            {/* Gastos pessoais */}
            <div>
              <h4 className="text-xs font-bold text-gray-700 mb-3 uppercase tracking-wide">Gastos pessoais mensais</h4>
              <div className="space-y-2">
                {gastos.map(g => (
                  <div key={g.id} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg border border-gray-100">
                    <span className="text-sm text-gray-700 font-medium">{g.descricao}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-gray-800">
                        R$ {Number(g.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      <button
                        onClick={() => removerGasto(g.id)}
                        className="text-xs text-red-500 hover:bg-red-50 px-2 py-1 rounded transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Adicionar novo gasto */}
              <form onSubmit={adicionarGasto} className="mt-4 flex gap-2">
                <input
                  type="text"
                  placeholder="Ex: Aluguel"
                  value={novoGasto.descricao}
                  onChange={e => setNovoGasto({...novoGasto, descricao: e.target.value})}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-xs"
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="R$"
                  value={novoGasto.valor}
                  onChange={e => setNovoGasto({...novoGasto, valor: e.target.value})}
                  className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-xs"
                />
                <button
                  type="submit"
                  className="bg-gray-800 text-white text-xs px-4 py-2 rounded-lg hover:bg-gray-900 font-bold"
                >
                  + Adicionar
                </button>
              </form>
            </div>

            {/* Resumo */}
            <div className="grid grid-cols-3 gap-4 border-t border-gray-200 pt-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-xs text-gray-600 font-bold mb-1">Total de gastos</p>
                <p className="text-xl font-black text-gray-800">
                  R$ {totalGastos.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-xs text-blue-600 font-bold mb-1">Receita do mês</p>
                <p className="text-xl font-black text-blue-700">
                  R$ {receita.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div className={`p-4 rounded-lg ${diferenca >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                <p className={`text-xs font-bold mb-1 ${diferenca >= 0 ? 'text-green-600' : 'text-red-600'}`}>Diferença</p>
                <p className={`text-xl font-black ${diferenca >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  {diferenca >= 0 ? '+' : '−'} R$ {Math.abs(diferenca).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            {/* Status */}
            <div className={`p-4 rounded-lg border-2 text-center ${diferenca >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              {diferenca >= 0 ? (
                <>
                  <p className="text-2xl">✓</p>
                  <p className="text-sm font-bold text-green-700 mt-2">O salão está saudável!</p>
                  <p className="text-xs text-green-600 mt-1">
                    Sobrou R$ {diferenca.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} além do seu pró-labore.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-2xl">⚠</p>
                  <p className="text-sm font-bold text-red-700 mt-2">Atenção: faltaram recursos</p>
                  <p className="text-xs text-red-600 mt-1">
                    O salão gerou R$ {receita.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} mas você precisa de R$ {totalGastos.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.
                  </p>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AbaProfissionais({ salaoId }) {
  const [lista, setLista] = useState([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ nome: '', cargo: 'FUNCIONARIO', salario_fixo: '' });
  const [salvando, setSalvando] = useState(false);
  const [editandoSalario, setEditandoSalario] = useState(null);
  const [novoSalario, setNovoSalario] = useState('');

  useEffect(() => { if (salaoId) carregar(); }, [salaoId]);

  const carregar = async () => {
    const { data } = await supabase.from('profissionais').select('*').eq('salao_id', salaoId).order('nome');
    setLista(data || []);
  };

  const salvar = async (e) => {
    e.preventDefault();
    setSalvando(true);
    const { error } = await supabase.from('profissionais').insert([{
      ...form, salao_id: salaoId, salario_fixo: Number(form.salario_fixo) || 0
    }]);
    setSalvando(false);
    if (error) { alert('Erro: ' + error.message); return; }
    setModal(false);
    setForm({ nome: '', cargo: 'FUNCIONARIO', salario_fixo: '' });
    carregar();
  };

  const salvarSalario = async (id) => {
    if (novoSalario === '') return;
    await supabase.from('profissionais').update({ salario_fixo: Number(novoSalario) }).eq('id', id);
    setEditandoSalario(null);
    setNovoSalario('');
    carregar();
  };

  const toggleAtivo = async (id, ativo) => {
    await supabase.from('profissionais').update({ ativo: !ativo }).eq('id', id);
    carregar();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-600">{lista.length} profissional(is)</p>
        <button onClick={() => setModal(true)} className="bg-gray-800 text-white text-sm px-4 py-2 rounded-lg hover:bg-gray-900 font-bold">+ Adicionar profissional</button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>{['Nome','Cargo','Salário fixo','Status',''].map(h => (
              <th key={h} className="text-left px-4 py-3 text-xs text-gray-500 font-bold">{h}</th>
            ))}</tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {lista.map(p => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-bold text-gray-800">{p.nome}</td>
                <td className="px-4 py-3 text-gray-500 text-sm">{p.cargo === 'PROPRIETARIO' ? 'Proprietária' : 'Funcionária'}</td>
                <td className="px-4 py-3">
                  {editandoSalario === p.id ? (
                    <input
                      type="number"
                      step="0.01"
                      autoFocus
                      value={novoSalario}
                      onChange={e => setNovoSalario(e.target.value)}
                      onBlur={() => salvarSalario(p.id)}
                      onKeyDown={e => e.key === 'Enter' && salvarSalario(p.id)}
                      className="w-24 border border-blue-400 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-300"
                    />
                  ) : (
                    <span
                      onClick={() => {
                        setEditandoSalario(p.id);
                        setNovoSalario(String(p.salario_fixo || 0));
                      }}
                      className="cursor-pointer hover:bg-blue-50 px-2 py-1 rounded text-xs text-gray-700 font-medium transition-colors"
                    >
                      R$ {Number(p.salario_fixo || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${p.ativo ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {p.ativo ? 'Ativa' : 'Inativa'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => toggleAtivo(p.id, p.ativo)}
                    className="text-xs border border-gray-200 rounded px-2 py-1 hover:bg-gray-50 transition-colors font-bold"
                  >
                    {p.ativo ? 'Desativar' : 'Ativar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-bold mb-4">Nova profissional</h2>
            <form onSubmit={salvar} className="space-y-3">
              <div><label className="text-xs text-gray-600 block mb-1 font-bold">Nome</label><input type="text" required value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
              <div><label className="text-xs text-gray-600 block mb-1 font-bold">Cargo</label>
                <select value={form.cargo} onChange={e => setForm({...form, cargo: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  <option value="FUNCIONARIO">Funcionária</option>
                  <option value="PROPRIETARIO">Proprietária</option>
                </select>
              </div>
              <div><label className="text-xs text-gray-600 block mb-1 font-bold">Salário fixo (R$)</label><input type="number" step="0.01" value={form.salario_fixo} onChange={e => setForm({...form, salario_fixo: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModal(false)} className="flex-1 py-2.5 text-sm border border-gray-300 rounded-lg font-bold">Cancelar</button>
                <button type="submit" disabled={salvando} className="flex-1 py-2.5 text-sm bg-gray-800 text-white rounded-lg disabled:opacity-50 font-bold">{salvando ? 'Salvando...' : 'Salvar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const CATEGORIAS_CORES = {
  'CABELO': { bg: 'bg-green-100', text: 'text-green-700', label: '🧴 Cabelo' },
  'UNHAS': { bg: 'bg-pink-100', text: 'text-pink-700', label: '💅 Unhas' },
  'CILIOS': { bg: 'bg-purple-100', text: 'text-purple-700', label: '✨ Cílios' },
  'SOBRANCELHAS': { bg: 'bg-amber-100', text: 'text-amber-700', label: '🎯 Sobrancelhas' },
  'OUTRO': { bg: 'bg-gray-100', text: 'text-gray-700', label: '📌 Outro' },
};

const PROCEDIMENTOS_PREDEFINIDOS = [
  { nome: 'Progressiva', categoria: 'CABELO', requer_comprimento: true },
  { nome: 'Botox', categoria: 'CABELO', requer_comprimento: false },
  { nome: 'Coloração', categoria: 'CABELO', requer_comprimento: true },
  { nome: 'Luzes', categoria: 'CABELO', requer_comprimento: true },
  { nome: 'Fusion', categoria: 'CABELO', requer_comprimento: true },
  { nome: 'Hidratação', categoria: 'CABELO', requer_comprimento: true },
  { nome: 'Reconstrução', categoria: 'CABELO', requer_comprimento: true },
  { nome: 'Kit Lavatório', categoria: 'CABELO', requer_comprimento: false },
  { nome: 'Corte', categoria: 'CABELO', requer_comprimento: false },
  { nome: 'Unhas', categoria: 'UNHAS', requer_comprimento: false },
  { nome: 'Extensão de Cílios', categoria: 'CILIOS', requer_comprimento: false },
  { nome: 'Busso', categoria: 'SOBRANCELHAS', requer_comprimento: false },
  { nome: 'Sobrancelha', categoria: 'SOBRANCELHAS', requer_comprimento: false },
  { nome: 'Axila', categoria: 'OUTRO', requer_comprimento: false },
  { nome: 'Depilação', categoria: 'OUTRO', requer_comprimento: false },
  { nome: 'Detox', categoria: 'CABELO', requer_comprimento: false },
];

function CelulaEditavel({ valor, onSave, tipo = 'number', step = '0.01', habilitada = true }) {
  const [editando, setEditando] = useState(false);
  const [local, setLocal] = useState(String(valor || ''));
  const [salvo, setSalvo] = useState(false);

  const handleBlur = async () => {
    setEditando(false);
    if (local !== String(valor || '')) {
      await onSave(local);
      setSalvo(true);
      setTimeout(() => setSalvo(false), 2000);
    }
  };

  if (!habilitada) {
    return <span className="text-gray-300">—</span>;
  }

  if (editando) {
    return (
      <input
        autoFocus
        type={tipo}
        step={step}
        value={local}
        onChange={e => setLocal(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={e => e.key === 'Enter' && handleBlur()}
        className="w-20 border border-blue-400 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-300"
      />
    );
  }

  return (
    <span
      onClick={() => setEditando(true)}
      className="cursor-pointer hover:bg-blue-50 px-2 py-1 rounded text-xs group flex items-center gap-1 transition-colors"
    >
      {tipo === 'number' && valor ? `R$ ${Number(valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : local}
      {salvo && <span className="text-green-600 text-[10px]">✓</span>}
      <span className="text-gray-300 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">✏</span>
    </span>
  );
}

function AbaProcedimentos({ salaoId }) {
  const [lista, setLista] = useState([]);
  const [cfg, setCfg] = useState(null);
  const [novoAberto, setNovoAberto] = useState(false);
  const [novoForm, setNovoForm] = useState({ nome: '', categoria: 'OUTRO', requer_comprimento: false, preco_p: '', preco_m: '', preco_g: '', custo_variavel: '', porcentagem_profissional: '40' });
  const [salvandoNovo, setSalvandoNovo] = useState(false);
  const [filtroCategoria, setFiltroCategoria] = useState('TODOS');

  useEffect(() => { if (salaoId) carregarDados(); }, [salaoId]);

  const carregarDados = async () => {
    const [{ data: procs }, { data: cfgs }] = await Promise.all([
      supabase.from('procedimentos').select('*').eq('salao_id', salaoId).order('nome'),
      supabase.from('configuracoes').select('custo_fixo_por_atendimento, taxa_maquininha_pct').eq('salao_id', salaoId).single(),
    ]);
    setLista(procs || []);
    setCfg(cfgs);
  };

  const salvarCampo = async (id, campo, valor) => {
    const upd = { [campo]: campo.includes('preco') || campo === 'custo_variavel' ? Number(valor) || null : Number(valor) };
    await supabase.from('procedimentos').update(upd).eq('id', id);
    carregarDados();
  };

  const salvarNovoProcedimento = async (e) => {
    e.preventDefault();
    setSalvandoNovo(true);
    const { error } = await supabase.from('procedimentos').insert([{
      salao_id: salaoId,
      nome: novoForm.nome,
      categoria: novoForm.categoria,
      requer_comprimento: novoForm.requer_comprimento,
      preco_p: novoForm.preco_p ? Number(novoForm.preco_p) : null,
      preco_m: novoForm.preco_m ? Number(novoForm.preco_m) : null,
      preco_g: novoForm.preco_g ? Number(novoForm.preco_g) : null,
      custo_variavel: novoForm.custo_variavel ? Number(novoForm.custo_variavel) : 0,
      porcentagem_profissional: novoForm.porcentagem_profissional ? Number(novoForm.porcentagem_profissional) : 40,
      ativo: true,
    }]);
    setSalvandoNovo(false);
    if (error) { alert('Erro: ' + error.message); return; }
    setNovoAberto(false);
    setNovoForm({ nome: '', categoria: 'OUTRO', requer_comprimento: false, preco_p: '', preco_m: '', preco_g: '', custo_variavel: '', porcentagem_profissional: '40' });
    carregarDados();
  };

  const adicionarPredefinido = async (pred) => {
    setSalvandoNovo(true);
    const { error } = await supabase.from('procedimentos').insert([{
      salao_id: salaoId,
      nome: pred.nome,
      categoria: pred.categoria,
      requer_comprimento: pred.requer_comprimento,
      preco_p: null,
      preco_m: null,
      preco_g: null,
      custo_variavel: 0,
      porcentagem_profissional: 40,
      ativo: true,
    }]);
    setSalvandoNovo(false);
    if (!error) carregarDados();
  };

  const calcularLucro = (preco) => {
    if (!cfg || !preco) return null;
    const custo_fixo = Number(cfg.custo_fixo_por_atendimento || 29);
    const taxa_maq = (Number(cfg.taxa_maquininha_pct || 5) / 100) * preco;
    const comissao_prof = (Number(cfg.porcentagem_profissional || 40) / 100) * preco;
    return preco - custo_fixo - taxa_maq - comissao_prof;
  };

  const listaMostrada = filtroCategoria === 'TODOS' ? lista : lista.filter(p => p.categoria === filtroCategoria);

  return (
    <div className="space-y-6">
      {/* Menu de ações */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setNovoAberto(!novoAberto)}
          className="bg-gray-800 text-white text-sm px-4 py-2 rounded-lg hover:bg-gray-900 font-medium"
        >
          {novoAberto ? '✕ Cancelar' : '+ Novo procedimento'}
        </button>
      </div>

      {/* Formulário de novo procedimento */}
      {novoAberto && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
          <h3 className="text-sm font-bold text-gray-800 mb-4">Novo procedimento</h3>
          <form onSubmit={salvarNovoProcedimento} className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-gray-600 block mb-1 font-bold">Nome</label>
              <input
                type="text" required
                value={novoForm.nome}
                onChange={e => setNovoForm({...novoForm, nome: e.target.value})}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs"
              />
            </div>
            <div>
              <label className="text-xs text-gray-600 block mb-1 font-bold">Categoria</label>
              <select
                value={novoForm.categoria}
                onChange={e => setNovoForm({...novoForm, categoria: e.target.value})}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs"
              >
                {Object.entries(CATEGORIAS_CORES).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <label className="text-xs text-gray-600 block font-bold mb-1 w-full">Requer comprimento?</label>
              <input
                type="checkbox"
                checked={novoForm.requer_comprimento}
                onChange={e => setNovoForm({...novoForm, requer_comprimento: e.target.checked})}
                className="w-4 h-4"
              />
            </div>
            <div>
              <label className="text-xs text-gray-600 block mb-1 font-bold">Preço P (R$)</label>
              <input type="number" step="0.01" value={novoForm.preco_p} onChange={e => setNovoForm({...novoForm, preco_p: e.target.value})} className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs" />
            </div>
            {novoForm.requer_comprimento && (
              <>
                <div>
                  <label className="text-xs text-gray-600 block mb-1 font-bold">Preço M (R$)</label>
                  <input type="number" step="0.01" value={novoForm.preco_m} onChange={e => setNovoForm({...novoForm, preco_m: e.target.value})} className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs" />
                </div>
                <div>
                  <label className="text-xs text-gray-600 block mb-1 font-bold">Preço G (R$)</label>
                  <input type="number" step="0.01" value={novoForm.preco_g} onChange={e => setNovoForm({...novoForm, preco_g: e.target.value})} className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs" />
                </div>
              </>
            )}
            <div>
              <label className="text-xs text-gray-600 block mb-1 font-bold">Custo variável (R$)</label>
              <input type="number" step="0.01" value={novoForm.custo_variavel} onChange={e => setNovoForm({...novoForm, custo_variavel: e.target.value})} className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs" />
            </div>
            <div>
              <label className="text-xs text-gray-600 block mb-1 font-bold">% Profissional</label>
              <input type="number" step="0.1" value={novoForm.porcentagem_profissional} onChange={e => setNovoForm({...novoForm, porcentagem_profissional: e.target.value})} className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs" />
            </div>
            <div className="col-span-2 md:col-span-4 flex gap-2">
              <button type="submit" disabled={salvandoNovo} className="bg-gray-800 text-white text-xs px-4 py-2 rounded hover:bg-gray-900 disabled:opacity-50 font-bold">
                {salvandoNovo ? 'Salvando...' : 'Salvar novo'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lista de pré-definidos */}
      <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
        <p className="text-xs font-bold text-gray-600 mb-3">Ou adicione rapidamente:</p>
        <div className="flex flex-wrap gap-2">
          {PROCEDIMENTOS_PREDEFINIDOS.filter(p => !lista.some(l => l.nome === p.nome)).map(pred => (
            <button
              key={pred.nome}
              onClick={() => adicionarPredefinido(pred)}
              disabled={salvandoNovo}
              className="text-xs bg-white border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-50 transition-colors"
            >
              {pred.nome}
            </button>
          ))}
        </div>
      </div>

      {/* Filtro de categoria */}
      <div className="flex gap-2 flex-wrap border-b border-gray-200 pb-3">
        {['TODOS', ...Object.keys(CATEGORIAS_CORES)].map(cat => {
          const cores = cat === 'TODOS' ? { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Todos' } : CATEGORIAS_CORES[cat];
          return (
            <button
              key={cat}
              onClick={() => setFiltroCategoria(cat)}
              className={`text-xs px-3 py-1.5 rounded-full font-bold transition-all ${
                filtroCategoria === cat
                  ? `${cores.bg} ${cores.text} ring-2 ring-offset-1`
                  : `border border-gray-200 text-gray-600 hover:bg-gray-50`
              }`}
            >
              {cores.label}
            </button>
          );
        })}
      </div>

      {/* Tabela de procedimentos */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Procedimento', 'Categoria', 'Preço P', 'Preço M', 'Preço G', 'Custo var.', '% Prof.', 'Lucro est. (P)', 'Ativo'].map(h => (
                <th key={h} className="text-left px-3 py-3 text-xs text-gray-500 font-bold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {listaMostrada.map(p => {
              const cores = CATEGORIAS_CORES[p.categoria] || CATEGORIAS_CORES['OUTRO'];
              const lucroP = calcularLucro(p.preco_p);
              return (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-3 py-3 font-bold text-gray-800">{p.nome}</td>
                  <td className="px-3 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${cores.bg} ${cores.text}`}>
                      {cores.label}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <CelulaEditavel valor={p.preco_p} onSave={v => salvarCampo(p.id, 'preco_p', v)} />
                  </td>
                  <td className="px-3 py-3">
                    <CelulaEditavel valor={p.preco_m} onSave={v => salvarCampo(p.id, 'preco_m', v)} habilitada={p.requer_comprimento} />
                  </td>
                  <td className="px-3 py-3">
                    <CelulaEditavel valor={p.preco_g} onSave={v => salvarCampo(p.id, 'preco_g', v)} habilitada={p.requer_comprimento} />
                  </td>
                  <td className="px-3 py-3">
                    <CelulaEditavel valor={p.custo_variavel} onSave={v => salvarCampo(p.id, 'custo_variavel', v)} />
                  </td>
                  <td className="px-3 py-3">
                    <CelulaEditavel valor={p.porcentagem_profissional} onSave={v => salvarCampo(p.id, 'porcentagem_profissional', v)} step="0.1" />
                  </td>
                  <td className="px-3 py-3 text-xs font-bold">
                    {lucroP !== null ? (
                      <span className={lucroP > 0 ? 'text-green-700 bg-green-50 px-2 py-0.5 rounded' : 'text-red-700 bg-red-50 px-2 py-0.5 rounded'}>
                        R$ {lucroP.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-3 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${p.ativo ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {p.ativo ? 'Ativa' : 'Inativa'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
