import { useState } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';

// Funções auxiliares para formatação de moeda
function formatarMoeda(valor) {
  if (!valor && valor !== 0) return '';
  return Number(valor).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function parseMoeda(texto) {
  if (!texto) return 0;
  // Remove tudo exceto números, vírgula e ponto
  const limpo = texto.replace(/[^\d,]/g, '');
  // Substitui vírgula por ponto
  const numero = limpo.replace(',', '.');
  return parseFloat(numero) || 0;
}

// Lista de procedimentos padrão baseada na planilha
const PROCEDIMENTOS_PADRAO = [
  { nome: 'Progressiva',       categoria: 'CABELO',       requer_comprimento: true,  preco_p: 130, custo_variavel: 50, porcentagem_profissional: 40 },
  { nome: 'Botox',             categoria: 'CABELO',       requer_comprimento: true,  preco_p: 100, custo_variavel: 40, porcentagem_profissional: 40 },
  { nome: 'Coloração',         categoria: 'CABELO',       requer_comprimento: true,  preco_p: 65,  preco_m: 80, preco_g: 95, custo_variavel: 28, porcentagem_profissional: 40 },
  { nome: 'Luzes',             categoria: 'CABELO',       requer_comprimento: true,  preco_p: 120, preco_m: 180, preco_g: 230, custo_variavel: 45, porcentagem_profissional: 40 },
  { nome: 'Fusion',            categoria: 'CABELO',       requer_comprimento: true,  preco_p: 50,  custo_variavel: 20, porcentagem_profissional: 40 },
  { nome: 'Hidratação',        categoria: 'CABELO',       requer_comprimento: true,  preco_p: 45,  custo_variavel: 15, porcentagem_profissional: 40 },
  { nome: 'Reconstrução',      categoria: 'CABELO',       requer_comprimento: true,  preco_p: 75,  custo_variavel: 25, porcentagem_profissional: 40 },
  { nome: 'Kit Lavatório',     categoria: 'CABELO',       requer_comprimento: true,  preco_p: 35,  custo_variavel: 10, porcentagem_profissional: 40 },
  { nome: 'Detox',             categoria: 'CABELO',       requer_comprimento: true,  preco_p: 60,  custo_variavel: 20, porcentagem_profissional: 40 },
  { nome: 'Plástica dos Fios', categoria: 'CABELO',       requer_comprimento: true,  preco_p: 90,  custo_variavel: 30, porcentagem_profissional: 40 },
  { nome: 'Nutrição',          categoria: 'CABELO',       requer_comprimento: true,  preco_p: 50,  custo_variavel: 15, porcentagem_profissional: 40 },
  { nome: 'Corte',             categoria: 'CABELO',       requer_comprimento: false, preco_p: 50,  custo_variavel: 0,  porcentagem_profissional: 40 },
  { nome: 'Relaxamento',       categoria: 'CABELO',       requer_comprimento: false, preco_p: 80,  custo_variavel: 30, porcentagem_profissional: 40 },
  { nome: 'Unhas',             categoria: 'UNHAS',        requer_comprimento: false, preco_p: 20,  custo_variavel: 5,  porcentagem_profissional: 40 },
  { nome: 'Sobrancelha',       categoria: 'SOBRANCELHAS', requer_comprimento: false, preco_p: 15,  custo_variavel: 2,  porcentagem_profissional: 40 },
  { nome: 'Busso',             categoria: 'SOBRANCELHAS', requer_comprimento: false, preco_p: 25,  custo_variavel: 3,  porcentagem_profissional: 40 },
  { nome: 'Axila',             categoria: 'SOBRANCELHAS', requer_comprimento: false, preco_p: 22,  custo_variavel: 3,  porcentagem_profissional: 40 },
  { nome: 'Extensão de Cílios',categoria: 'CILIOS',       requer_comprimento: false, preco_p: 70,  custo_variavel: 15, porcentagem_profissional: 40 },
  { nome: 'Cílios',            categoria: 'CILIOS',       requer_comprimento: false, preco_p: 20,  custo_variavel: 2,  porcentagem_profissional: 40 },
  { nome: 'Depilação',         categoria: 'OUTRO',        requer_comprimento: false, preco_p: 30,  custo_variavel: 5,  porcentagem_profissional: 40 },
];

export default function NovoSalao({ userId }) {
  const navigate = useNavigate();
  const [etapa, setEtapa] = useState(1);
  const [salvando, setSalvando] = useState(false);

  // Dados de cada etapa
  const [dadosSalao, setDadosSalao] = useState({
    nome: '', telefone: ''
  });
  
  const [profissionais, setProfissionais] = useState([
    { nome: '', cargo: 'PROPRIETARIO', salario_fixo: 0 }
  ]);
  
  const [procedimentosSelecionados, setProcedimentosSelecionados] = useState(
    PROCEDIMENTOS_PADRAO.map(p => ({ ...p, selecionado: false }))
  );
  
  const [despesas, setDespesas] = useState([
    { descricao: 'Aluguel',           tipo: 'ALUGUEL',    valor: 0 },
    { descricao: 'Energia',           tipo: 'ENERGIA',    valor: 0 },
    { descricao: 'Água',              tipo: 'AGUA',       valor: 0 },
    { descricao: 'Internet',          tipo: 'INTERNET',   valor: 0 },
    { descricao: 'Produtos Limpeza',  tipo: 'MATERIAL',   valor: 0 },
    { descricao: 'Alimentação',       tipo: 'MATERIAL',   valor: 0 },
    { descricao: 'Sistema',           tipo: 'EQUIPAMENTO',valor: 0 },
    { descricao: 'Acessórios',        tipo: 'EQUIPAMENTO',valor: 0 },
  ]);
  
  const [loginProprietaria, setLoginProprietaria] = useState({
    email: '', senha: '', nome: ''
  });

  const salvarTudo = async () => {
    setSalvando(true);
    try {
      // 1. Criar o salão
      const { data: salao, error: errSalao } = await supabase
        .from('saloes')
        .insert([{
          nome: dadosSalao.nome,
          telefone: dadosSalao.telefone,
          vendedor_id: userId,
          ativo: true
        }])
        .select()
        .single();

      if (errSalao) throw errSalao;

      // 2. Criar configurações padrão
      await supabase.from('configuracoes').insert([{
        salao_id: salao.id,
        custo_fixo_por_atendimento: 29,
        taxa_maquininha_pct: 5
      }]);

      // 3. Criar profissionais
      await supabase.from('profissionais').insert(
        profissionais.map(p => ({
          salao_id: salao.id,
          nome: p.nome,
          cargo: p.cargo,
          salario_fixo: p.cargo === 'PROPRIETARIO' ? 0 : Number(p.salario_fixo),
          ativo: true
        }))
      );

      // 4. Criar procedimentos selecionados
      const procsParaSalvar = procedimentosSelecionados
        .filter(p => p.selecionado)
        .map(p => ({
          salao_id: salao.id,
          nome: p.nome,
          categoria: p.categoria,
          requer_comprimento: p.requer_comprimento,
          preco_p: p.preco_p,
          preco_m: p.preco_m || null,
          preco_g: p.preco_g || null,
          custo_variavel: p.custo_variavel,
          porcentagem_profissional: p.porcentagem_profissional,
          ativo: true
        }));

      if (procsParaSalvar.length > 0) {
        await supabase.from('procedimentos').insert(procsParaSalvar);
      }

      // 5. Criar despesas fixas (primeiro dia do mês atual)
      const hoje = new Date();
      const inicioMes = `${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}-01`;
      const despesasParaSalvar = despesas
        .filter(d => d.valor > 0)
        .map(d => ({
          salao_id: salao.id,
          data: inicioMes,
          descricao: d.descricao,
          tipo: d.tipo,
          valor: Number(d.valor),
          pago: false
        }));

      if (despesasParaSalvar.length > 0) {
        await supabase.from('despesas').insert(despesasParaSalvar);
      }

      // 6. Criar usuário da proprietária
      const proprietaria = profissionais.find(p => p.cargo === 'PROPRIETARIO');
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: loginProprietaria.email,
        password: loginProprietaria.senha,
        options: {
          data: {
            nome: loginProprietaria.nome || proprietaria?.nome,
            salao_id: salao.id,
            cargo: 'PROPRIETARIO'
          },
          emailRedirectTo: window.location.origin
        }
      });

      if (authError) throw authError;

      // 7. Criar perfil de acesso da proprietária
      if (authData?.user) {
        await supabase.from('perfis_acesso').insert([{
          user_id: authData.user.id,
          email: loginProprietaria.email,
          tipo_acesso: 'proprietaria',
          salao_id: salao.id,
          nome: loginProprietaria.nome || proprietaria?.nome
        }]);
      }

      alert(`✅ Salão "${dadosSalao.nome}" criado com sucesso!\n\nCredenciais da proprietária:\nEmail: ${loginProprietaria.email}\nSenha: ${loginProprietaria.senha}\n\nGuarde essas informações!`);
      navigate('/admin/saloes');

    } catch (err) {
      console.error('Erro ao salvar:', err);
      alert('Erro ao criar salão: ' + err.message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-xl font-semibold text-slate-800 mb-2">Novo Salão</h1>
      
      {/* Barra de progresso */}
      <div className="flex gap-2 mb-8">
        {['Dados', 'Profissionais', 'Serviços', 'Despesas', 'Acesso'].map((label, i) => (
          <div key={i} className="flex-1">
            <div className={`h-1.5 rounded-full ${i + 1 <= etapa ? 'bg-slate-800' : 'bg-slate-200'}`} />
            <p className={`text-[10px] mt-1 ${i + 1 === etapa ? 'text-slate-800 font-medium' : 'text-slate-400'}`}>
              {label}
            </p>
          </div>
        ))}
      </div>

      {etapa === 1 && (
        <Etapa1Dados 
          dados={dadosSalao} 
          onChange={setDadosSalao} 
          onNext={() => setEtapa(2)} 
        />
      )}
      
      {etapa === 2 && (
        <Etapa2Profissionais 
          lista={profissionais} 
          onChange={setProfissionais} 
          onNext={() => setEtapa(3)} 
          onBack={() => setEtapa(1)} 
        />
      )}
      
      {etapa === 3 && (
        <Etapa3Procedimentos 
          lista={procedimentosSelecionados} 
          onChange={setProcedimentosSelecionados} 
          onNext={() => setEtapa(4)} 
          onBack={() => setEtapa(2)} 
        />
      )}
      
      {etapa === 4 && (
        <Etapa4Despesas 
          lista={despesas} 
          onChange={setDespesas} 
          onNext={() => setEtapa(5)} 
          onBack={() => setEtapa(3)} 
        />
      )}
      
      {etapa === 5 && (
        <Etapa5Acesso 
          dados={loginProprietaria} 
          onChange={setLoginProprietaria}
          profissionais={profissionais}
          onBack={() => setEtapa(4)}
          onSalvar={salvarTudo}
          salvando={salvando}
        />
      )}
    </div>
  );
}

// Componentes das etapas
function Etapa1Dados({ dados, onChange, onNext }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
      <h2 className="font-medium text-slate-700">Dados do salão</h2>
      <div>
        <label className="text-xs text-slate-600 block mb-1">Nome do salão *</label>
        <input required type="text" value={dados.nome}
          onChange={e => onChange({...dados, nome: e.target.value})}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
          placeholder="Ex: Studio Belle" />
      </div>
      <div>
        <label className="text-xs text-slate-600 block mb-1">Telefone</label>
        <input type="text" value={dados.telefone}
          onChange={e => onChange({...dados, telefone: e.target.value})}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
          placeholder="(11) 99999-9999" />
      </div>
      <div className="flex justify-end pt-2">
        <button onClick={onNext} disabled={!dados.nome}
          className="bg-slate-800 text-white text-sm px-6 py-2.5 rounded-lg disabled:opacity-40">
          Próximo →
        </button>
      </div>
    </div>
  );
}

