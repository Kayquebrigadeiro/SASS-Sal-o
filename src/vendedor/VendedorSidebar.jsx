import { NavLink } from 'react-router-dom';
import { supabase } from '../supabaseClient';

export default function VendedorSidebar({ email }) {
  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  return (
    <aside className="w-56 min-h-screen bg-slate-900 flex flex-col">
      {/* Badge identificador */}
      <div className="px-5 py-5 border-b border-slate-700">
        <div className="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded mb-3 inline-block">
          PAINEL DO ADMIN
        </div>
        <p className="text-xs text-slate-400 truncate">{email}</p>
      </div>

      <nav className="flex-1 py-4 space-y-0.5 px-2">
        <NavLink to="/admin/saloes"
          className={({ isActive }) =>
            `block px-3 py-2 rounded-lg text-sm transition-colors ${
              isActive ? 'bg-white text-slate-900 font-medium' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}>
          Meus Salões
        </NavLink>
        <NavLink to="/admin/novo-salao"
          className={({ isActive }) =>
            `block px-3 py-2 rounded-lg text-sm transition-colors ${
              isActive ? 'bg-white text-slate-900 font-medium' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}>
          + Novo Salão
        </NavLink>
        <NavLink to="/admin/admins"
          className={({ isActive }) =>
            `block px-3 py-2 rounded-lg text-sm transition-colors ${
              isActive ? 'bg-white text-slate-900 font-medium' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}>
          Admins
        </NavLink>
      </nav>

      <div className="px-4 py-4 border-t border-slate-700">
        <button onClick={handleLogout}
          className="w-full text-xs text-slate-500 hover:text-slate-300 text-left">
          Sair
        </button>
      </div>
    </aside>
  );
}
