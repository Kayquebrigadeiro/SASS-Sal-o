import { NavLink } from 'react-router-dom';
import { supabase } from '../supabaseClient';

const itens = [
  { path: '/agenda',        label: 'Agenda',        roles: ['PROPRIETARIO','FUNCIONARIO'] },
  { path: '/dashboard',     label: 'Dashboard',     roles: ['PROPRIETARIO'] },
  { path: '/homecar',       label: 'Home Car',      roles: ['PROPRIETARIO'] },
  { path: '/paralelos',     label: 'Paralelos',     roles: ['PROPRIETARIO'] },
  { path: '/despesas',      label: 'Despesas',      roles: ['PROPRIETARIO'] },
  { path: '/configuracoes', label: 'Configurações', roles: ['PROPRIETARIO'] },
];

export default function Sidebar({ role, email }) {
  const visiveis = itens.filter(i => i.roles.includes(role));

  return (
    <aside className="w-52 min-h-screen bg-gray-900 flex flex-col">
      <div className="px-5 py-5 border-b border-gray-800">
        <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center mb-3">
          <span className="text-gray-900 text-sm font-bold">✂</span>
        </div>
        <p className="text-xs text-gray-400 truncate">{email}</p>
        <p className="text-xs text-gray-600 mt-0.5 capitalize">
          {role === 'PROPRIETARIO' ? 'Proprietária' : 'Funcionária'}
        </p>
      </div>

      <nav className="flex-1 py-4 space-y-0.5 px-2">
        {visiveis.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `block px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-white text-gray-900 font-medium'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="px-4 py-4 border-t border-gray-800">
        <button
          onClick={() => supabase.auth.signOut()}
          className="w-full text-xs text-gray-500 hover:text-gray-300 text-left"
        >
          Sair
        </button>
      </div>
    </aside>
  );
}