function Etapa2Profissionais({ lista, onChange, onNext, onBack }) {
  const adicionar = () => onChange([...lista, { nome: '', cargo: 'FUNCIONARIO', salario_fixo: 0 }]);
  const remover = (i) => onChange(lista.filter((_, j) => j !== i));
  const editar = (i, campo, val) => {
    const nova = [...lista];
    nova[i][campo] = val;
    onChange(nova);
  };

  const temProprietario = lista.some(p => p.cargo === 'PROPRIETARIO');
  const valido = lista.length > 0 && lista.every(p => p.nome.trim()) && temProprietario;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <h2 className="font-medium text-slate-700 mb-4">Profissionais da equipe</h2>
      <p className="text-xs text-slate-500 mb-4">
        Adicione todas as profissionais. Pelo menos uma deve ser Proprietária.
      </p>

      <div className="space-y-3">
        {lista.map((p, i) => (
          <div key={i} className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="text-xs text-slate-500 block mb-1">Nome</label>
              <input type="text" value={p.nome} placeholder="Nome da profissional"
                onChange={e => editar(i, 'nome', e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="w-40">
              <label className="text-xs text-slate-500 block mb-1">Cargo</label>
              <select value={p.cargo} onChange={e => editar(i, 'cargo', e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm">
                <option value="PROPRIETARIO">Proprietária</option>
                <option value="FUNCIONARIO">Funcionária</option>
              </select>
            </div>
            <div className="w-32">
              <label className="text-xs text-slate-500 block mb-1">Salário fixo</label>
              <input type="text"
                value={p.cargo === 'PROPRIETARIO' ? '' : formatarMoeda(p.salario_fixo)}
                disabled={p.cargo === 'PROPRIETARIO'}
                onChange={e => editar(i, 'salario_fixo', parseMoeda(e.target.value))}
                placeholder="R$ 0,00"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-400" />
            </div>
            {lista.length > 1 && (
              <button onClick={() => remover(i)}
                className="text-red-400 hover:text-red-600 pb-2 text-sm">✕</button>
            )}
          </div>
        ))}
      </div>

      {!temProprietario && (
        <p className="text-xs text-red-500 mt-2">⚠ Adicione pelo menos uma Proprietária</p>
      )}

      <button onClick={adicionar}
        className="mt-4 text-sm text-slate-600 border border-slate-200 rounded-lg px-4 py-2 hover:bg-slate-50">
        + Adicionar profissional
      </button>

      <div className="flex justify-between pt-6">
        <button onClick={onBack} className="text-sm text-slate-500 border border-slate-200 rounded-lg px-5 py-2">← Voltar</button>
        <button onClick={onNext} disabled={!valido}
          className="bg-slate-800 text-white text-sm px-6 py-2.5 rounded-lg disabled:opacity-40">
          Próximo →
        </button>
      </div>
    </div>
  );
}

function Etapa3Procedimentos({ lista, onChange, onNext, onBack }) {
  const [modoEdicao, setModoEdicao] = useState(false);

  const toggleSelecao = (index) => {
    const nova = [...lista];
    nova[index].selecionado = !nova[index].selecionado;
    onChange(nova);
  };

  const editarPreco = (index, campo, valor) => {
    const nova = [...lista];
    nova[index][campo] = parseMoeda(valor);
    onChange(nova);
  };

  const selecionados = lista.filter(p => p.selecionado).length;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-medium text-slate-700">Procedimentos oferecidos</h2>
          <p className="text-xs text-slate-500 mt-1">
            Selecione os procedimentos que o salão oferece.
          </p>
        </div>
        <button
          onClick={() => setModoEdicao(!modoEdicao)}
          className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-50">
          {modoEdicao ? '✓ Concluir edição' : '✏ Editar preços'}
        </button>
      </div>

      <div className="max-h-96 overflow-y-auto space-y-2 mb-4">
        {lista.map((p, i) => (
          <div key={i} className={`flex items-center gap-3 p-3 border border-slate-200 rounded-lg ${
            !modoEdicao ? 'hover:bg-slate-50' : ''
          }`}>
            <input
              type="checkbox"
              checked={p.selecionado}
              onChange={() => toggleSelecao(i)}
              className="w-4 h-4"
            />
            <div className="flex-1">
              <span className="text-sm font-medium text-slate-700">{p.nome}</span>
              <span className="text-xs text-slate-400 ml-2">({p.categoria})</span>
            </div>
            
            {modoEdicao && p.selecionado ? (
              <div className="flex gap-2 items-center">
                <div className="w-24">
                  <label className="text-[10px] text-slate-400 block mb-0.5">Preço P</label>
                  <input
                    type="text"
                    value={formatarMoeda(p.preco_p)}
                    onChange={e => editarPreco(i, 'preco_p', e.target.value)}
                    className="w-full border border-slate-300 rounded px-2 py-1 text-xs"
                  />
                </div>
                {p.requer_comprimento && (
                  <>
                    <div className="w-24">
                      <label className="text-[10px] text-slate-400 block mb-0.5">Preço M</label>
                      <input
                        type="text"
                        value={formatarMoeda(p.preco_m || p.preco_p * 1.2)}
                        onChange={e => editarPreco(i, 'preco_m', e.target.value)}
                        placeholder="+20%"
                        className="w-full border border-slate-300 rounded px-2 py-1 text-xs"
                      />
                    </div>
                    <div className="w-24">
                      <label className="text-[10px] text-slate-400 block mb-0.5">Preço G</label>
                      <input
                        type="text"
                        value={formatarMoeda(p.preco_g || p.preco_p * 1.3)}
                        onChange={e => editarPreco(i, 'preco_g', e.target.value)}
                        placeholder="+30%"
                        className="w-full border border-slate-300 rounded px-2 py-1 text-xs"
                      />
                    </div>
                  </>
                )}
              </div>
            ) : (
              <span className="text-sm text-slate-600">R$ {formatarMoeda(p.preco_p)}</span>
            )}
          </div>
        ))}
      </div>

      <p className="text-xs text-slate-500 mb-4">
        {selecionados} procedimento(s) selecionado(s)
      </p>

      <div className="flex justify-between pt-4">
        <button onClick={onBack} className="text-sm text-slate-500 border border-slate-200 rounded-lg px-5 py-2">← Voltar</button>
        <button onClick={onNext} disabled={selecionados === 0}
          className="bg-slate-800 text-white text-sm px-6 py-2.5 rounded-lg disabled:opacity-40">
          Próximo →
        </button>
      </div>
    </div>
  );
}

function Etapa4Despesas({ lista, onChange, onNext, onBack }) {
  const editar = (i, campo, val) => {
    const nova = [...lista];
    nova[i][campo] = val;
    onChange(nova);
  };

  const adicionar = () => {
    onChange([...lista, { descricao: '', tipo: 'OUTRO', valor: 0 }]);
  };

  const remover = (i) => {
    if (lista.length > 1) {
      onChange(lista.filter((_, j) => j !== i));
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <h2 className="font-medium text-slate-700 mb-4">Despesas fixas mensais</h2>
      <p className="text-xs text-slate-500 mb-4">
        Configure as despesas fixas do salão. Deixe em R$ 0 as que não se aplicam.
      </p>

      <div className="space-y-3 max-h-96 overflow-y-auto">
        {lista.map((d, i) => (
          <div key={i} className="flex gap-3 items-center">
            <div className="flex-1">
              <input type="text" value={d.descricao}
                onChange={e => editar(i, 'descricao', e.target.value)}
                placeholder="Nome da despesa"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="w-40">
              <input type="text" value={formatarMoeda(d.valor)}
                onChange={e => editar(i, 'valor', parseMoeda(e.target.value))}
                placeholder="R$ 0,00"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            </div>
            {lista.length > 1 && (
              <button onClick={() => remover(i)}
                className="text-red-400 hover:text-red-600 text-sm px-2">✕</button>
            )}
          </div>
        ))}
      </div>

      <button onClick={adicionar}
        className="mt-4 text-sm text-slate-600 border border-slate-200 rounded-lg px-4 py-2 hover:bg-slate-50">
        + Adicionar despesa
      </button>

      <div className="flex justify-between pt-6">
        <button onClick={onBack} className="text-sm text-slate-500 border border-slate-200 rounded-lg px-5 py-2">← Voltar</button>
        <button onClick={onNext}
          className="bg-slate-800 text-white text-sm px-6 py-2.5 rounded-lg">
          Próximo →
        </button>
      </div>
    </div>
  );
}

function Etapa5Acesso({ dados, onChange, profissionais, onBack, onSalvar, salvando }) {
  const proprietaria = profissionais.find(p => p.cargo === 'PROPRIETARIO');
  const valido = dados.email && dados.senha && dados.senha.length >= 6;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
      <h2 className="font-medium text-slate-700">Criar acesso da proprietária</h2>
      <p className="text-xs text-slate-500">
        Defina com a dona do salão o e-mail e senha que ela usará para entrar no sistema.
      </p>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
        ⚠ O e-mail e senha são definidos <strong>agora</strong> pelo vendedor junto com a proprietária.
        O acesso é imediato após a criação.
      </div>

      <div>
        <label className="text-xs text-slate-600 block mb-1">Nome da proprietária *</label>
        <input type="text" value={dados.nome || proprietaria?.nome || ''}
          onChange={e => onChange({...dados, nome: e.target.value})}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
          placeholder="Nome completo" />
      </div>
      <div>
        <label className="text-xs text-slate-600 block mb-1">E-mail de acesso *</label>
        <input type="email" required value={dados.email}
          onChange={e => onChange({...dados, email: e.target.value})}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
          placeholder="email@exemplo.com" />
      </div>
      <div>
        <label className="text-xs text-slate-600 block mb-1">Senha *</label>
        <input type="text" required value={dados.senha}
          onChange={e => onChange({...dados, senha: e.target.value})}
          className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
          placeholder="Mínimo 6 caracteres" />
        <p className="text-xs text-slate-400 mt-1">
          Mostrado em texto puro para você anotar e entregar. A proprietária pode trocar depois.
        </p>
      </div>

      <div className="flex justify-between pt-4">
        <button onClick={onBack} disabled={salvando}
          className="text-sm text-slate-500 border border-slate-200 rounded-lg px-5 py-2 disabled:opacity-40">
          ← Voltar
        </button>
        <button onClick={onSalvar} disabled={!valido || salvando}
          className="bg-green-700 text-white text-sm px-6 py-2.5 rounded-lg disabled:opacity-40">
          {salvando ? 'Criando salão...' : '✓ Criar salão e acesso'}
        </button>
      </div>
    </div>
  );
}
