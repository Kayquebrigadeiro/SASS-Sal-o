import { useEffect, useState, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './supabaseClient';
import Login from './pages/Login';
import Sidebar from './components/Sidebar';
import Agenda from './pages/Agenda';

const Dashboard     = lazy(() => import('./pages/Dashboard'));
const HomeCar       = lazy(() => import('./pages/HomeCar'));
const Paralelos     = lazy(() => import('./pages/Paralelos'));
const Despesas      = lazy(() => import('./pages/Despesas'));
const Configuracoes = lazy(() => import('./pages/Configuracoes'));

function Carregando() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin" />
    </div>
  );
}

export default function App() {
  const [sessao, setSessao] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    // Ping antecipado para acordar o Supabase do hibernate
    supabase.from('perfis_acesso').select('auth_user_id').limit(1).then(() => {});

    supabase.auth.getSession().then(async ({ data }) => {
      const session = data.session;
      if (session) {
        const [, { data: perfData }] = await Promise.all([
          setSessao(session),
          supabase.from('perfis_acesso').select('cargo, salao_id').eq('auth_user_id', session.user.id).single(),
        ]);
        setSessao(session);
        if (perfData) setPerfil(perfData);
      }
      setCarregando(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange(async (_e, session) => {
      if (session) {
        const { data: perfData } = await supabase
          .from('perfis_acesso').select('cargo, salao_id').eq('auth_user_id', session.user.id).single();
        setSessao(session);
        if (perfData) setPerfil(perfData);
      } else {
        setSessao(null);
        setPerfil(null);
      }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  if (carregando) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-800 rounded-full animate-spin" />
        <p className="text-gray-400 text-sm">Conectando ao servidor...</p>
        <p className="text-gray-300 text-xs">Pode levar alguns segundos na primeira vez</p>
      </div>
    );
  }

  if (!sessao) return <Login />;

  const role = perfil?.cargo || 'FUNCIONARIO';
  const salaoId = perfil?.salao_id;
  const email = sessao.user.email;
  const ctx = { salaoId, role };

  return (
    <BrowserRouter>
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar role={role} email={email} />
        <main className="flex-1 overflow-auto">
          <Suspense fallback={<Carregando />}>
          <Routes>
            <Route path="/agenda"        element={<Agenda {...ctx} />} />
            <Route path="/dashboard"     element={role === 'PROPRIETARIO' ? <Dashboard {...ctx} /> : <Navigate to="/agenda" />} />
            <Route path="/homecar"       element={role === 'PROPRIETARIO' ? <HomeCar {...ctx} /> : <Navigate to="/agenda" />} />
            <Route path="/paralelos"     element={role === 'PROPRIETARIO' ? <Paralelos {...ctx} /> : <Navigate to="/agenda" />} />
            <Route path="/despesas"      element={role === 'PROPRIETARIO' ? <Despesas {...ctx} /> : <Navigate to="/agenda" />} />
            <Route path="/configuracoes" element={role === 'PROPRIETARIO' ? <Configuracoes {...ctx} /> : <Navigate to="/agenda" />} />
            <Route path="*"              element={<Navigate to={role === 'PROPRIETARIO' ? '/dashboard' : '/agenda'} />} />
          </Routes>
          </Suspense>
        </main>
      </div>
    </BrowserRouter>
  );
}
