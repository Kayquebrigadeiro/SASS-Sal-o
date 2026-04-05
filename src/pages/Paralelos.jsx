import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

function fmt(val) {
  return Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function toISO(date) {
  const y = date.getFullYear(), m = String(date.getMonth()+1).padStart(2,'0'), d = String(date.getDate()).padStart(2,'0');
  return `${y}-${m}-${d}`;
}

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const vazio = { data: toISO(new Date()), profissional_id: '', descricao: '', cliente: '', valor: '', valor_pago: '' };

export default function Paralelos({ salaoId }) {
  const hoje = new Date();
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [lista, setLista] = useState([]);
  const [profissionais, setProfissionais] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(vazio);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => { if (salaoId) { carregarProfs(); carregar(); } }, [salaoId, ano, mes]);

  const inicioMes = `${ano}-${String(mes).padStart(2,'0')}-01`;
  const fimMes = mes === 12 ? `${ano+1}-01-01` : `${ano}-${String(mes+1).padStart(2,'0')}-01`;

  const carregarProfs = async () => {
    const { data } = await supabase.from('profissionais').select('id, nome').eq('salao_id', salaoId).eq('ativo', true);
    setProfissionais(data || []);
  };

  const carregar = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('procedimentos_paralelos')
      .select('*, profissionais(nome)')
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
    const payload = {
      ...form,
      salao_id: salaoId,
      profissional_id: form.profissional_id || null,
      valor: Number(form.valor) || 0,
      valor_pago: Number(form.valor_pago) || 0,
    };
    const { error } = await supabase.from('procedimentos_paralelos').insert([payload]);
    setSalvando(false);
    if (error) { alert('Erro: ' + error.message); return; }
    setModal(false);
    setForm(vazio);
    carregar();
  };

  const marcarPago = async (id, valor) => {
    setLista(l => l.map(i => i.id === id ? { ...i, valor_pago: valor, valor_pendente: 0 } : i));
    await supabase.from('procedimentos_paralelos').update({ valor_pago: valor }).eq('id', id);
    carregar();
  };

  const totalValor = lista.reduce((s, i) => s + Number(i.valor || 0), 0);
  const totalPago = lista.reduce((s, i) => s + Number(i.valor_pago || 0), 0);
  const totalPendente = lista.reduce((s, i) => s + Number(i.valor_pendente || 0), 0);

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-xl font-semibold text-gray-800">Procedimentos Paralelos</h1>
        <div className="flex gap-2 ml-auto">
          <select value={mes} onChange={e => setMes(Number(e.target.value))} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
            {MESES.map((m,i) => <option key={i} value={i+1}>{m}</option>)}
          </select>
          <select value={ano} onChange={e => setAno(Number(e.target.value))} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
            {[2023,2024,2025,2026].map(a => <option key={a}>{a}</option>)}
          </select>
          <button onClick={() => { setForm(vazio); setModal(true); }} className="bg-gray-800 text-white text-sm px-4 py-1.5 rounded-lg hover:bg-gray-900">
            + Novo serviço
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4"><p className="text-xs text-gray-500">Total</p><p className="text-lg font-semibold">{fmt(totalValor)}</p></div>
        <div className="bg-white rounded-xl border border-gray-200 p-4"><p className="text-xs text-gray-500">Recebido</p><p className="text-lg font-semibold text-green-700">{fmt(totalPago)}</p></div>
        <div className="bg-white rounded-xl border border-gray-200 p-4"><p className="text-xs text-gray-500">Pendente</p><p className="text-lg font-semibold text-yellow-600">{fmt(totalPendente)}</p></div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? <p className="p-6 text-sm text-gray-400">Carregando...</p> :
         lista.length === 0 ? <p className="p-6 text-sm text-gray-400">Nenhum serviço neste mês.</p> : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>{['Data','Cliente','Serviço','Profissional','Valor','Pago','Pendente',''].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs text-gray-500 font-medium">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {lista.map(item => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-500 text-xs">{item.data}</td>
                  <td className="px-4 py-3 font-medium text-gray-800">{item.cliente}</td>
                  <td className="px-4 py-3 text-gray-600">{item.descricao}</td>
                  <td className="px-4 py-3 text-gray-500">{item.profissionais?.nome || '—'}</td>
                  <td className="px-4 py-3 font-medium">{fmt(item.valor)}</td>
                  <td className="px-4 py-3 text-green-700">{fmt(item.valor_pago)}</td>
                  <td className="px-4 py-3">{Number(item.valor_pendente) > 0 ? <span className="text-yellow-600 font-medium">{fmt(item.valor_pendente)}</span> : <span className="text-green-600 text-xs">Pago</span>}</td>
                  <td className="px-4 py-3">{Number(item.valor_pendente) > 0 && <button onClick={() => marcarPago(item.id, item.valor)} className="text-xs border border-gray-200 rounded px-2 py-1 hover:bg-gray-50">Marcar pago</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold mb-4">Novo procedimento paralelo</h2>
            <form onSubmit={salvar} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-gray-600 block mb-1">Data</label><input type="date" required value={form.data} onChange={e => setForm({...form, data: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
                <div><label className="text-xs text-gray-600 block mb-1">Cliente</label><input type="text" required value={form.cliente} onChange={e => setForm({...form, cliente: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
              </div>
              <div><label className="text-xs text-gray-600 block mb-1">Serviço</label><input type="text" required value={form.descricao} onChange={e => setForm({...form, descricao: e.target.value})} placeholder="Ex: Cílios, Busso, Depilação" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
              <div><label className="text-xs text-gray-600 block mb-1">Profissional</label>
                <select value={form.profissional_id} onChange={e => setForm({...form, profissional_id: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                  <option value="">— sem profissional —</option>
                  {profissionais.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs text-gray-600 block mb-1">Valor (R$)</label><input type="number" step="0.01" required value={form.valor} onChange={e => setForm({...form, valor: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
                <div><label className="text-xs text-gray-600 block mb-1">Pago (R$)</label><input type="number" step="0.01" value={form.valor_pago} onChange={e => setForm({...form, valor_pago: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" /></div>
              </div>
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
