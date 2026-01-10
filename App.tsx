
import React, { useState, useMemo, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Package, 
  Users, 
  Building2, 
  FileText, 
  ChevronLeft, 
  Menu,
  X,
  Settings,
  DollarSign,
  ClipboardList,
  Sun,
  Moon,
  MessageSquareText,
  LogOut
} from 'lucide-react';
import { CompanyInfo, Customer, ProductStock, RomaneioData, ExpenseStock, RomaneioStatus, Observation } from './types';
import { DEFAULT_ROMANEIO, DEFAULT_OBSERVATION } from './constants';
import CompanyManager from './components/CompanyManager';
import CustomerManager from './components/CustomerManager';
import ProductManager from './components/ProductManager';
import ExpenseManager from './components/ExpenseManager';
import RomaneioGenerator from './components/RomaneioGenerator';
import RomaneioTracking from './components/RomaneioTracking';
import ObservationManager from './components/ObservationManager';
import Login from './components/Login';

type Screen = 'dashboard' | 'companies' | 'customers' | 'products' | 'romaneios' | 'expenses' | 'tracking' | 'observations';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('bb_auth') === 'true';
  });
  const [activeScreen, setActiveScreen] = useState<Screen>('tracking');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [clonedData, setClonedData] = useState<RomaneioData | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('bb_theme');
    return saved === 'dark';
  });

  // Global State (Persisted in LocalStorage)
  const [companies, setCompanies] = useState<CompanyInfo[]>(() => {
    try {
      const saved = localStorage.getItem('bb_companies');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const [customers, setCustomers] = useState<Customer[]>(() => {
    try {
      const saved = localStorage.getItem('bb_customers');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const [products, setProducts] = useState<ProductStock[]>(() => {
    try {
      const saved = localStorage.getItem('bb_products');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const [observations, setObservations] = useState<Observation[]>(() => {
    try {
      const saved = localStorage.getItem('bb_observations');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [{ id: 'default', title: 'PADRÃO CARGACERTA', content: DEFAULT_OBSERVATION }];
  });

  const [expenseStock, setExpenseStock] = useState<ExpenseStock[]>(() => {
    try {
      const saved = localStorage.getItem('bb_expenses_stock');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      { id: '1', code: '684', description: 'SEGURO CARGA' },
      { id: '2', code: '745', description: 'BALDEIO' },
      { id: '3', code: '544', description: 'CAIXA MADEIRA' },
      { id: '4', code: '692', description: 'PAPELÕES' },
    ];
  });

  const [romaneioHistory, setRomaneioHistory] = useState<RomaneioData[]>(() => {
    try {
      const saved = localStorage.getItem('bb_history');
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  });

  useEffect(() => { localStorage.setItem('bb_companies', JSON.stringify(companies)); }, [companies]);
  useEffect(() => { localStorage.setItem('bb_customers', JSON.stringify(customers)); }, [customers]);
  useEffect(() => { localStorage.setItem('bb_products', JSON.stringify(products)); }, [products]);
  useEffect(() => { localStorage.setItem('bb_observations', JSON.stringify(observations)); }, [observations]);
  useEffect(() => { localStorage.setItem('bb_expenses_stock', JSON.stringify(expenseStock)); }, [expenseStock]);
  useEffect(() => { localStorage.setItem('bb_history', JSON.stringify(romaneioHistory)); }, [romaneioHistory]);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('bb_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('bb_theme', 'light');
    }
  }, [isDarkMode]);

  const toggleDarkMode = () => setIsDarkMode(!isDarkMode);

  const handleLogout = (e: React.MouseEvent) => {
    e.preventDefault();
    if (window.confirm('Deseja realmente sair do sistema?')) {
      localStorage.removeItem('bb_auth');
      setIsAuthenticated(false);
      setIsSidebarOpen(false);
    }
  };

  const addRomaneioToHistory = (romaneio: RomaneioData) => {
    setRomaneioHistory(prev => [romaneio, ...prev]);
    setClonedData(null);
    setTimeout(() => {
      setActiveScreen('tracking');
    }, 150);
  };

  const updateRomaneioStatus = (id: string, status: RomaneioStatus) => {
    setRomaneioHistory(prev => prev.map(r => r.id === id ? { ...r, status } : r));
  };

  const deleteRomaneio = (id: string) => {
    if (confirm('Tem certeza que deseja excluir este romaneio?')) {
      setRomaneioHistory(prev => prev.filter(r => r.id !== id));
    }
  };

  const handleCloneRequest = (data: RomaneioData) => {
    setClonedData(data);
    setActiveScreen('romaneios');
  };

  const renderScreen = () => {
    switch (activeScreen) {
      case 'tracking':
        return <RomaneioTracking 
                  history={romaneioHistory} 
                  updateStatus={updateRomaneioStatus} 
                  deleteRomaneio={deleteRomaneio}
                  onClone={handleCloneRequest}
                  onView={(r) => console.log("Ver:", r.number)}
                />;
      case 'companies':
        return <CompanyManager companies={companies} setCompanies={setCompanies} />;
      case 'customers':
        return <CustomerManager customers={customers} setCustomers={setCustomers} />;
      case 'products':
        return <ProductManager products={products} setProducts={setProducts} />;
      case 'observations':
        return <ObservationManager observations={observations} setObservations={setObservations} />;
      case 'expenses':
        return <ExpenseManager expenses={expenseStock} setExpenses={setExpenseStock} />;
      case 'romaneios':
        return (
          <RomaneioGenerator 
            companies={companies} 
            customers={customers} 
            stockProducts={products} 
            expenseStock={expenseStock}
            observations={observations}
            onSave={addRomaneioToHistory}
            initialData={clonedData}
          />
        );
      default:
        return <div className="p-8 dark:text-gray-300">Selecione uma opção no menu.</div>;
    }
  };

  if (!isAuthenticated) {
    return <Login onLogin={() => {
      localStorage.setItem('bb_auth', 'true');
      setIsAuthenticated(true);
    }} />;
  }

  const menuItems = [
    { id: 'tracking', label: 'Histórico', icon: ClipboardList, color: 'text-purple-500' },
    { id: 'romaneios', label: 'Novo Romaneio', icon: FileText, color: 'text-orange-500' },
    { id: 'products', label: 'Estoque', icon: Package, color: 'text-green-500' },
    { id: 'expenses', label: 'Despesas', icon: DollarSign, color: 'text-pink-500' },
    { id: 'observations', label: 'Observações', icon: MessageSquareText, color: 'text-cyan-500' },
    { id: 'customers', label: 'Clientes', icon: Users, color: 'text-blue-500' },
    { id: 'companies', label: 'Empresas', icon: Building2, color: 'text-indigo-500' },
  ];

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-gray-50 dark:bg-slate-950 overflow-hidden font-sans transition-colors duration-300">
      {/* Mobile Top Header */}
      <header className="no-print lg:hidden flex items-center justify-between px-4 py-4 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="bg-yellow-400 p-1.5 rounded-lg">
            <LayoutDashboard size={20} className="text-yellow-900" />
          </div>
          <span className="font-black text-gray-800 dark:text-white tracking-tight">CARGACERTA</span>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={toggleDarkMode}
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl text-gray-500 dark:text-gray-400 transition-colors"
          >
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl text-gray-500 dark:text-gray-400"
          >
            <Menu size={24} />
          </button>
        </div>
      </header>

      {/* Sidebar Overlay for Mobile */}
      {isSidebarOpen && (
        <div 
          className="no-print lg:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-[60]"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`no-print fixed inset-y-0 left-0 w-72 bg-white dark:bg-slate-900 border-r border-gray-100 dark:border-slate-800 transition-all duration-300 z-[70] lg:relative lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full">
          {/* Sidebar Header */}
          <div className="p-6 border-b border-gray-50 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-yellow-400 p-2 rounded-xl shadow-lg shadow-yellow-100 dark:shadow-none">
                <LayoutDashboard size={24} className="text-yellow-900" />
              </div>
              <span className="font-black text-gray-800 dark:text-white tracking-tight text-lg">CARGACERTA</span>
            </div>
            <button 
              onClick={() => setIsSidebarOpen(false)}
              className="lg:hidden p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl text-gray-400"
            >
              <X size={20} />
            </button>
          </div>

          {/* Sidebar Content (Scrollable) */}
          <nav className="flex-1 p-4 space-y-2 overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between px-3 mb-4">
               <p className="text-[10px] font-black text-gray-300 dark:text-slate-600 uppercase tracking-widest">Módulos</p>
               <button 
                onClick={toggleDarkMode}
                className="hidden lg:flex items-center gap-2 px-2 py-1 bg-gray-50 dark:bg-slate-800 text-gray-400 dark:text-gray-500 rounded-lg hover:text-gray-900 dark:hover:text-white transition-all border border-transparent dark:border-slate-700"
               >
                 {isDarkMode ? <Sun size={14} /> : <Moon size={14} />}
               </button>
            </div>
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  if (item.id === 'romaneios') setClonedData(null);
                  setActiveScreen(item.id as Screen);
                  setIsSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-200 group ${
                  activeScreen === item.id 
                    ? 'bg-gray-900 dark:bg-white text-white dark:text-slate-900 shadow-xl shadow-gray-200 dark:shadow-none' 
                    : 'text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <item.icon className={`w-5 h-5 shrink-0 ${activeScreen === item.id ? (isDarkMode ? 'text-indigo-900' : item.color) : 'text-gray-400 group-hover:text-gray-600 dark:group-hover:text-slate-300'}`} />
                <span className="font-bold text-sm">{item.label}</span>
              </button>
            ))}
          </nav>

          {/* Sidebar Footer (Fixed) */}
          <div className="p-6 border-t border-gray-50 dark:border-slate-800 bg-white dark:bg-slate-900">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl text-red-500 bg-red-50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/20 hover:text-red-700 transition-all group mb-6"
            >
              <LogOut size={20} className="group-hover:rotate-12 transition-transform shrink-0" />
              <span className="font-black text-xs uppercase tracking-widest">Sair do Sistema</span>
            </button>

            <div className="bg-blue-50 dark:bg-slate-800/50 p-4 rounded-2xl mb-6 border border-blue-100 dark:border-slate-700">
                <div className="flex items-center gap-3 mb-2">
                   <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                   <p className="text-[10px] font-black text-blue-500 uppercase">Status</p>
                </div>
                <p className="text-[11px] font-bold text-blue-900 dark:text-blue-200 leading-tight">Backup automático PWA ativo.</p>
            </div>

            <div className="text-center">
              <p className="text-[10px] font-medium text-gray-400 dark:text-slate-500 italic">
                Desenvolvido por <span className="font-bold text-gray-500 dark:text-slate-400 not-italic">VisionApp - Mateus Angelo</span>
              </p>
              <p className="text-[9px] text-gray-300 dark:text-slate-600 font-bold uppercase tracking-widest mt-1">vr 1.1.1</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative bg-gray-50 dark:bg-slate-950 transition-colors duration-300">
        {renderScreen()}
      </main>
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #1e293b;
        }
      `}</style>
    </div>
  );
};

export default App;
