import { Routes, Route, Navigate } from 'react-router-dom';
import VendedorSidebar from './VendedorSidebar';
import MeusSaloes from './MeusSaloes';
import NovoSalao from './NovoSalao';
import GerenciarAdmins from './GerenciarAdmins';

export default function VendedorApp({ email, userId }) {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <VendedorSidebar email={email} />
      <main className="flex-1 overflow-auto">
        <Routes>
          <Route path="/admin/saloes" element={<MeusSaloes userId={userId} />} />
          <Route path="/admin/novo-salao" element={<NovoSalao userId={userId} />} />
          <Route path="/admin/admins" element={<GerenciarAdmins />} />
          <Route path="*" element={<Navigate to="/admin/saloes" />} />
        </Routes>
      </main>
    </div>
  );
}
