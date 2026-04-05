import { useState } from 'react';
import { supabase } from '../supabaseClient';

export default function Login() {
  const [email, setEmail]       = useState('');
  const [senha, setSenha]       = useState('');
  const [erro, setErro]         = useState('');
  const [loading, setLoading]   = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setErro('');
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    });

    if (error) {
      setErro('E-mail ou senha incorretos.');
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-sm p-8">

        {/* Logo / título */}
        <div className="mb-8 text-center">
          <div className="w-14 h-14 bg-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-2xl">✂</span>
          </div>
          <h1 className="text-xl font-bold text-gray-800">Sistema do Salão</h1>
          <p className="text-sm text-gray-500 mt-1">Acesso restrito</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              E-mail
            </label>
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800"
              placeholder="seu@email.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Senha
            </label>
            <input
              type="password"
              required
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-800"
              placeholder="••••••••"
            />
          </div>

          {erro && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {erro}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gray-800 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mt-2"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <p className="text-xs text-gray-400 text-center mt-6">
          Problemas com acesso? Fale com o suporte.
        </p>
      </div>
    </div>
  );
}
