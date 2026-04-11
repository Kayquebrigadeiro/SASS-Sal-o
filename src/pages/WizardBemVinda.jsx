import React, { useState } from 'react';
import { supabase } from '../supabaseClient'; // Adicione esta linha!

export default function WizardBemVinda() {
  const [loading, setLoading] = useState(false);
  const [dados, setDados] = useState({
    estimativaAtendimentosMes: 0,
    taxaMaquininha: 5,
    gastosPessoais: {},
    equipe: [{ nome: '', cargo: '', salarioFixo: 0, comissao: 40 }],
    servicos: [{ nome: '', preco: 0, custoMaterial: 0, requerComprimento: false }]
  });

  // Função auxiliar para calcular custo fixo total
  const calcularCustoFixoTotal = () => {
    // Soma de todos os custos fixos (aluguel, energia, água, internet, etc)
    // Este cálculo deve ser ajustado conforme seus dados
    const custos = Object.values(dados.gastosPessoais).reduce((sum, val) => 
      sum + (Number(val) || 0), 0
    );
    return custos;
  };

  const finalizarWizard = async () => {
    setLoading(true);
    
    try {
      // 1. Descobrir quem é a proprietária logada e qual o ID do salão dela
      const { data: { user }, error: erroUser } = await supabase.auth.getUser();
      if (erroUser || !user) throw new Error("Usuário não autenticado.");

      const { data: perfil, error: erroPerfil } = await supabase
        .from('perfis_acesso')
        .select('salao_id')
        .eq('auth_user_id', user.id)
        .single();
        
      if (erroPerfil || !perfil) throw new Error("Perfil não encontrado.");
      const salaoId = perfil.salao_id;

      // 2. A Matemática: Calcula o Custo Fixo por Atendimento
      const custoFixoTotal = calcularCustoFixoTotal();
      const custoPorAtendimento = custoFixoTotal / (Number(dados.estimativaAtendimentosMes) || 1);

      // 3. Salvar a Inteligência Financeira
      const { error: erroConfig } = await supabase
        .from('configuracoes')
        .update({
          custo_fixo_por_atendimento: custoPorAtendimento.toFixed(2),
          taxa_maquininha_pct: Number(dados.taxaMaquininha),
          gastos_pessoais: dados.gastosPessoais // O seu banco usa JSONB, aceita direto!
        })
        .eq('salao_id', salaoId);

      if (erroConfig) throw erroConfig;

      // 4. Salvar a Equipe
      const equipeInsert = dados.equipe
        .filter(m => m.nome.trim() !== '') // Ignora os campos vazios
        .map(m => ({
          salao_id: salaoId,
          nome: m.nome,
          cargo: m.cargo,
          salario_fixo: Number(m.salarioFixo) || 0
        }));
        
      if (equipeInsert.length > 0) {
        const { error: erroEquipe } = await supabase.from('profissionais').insert(equipeInsert);
        if (erroEquipe) throw erroEquipe;
      }

      // 5. Salvar os Serviços (Carros-Chefes)
      // Como a comissão no seu banco fica atrelada ao procedimento, usamos a comissão padrão
      const comissaoPadrao = Number(dados.equipe[0]?.comissao) || 40; 
      
      const servicosInsert = dados.servicos
        .filter(s => s.nome.trim() !== '')
        .map(s => ({
          salao_id: salaoId,
          nome: s.nome,
          preco_p: Number(s.preco) || 0,
          custo_variavel: Number(s.custoMaterial) || 0,
          requer_comprimento: s.requerComprimento,
          porcentagem_profissional: comissaoPadrao
        }));

      if (servicosInsert.length > 0) {
        const { error: erroServicos } = await supabase.from('procedimentos').insert(servicosInsert);
        if (erroServicos) throw erroServicos;
      }

      // 6. Virar a chave: Salão Configurado!
      const { error: erroSalao } = await supabase
        .from('saloes')
        .update({ configurado: true })
        .eq('id', salaoId);

      if (erroSalao) throw erroSalao;

      alert("Mágica feita! Seu salão está configurado. 🚀");
      
      // Recarrega a página para o sistema tirar ela do Wizard e mandar pro Dashboard
      window.location.reload(); 

    } catch (err) {
      console.error('[Wizard] Erro:', err);
      alert("Erro ao salvar configurações: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-sm">
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Bem-vinda ao seu novo salão! 🎉</h1>
          <p className="text-slate-600 mb-8">Configure as informações do seu salão para começar</p>

          <div className="space-y-6">
            {/* Etapa 1: Estimativa de Atendimentos */}
            <div className="border border-slate-200 rounded-lg p-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Estimativa de atendimentos por mês
              </label>
              <input
                type="number"
                value={dados.estimativaAtendimentosMes}
                onChange={(e) => setDados({...dados, estimativaAtendimentosMes: Number(e.target.value)})}
                className="w-full border border-slate-300 rounded-lg px-4 py-2"
                placeholder="Ex: 100"
              />
            </div>

            {/* Etapa 2: Taxa da Maquininha */}
            <div className="border border-slate-200 rounded-lg p-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Taxa da maquininha (%)
              </label>
              <input
                type="number"
                value={dados.taxaMaquininha}
                onChange={(e) => setDados({...dados, taxaMaquininha: Number(e.target.value)})}
                className="w-full border border-slate-300 rounded-lg px-4 py-2"
                placeholder="Ex: 5"
              />
            </div>

            {/* Etapa 3: Equipe */}
            <div className="border border-slate-200 rounded-lg p-4">
              <label className="block text-sm font-medium text-slate-700 mb-3">
                Sua equipe
              </label>
              {dados.equipe.map((membro, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <input
                    type="text"
                    placeholder="Nome"
                    value={membro.nome}
                    onChange={(e) => {
                      const novaEquipe = [...dados.equipe];
                      novaEquipe[i].nome = e.target.value;
                      setDados({...dados, equipe: novaEquipe});
                    }}
                    className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Cargo"
                    value={membro.cargo}
                    onChange={(e) => {
                      const novaEquipe = [...dados.equipe];
                      novaEquipe[i].cargo = e.target.value;
                      setDados({...dados, equipe: novaEquipe});
                    }}
                    className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              ))}
            </div>

            {/* Etapa 4: Serviços */}
            <div className="border border-slate-200 rounded-lg p-4">
              <label className="block text-sm font-medium text-slate-700 mb-3">
                Seus serviços principais
              </label>
              {dados.servicos.map((servico, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <input
                    type="text"
                    placeholder="Serviço"
                    value={servico.nome}
                    onChange={(e) => {
                      const novosServicos = [...dados.servicos];
                      novosServicos[i].nome = e.target.value;
                      setDados({...dados, servicos: novosServicos});
                    }}
                    className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  />
                  <input
                    type="number"
                    placeholder="Preço"
                    value={servico.preco}
                    onChange={(e) => {
                      const novosServicos = [...dados.servicos];
                      novosServicos[i].preco = Number(e.target.value);
                      setDados({...dados, servicos: novosServicos});
                    }}
                    className="w-24 border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              ))}
            </div>

            {/* Botão de Finalização */}
            <button
              onClick={finalizarWizard}
              disabled={loading}
              className="w-full bg-slate-800 text-white py-3 rounded-lg font-medium hover:bg-slate-900 disabled:opacity-50 transition"
            >
              {loading ? 'Salvando...' : 'Finalizar Configuração'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
