import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

function fmt(val) {
  return Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function toISO(date) {
  const y = date.getFullYear(), m = String(date.getMonth()+1).padStart(2,'0'), d = String(date.getDate()).padStart(2,'0');
  return `${y}-${m}-${d}`;
}

const TIPOS = ['ALUGUEL','ENERGIA','AGUA','INTERNET','MATERIAL','EQUIPAMENTO','FORNECEDOR','FUNCIONARIO','OUTRO'];
const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const vazio = { data: toISO(new Date()), descricao: '', tipo: 'OUTRO', valor: '', pago: false };

export default function Despesas({ salaoId }) {
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(vazio);
  const [salvando, setSalvando] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState('');

  useEffect(() => { if (salaoId) carregar(); }, [salaoId, ano, mes]);

  const inicioMes = `${ano}-${String(mes).padStart(2,'0')}-01`;
  const fimMes = mes === 12 ? `${ano+1}-01-01` : `${ano}-${String(mes+1).padStart(2,'0')}-01`;

  const carregar = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('despesas')
      .select('*')
      .eq('salao_id', salaoId)
      .gte('data', inicioMes)
      .lt('data', fimMes)
      .order('data', { ascending: false });
    setLista(data || []);
    setLoading(false);
  };

  const salvar = async (e) => {
    e.preventDefault();
    setSalvando(true);
    const { error } = await supabase.from('despesas').insert([{ ...form, salao_id: salaoId, valor: Number(form.valor) }]);
    setSalvando(false);
    if (error) { alert('Erro: ' + error.message); return; }
    setModal(false);
    setForm(vazio);
    carregar();
  };

  const togglePago = async (id, pago) => {
    setLista(l => l.map(i => i.id === id ? { ...i, pago: !pago } : i));
    await supabase.from('despesas').update({ pago: !pago }).eq('id', id);
    carregar();
  };

  const listagem = filtroTipo ? lista.filter(i => i.tipo === filtroTipo) : lista;
  const totalGeral = lista.reduce((s, i) => s + Number(i.valor || 0), 0);
  const totalPago = lista.filter(i => i.pago).reduce((s, i) => s + Number(i.valor || 0), 0);
  const totalAberto = lista.filter(i => !i.pago).reduce((s, i) => s + Number(i.valor || 0), 0);

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-xl font-semibold text-gray-800">Despesas</h1>
        <div className="flex gap-2 ml-auto">
          <select value={mes} onChange={e => setMes(Number(e.target.value))} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
            {MESES.map((m,i) => <option key={i} value={i+1}>{m}</option>)}
          </select>
          <select value={ano} onChange={e => setAno(Number(e.target.value))} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
            {[2023,2024,2025,2026].map(a => <option key={a}>{a}</option>)}
          </select>
          <button onClick={() => { setForm(vazio); setModal(true); }} className="bg-gray-800 text-white text-sm px-4 py-1.5 rounded-lg hover:bg-gray-900">
            + Nova despesa
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4"><p className="text-xs text-gray-500">Total do mês</p><p className="text-lg font-semibold text-gray-800">{fmt(totalGeral)}</p></div>
        <div className="bg-white rounded-xl border border-gray-200 p-4"><p className="text-xs text-gray-500">Pagas</p><p className="text-lg font-semibold text-green-700">{fmt(totalPago)}</p></div>
        <div className="bg-white rounded-xl border border-gray-200 p-4"><p className="text-xs text-gray-500">Em aberto</p><p className="text-lg font-semibold text-red-600">{fmt(totalAberto)}</p></div>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        <button onClick={() => setFiltroTipo('')} className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${!filtroTipo ? 'bg-gray-800 text-white border-gray-800' : 'border-gray-200 text-gray-600 hover:border-gray-400'}`}>
          Todos
        </button>
        {TIPOS.map(t => (
          <button key={t} onClick={() => setFiltroTipo(t === filtroTipo ? '' : t)} className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${filtroTipo === t ? 'bg-gray-800 text-white border-gray-800' : 'border-gray-200 text-gray-600 hover:border-gray-400'}`}>
            {t.charAt(0) + t.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? <p className="p-6 text-sm text-gray-400">Carregando...</p> :
         listagem.length === 0 ? <p className="p-6 text-sm text-gray-400">Nenhuma despesa neste mês.</p> : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>{['Data','Descrição','Tipo','Valor','Status',''].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs text-gray-500 font-medium">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {listagem.map(item => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500 text-xs">{item.data}</td>
                  <td className="px-4 py-3 font-medium text-gray-800">{item.descricao}</td>
                  <td className="px-4 py-3"><span className="text-xs bg-gray-100 text-gray-600 rounded px-2 py-0.5">{item.tipo}</span></td>
                  <td className="px-4 py-3 font-medium text-red-600">{fmt(item.valor)}</td>
                  <td className="px-4 py-3">
                    {item.pago
                      ? <span className="text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full">Paga</span>
                      : <span className="text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded-full">Em aberto</span>
                    }
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => togglePago(item.id, item.pago)} className="text-xs border border-gray-200 rounded px-2 py-1 hover:bg-gray-50">
                      {item.pago ? 'Desfazer' : 'Marcar paga'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold mb-4">Nova despesa</h2>
            <form onSubmit={salvar} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-gray-600 block mb-1">Data</label><input type="date" required value={form.data} onChange={e => setForm({...form, data: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
                <div><label className="text-xs text-gray-600 block mb-1">Valor (R$)</label><input type="number" step="0.01" required value={form.valor} onChange={e => setForm({...form, valor: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
              </div>
              <div><label className="text-xs text-gray-600 block mb-1">Descrição</label><input type="text" required value={form.descricao} onChange={e => setForm({...form, descricao: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
              <div><label className="text-xs text-gray-600 block mb-1">Tipo</label>
                <select value={form.tipo} onChange={e => setForm({...form, tipo: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  {TIPOS.map(t => <option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</option>)}
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={form.pago} onChange={e => setForm({...form, pago: e.target.checked})} className="rounded" />
                Já foi paga
              </label>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModal(false)} className="flex-1 py-2.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancelar</button>
                <button type="submit" disabled={salvando} className="flex-1 py-2.5 text-sm bg-gray-800 text-white rounded-lg hover:bg-gray-900 disabled:opacity-50">{salvando ? 'Salvando...' : 'Salvar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
