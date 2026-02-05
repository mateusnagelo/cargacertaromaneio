
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
  Wallet,
  ClipboardList,
  BarChart3,
  AlertTriangle,
  Sun,
  Moon,
  MessageSquareText,
  LogOut
} from 'lucide-react';
import { CompanyInfo, Customer, ProductStock, RomaneioData, ExpenseStock, RomaneioStatus, Observation } from './types';
import { DEFAULT_ROMANEIO, DEFAULT_OBSERVATION } from './constants';
import CompanyManager from './components/CompanyManager.tsx';
import CustomerManager from './components/CustomerManager.tsx';
import ProductManager from './components/ProductManager.tsx';
import ExpenseManager from './components/ExpenseManager';
import Financeiro from './components/Financeiro';
import RomaneioGenerator from './components/RomaneioGenerator';
import RomaneioTracking from './components/RomaneioTracking';
import ObservationManager from './components/ObservationManager';
import Login from './components/Login';
import Reports from './components/Reports';
import EmailSettings from './components/EmailSettings';
import Dashboard from './components/Dashboard';
import { getRomaneios, sendRomaneioEmailNotification } from './api/romaneios';
import { supabase } from './supabaseClient';
import { formatCurrency, formatDate } from './utils';
import pkg from './package.json';

type Screen =
  | 'dashboard'
  | 'companies'
  | 'customers'
  | 'producers'
  | 'products'
  | 'romaneios'
  | 'romaneios_compra'
  | 'expenses'
  | 'financeiro'
  | 'tracking'
  | 'tracking_compra'
  | 'observations'
  | 'reports'
  | 'settings';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [forcePasswordReset, setForcePasswordReset] = useState(false);
  const [activeScreen, setActiveScreen] = useState<Screen>('dashboard');
  const [selectedRomaneio, setSelectedRomaneio] = useState<RomaneioData | null>(null);
  const [allowEditConcluded, setAllowEditConcluded] = useState(false);
  const [screenStack, setScreenStack] = useState<Screen[]>(['dashboard']);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [dueSoonRomaneios, setDueSoonRomaneios] = useState<RomaneioData[]>([]);
  const [showDueSoonModal, setShowDueSoonModal] = useState(false);
  const [dueSoonLoading, setDueSoonLoading] = useState(false);
  const [dueSoonEmailSending, setDueSoonEmailSending] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('bb_theme');
    return saved === 'dark';
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('bb_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('bb_theme', 'light');
    }
  }, [isDarkMode]);

  const navigateTo = (screen: Screen, options?: { reset?: boolean }) => {
    if (options?.reset) {
      setScreenStack([screen]);
    } else {
      setScreenStack((prev) => {
        const next = [...prev, screen];
        return next.length > 50 ? next.slice(-50) : next;
      });
    }
    setActiveScreen(screen);
  };

  const goBack = () => {
    setScreenStack((prev) => {
      if (prev.length <= 1) {
        setSelectedRomaneio(null);
        setActiveScreen('dashboard');
        return ['dashboard'];
      }
      const next = prev.slice(0, -1);
      const previousScreen = next[next.length - 1] ?? 'dashboard';
      setActiveScreen(previousScreen);
      if (previousScreen !== 'romaneios' && previousScreen !== 'romaneios_compra') {
        setSelectedRomaneio(null);
      }
      return next.length ? next : ['dashboard'];
    });
  };

  const toIsoDateOnly = (v: unknown) => {
    const s = String(v ?? '').trim();
    if (!s) return '';
    const br = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (br) {
      const dd = String(br[1]).padStart(2, '0');
      const mm = String(br[2]).padStart(2, '0');
      const yyyy = String(br[3]);
      return `${yyyy}-${mm}-${dd}`;
    }
    const isoMatch = s.match(/^(\d{4}-\d{2}-\d{2})/);
    if (isoMatch?.[1]) return isoMatch[1];
    const d = new Date(s);
    const t = d.getTime();
    if (!Number.isFinite(t)) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const extractDueDate = (r: any) => {
    const direct =
      r?.dueDate ??
      r?.due_date ??
      r?.data_vencimento ??
      r?.data_de_vencimento ??
      r?.vencimento ??
      r?.dataVencimento ??
      r?.dataDeVencimento ??
      '';
    if (direct) return direct;

    const payload = r?.payload && typeof r.payload === 'object' ? r.payload : null;
    if (!payload) return '';

    const walk = (obj: any, depth: number): string => {
      if (!obj || depth > 5) return '';
      for (const [k, v] of Object.entries(obj)) {
        if (typeof v === 'string') {
          if (/(due|venc)/i.test(k) && toIsoDateOnly(v)) return v;
        } else if (v && typeof v === 'object') {
          const found = walk(v, depth + 1);
          if (found) return found;
        }
      }
      return '';
    };

    return walk(payload, 0);
  };

  useEffect(() => {
    let isMounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;
      setIsAuthenticated(!!data.session);
      setUserEmail(data.session?.user?.email || '');
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setForcePasswordReset(true);
        setIsAuthenticated(false);
        setUserEmail('');
        return;
      }
      setIsAuthenticated(!!session);
      setUserEmail(session?.user?.email || '');
    });
    return () => {
      isMounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const parse = () => {
      const hash = String(window.location.hash || '').replace(/^#/, '');
      const params = new URLSearchParams(hash);
      const isRecovery = params.get('type') === 'recovery';
      setForcePasswordReset(isRecovery);
    };
    parse();
    window.addEventListener('hashchange', parse);
    return () => window.removeEventListener('hashchange', parse);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;

    const controller = new AbortController();
    const signal = controller.signal;

    const msDay = 24 * 60 * 60 * 1000;
    const today = new Date();
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const thresholdDays = 3;

    const diffDays = (isoDate: string) => {
      const raw = toIsoDateOnly(isoDate);
      if (!raw) return null;
      const d = new Date(`${raw}T00:00:00`);
      const t = d.getTime();
      if (!Number.isFinite(t)) return null;
      return Math.floor((t - todayMidnight.getTime()) / msDay);
    };

    const run = async () => {
      try {
        setDueSoonLoading(true);
        const all = await getRomaneios(signal);
        const dueSoon = (all || [])
          .filter((r) => {
            if (!r) return false;
            const s = (r.status || 'PENDENTE') as RomaneioStatus;
            if (s !== 'PENDENTE') return false;
            const due = extractDueDate(r as any);
            const d = diffDays(String(due ?? ''));
            if (d === null) return false;
            return d <= thresholdDays;
          })
          .sort((a, b) => {
            const da =
              diffDays(
                String(extractDueDate(a as any) ?? '')
              ) ?? 9999;
            const db =
              diffDays(
                String(extractDueDate(b as any) ?? '')
              ) ?? 9999;
            if (da !== db) return da - db;
            return String(a.number || '').localeCompare(String(b.number || ''), undefined, { numeric: true });
          });

        setDueSoonRomaneios(dueSoon);
        setShowDueSoonModal(dueSoon.length > 0);

        const targets = dueSoon.slice(0, 20).filter((r) => !!r?.id);
        if (targets.length) {
          await Promise.allSettled(
            targets.map((r) =>
              sendRomaneioEmailNotification({ romaneioId: String(r.id), type: 'LEMBRETE_PAGAMENTO' }, signal)
            )
          );
        }
      } catch (e: any) {
        if (e?.name !== 'AbortError') {
          setDueSoonRomaneios([]);
          setShowDueSoonModal(false);
        }
      } finally {
        setDueSoonLoading(false);
      }
    };

    run();
    return () => controller.abort();
  }, [isAuthenticated]);

  const toggleDarkMode = () => setIsDarkMode(!isDarkMode);

  const computeRomaneioTotal = (r: RomaneioData) => {
    const inferKind = (x?: Partial<RomaneioData> | null) => {
      const k = String((x as any)?.kind ?? '').trim().toUpperCase();
      if (k === 'COMPRA') return 'COMPRA';
      if (k === 'VENDA') return 'VENDA';
      const nature = String((x as any)?.natureOfOperation ?? '').trim().toUpperCase();
      if (nature.includes('COMPRA')) return 'COMPRA';
      return 'VENDA';
    };
    const productsTotal = Array.isArray(r.products)
      ? r.products.reduce((acc, p) => acc + (Number(p?.quantity || 0) * Number(p?.unitValue || 0)), 0)
      : 0;
    const expensesTotal = Array.isArray(r.expenses)
      ? r.expenses.reduce((acc, e) => acc + (Number((e as any)?.total) || 0), 0)
      : 0;
    const hasItems = (Array.isArray(r.products) && r.products.length > 0) || (Array.isArray(r.expenses) && r.expenses.length > 0);
    const itemsTotal = inferKind(r) === 'COMPRA' ? productsTotal - expensesTotal : productsTotal + expensesTotal;
    const dbTotal = Number((r as any)?.montante_total ?? (r as any)?.total_value ?? 0) || 0;
    return hasItems ? itemsTotal : dbTotal;
  };

  const daysUntilDue = (isoDate: string) => {
    const raw = toIsoDateOnly(isoDate);
    if (!raw) return null;
    const d = new Date(`${raw}T00:00:00`);
    const t = d.getTime();
    if (!Number.isFinite(t)) return null;
    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    return Math.floor((t - todayMidnight) / (24 * 60 * 60 * 1000));
  };

  const doLogout = async () => {
    if (logoutLoading) return;
    setLogoutLoading(true);
    try {
      await supabase.auth.signOut({ scope: 'local' } as any);
    } catch {
    } finally {
      setIsAuthenticated(false);
      setUserEmail('');
      setForcePasswordReset(false);
      setSelectedRomaneio(null);
      setActiveScreen('dashboard');
      setScreenStack(['dashboard']);
      setIsSidebarOpen(false);
      setShowDueSoonModal(false);
      setDueSoonRomaneios([]);
      setShowLogoutModal(false);
      setLogoutLoading(false);
    }
  };

  const handleLogout = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowLogoutModal(true);
  };

  const sendDueSoonReminders = async () => {
    if (!dueSoonRomaneios.length) return;
    const targets = dueSoonRomaneios.slice(0, 30).filter((r) => !!r?.id);
    if (!targets.length) return;
    setDueSoonEmailSending(true);
    try {
      const results = await Promise.allSettled(
        targets.map((r) => sendRomaneioEmailNotification({ romaneioId: String(r.id), type: 'LEMBRETE_PAGAMENTO' }))
      );
      const sent = results.filter((r) => r.status === 'fulfilled' && !(r.value as any)?.skipped).length;
      const skipped = results.filter((r) => r.status === 'fulfilled' && !!(r.value as any)?.skipped).length;
      const failed = results.filter((r) => r.status === 'rejected').length;
      alert(`E-mails: enviados ${sent}, ignorados ${skipped}, falharam ${failed}.`);
    } finally {
      setDueSoonEmailSending(false);
    }
  };

  const renderScreen = () => {
    switch (activeScreen) {
      case 'dashboard':
        return <Dashboard />;
      case 'tracking':
        return <RomaneioTracking 
                  onView={(romaneio) => {
                    setSelectedRomaneio(romaneio);
                    setAllowEditConcluded(false);
                    navigateTo('romaneios');
                  }}
                />;
      case 'tracking_compra':
        return (
          <RomaneioTracking
            kind="COMPRA"
            onView={(romaneio, options) => {
              setSelectedRomaneio(romaneio);
              setAllowEditConcluded(!!options?.allowEditConcluded);
              navigateTo('romaneios_compra');
            }}
          />
        );
      case 'companies':
      return <CompanyManager />;
      case 'customers':
        return <CustomerManager key="customers-clientes" />;
      case 'producers':
        return <CustomerManager key="customers-produtores" mode="produtores" />;
      case 'products':
      return <ProductManager />;
      case 'observations':
        return <ObservationManager />;
      case 'expenses':
        return <ExpenseManager />;
      case 'financeiro':
        return <Financeiro />;
      case 'reports':
        return <Reports />;
      case 'settings':
        return <EmailSettings />;
      case 'romaneios':
        return (
          <RomaneioGenerator
            key="romaneios-venda"
            onSave={() => {
              setSelectedRomaneio(null);
              setAllowEditConcluded(false);
              navigateTo('tracking', { reset: true });
            }}
            onCreateNew={() => {
              setSelectedRomaneio(null);
              setAllowEditConcluded(false);
            }}
            initialData={selectedRomaneio}
          />
        );
      case 'romaneios_compra':
        return (
          <RomaneioGenerator
            key="romaneios-compra"
            initialKind="COMPRA"
            allowEditConcluded={allowEditConcluded}
            onSave={() => {
              setSelectedRomaneio(null);
              setAllowEditConcluded(false);
              navigateTo('tracking_compra', { reset: true });
            }}
            onCreateNew={() => {
              setSelectedRomaneio(null);
              setAllowEditConcluded(false);
            }}
            initialData={selectedRomaneio}
          />
        );
      default:
        return <div className="p-8 dark:text-gray-300">Selecione uma opção no menu.</div>;
    }
  };

  if (forcePasswordReset) {
    return (
      <Login
        onLogin={() => setIsAuthenticated(true)}
        forcePasswordReset
        onPasswordResetDone={() => setForcePasswordReset(false)}
      />
    );
  }

  if (!isAuthenticated) {
    return <Login onLogin={() => setIsAuthenticated(true)} />;
  }

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, color: 'text-yellow-500' },
    { id: 'tracking', label: 'Histórico', icon: ClipboardList, color: 'text-purple-500' },
    { id: 'romaneios', label: 'Novo Romaneio', icon: FileText, color: 'text-orange-500' },
    { id: 'tracking_compra', label: 'Histórico Compras', icon: ClipboardList, color: 'text-emerald-500' },
    { id: 'romaneios_compra', label: 'Novo Romaneio Compra', icon: FileText, color: 'text-emerald-500' },
    { id: 'reports', label: 'Relatórios', icon: BarChart3, color: 'text-blue-500' },
    { id: 'products', label: 'Estoque', icon: Package, color: 'text-green-500' },
    { id: 'expenses', label: 'Despesas', icon: DollarSign, color: 'text-pink-500' },
    { id: 'financeiro', label: 'Financeiro', icon: Wallet, color: 'text-emerald-500' },
    { id: 'observations', label: 'Observações', icon: MessageSquareText, color: 'text-cyan-500' },
    { id: 'customers', label: 'Clientes', icon: Users, color: 'text-blue-500' },
    { id: 'producers', label: 'Produtores', icon: Users, color: 'text-emerald-500' },
    { id: 'companies', label: 'Empresas', icon: Building2, color: 'text-indigo-500' },
    { id: 'settings', label: 'Config. E-mail', icon: Settings, color: 'text-slate-500' },
  ];

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-gray-50 dark:bg-slate-950 overflow-hidden font-sans transition-colors duration-300">
      {/* Mobile Top Header */}
      <header className="no-print lg:hidden flex items-center justify-between px-4 py-4 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="bg-yellow-400 p-1.5 rounded-lg">
            <LayoutDashboard size={20} className="text-yellow-900" />
          </div>
          <div className="min-w-0">
            <div className="font-black text-gray-800 dark:text-white tracking-tight leading-tight">CARGACERTA</div>
            <div className="text-[10px] font-bold text-gray-400 dark:text-slate-500 truncate max-w-[170px] leading-tight">
              {userEmail || '-'}
            </div>
          </div>
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

      {showDueSoonModal && (
        <div className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm p-4 flex items-center justify-center">
          <div className="bg-white dark:bg-slate-900 rounded-[28px] w-full max-w-4xl max-h-[85vh] overflow-hidden shadow-2xl border border-gray-100 dark:border-slate-800">
            <div className="p-6 border-b border-gray-50 dark:border-slate-800 flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="bg-yellow-100 dark:bg-yellow-900/30 p-2 rounded-2xl text-yellow-700 dark:text-yellow-400">
                  <AlertTriangle size={18} />
                </div>
                <div>
                  <h3 className="text-base md:text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">
                    Romaneios próximos do vencimento
                  </h3>
                  <p className="text-[11px] font-bold text-gray-500 dark:text-slate-400">
                    {dueSoonLoading ? 'Carregando...' : `${dueSoonRomaneios.length} romaneio(s) vencem em até 3 dias.`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => void sendDueSoonReminders()}
                  className="px-4 py-2 rounded-xl bg-yellow-500 hover:bg-yellow-600 disabled:opacity-60 disabled:cursor-not-allowed text-white text-[10px] font-black uppercase tracking-widest"
                  disabled={dueSoonLoading || dueSoonEmailSending || dueSoonRomaneios.length === 0}
                >
                  {dueSoonEmailSending ? 'Enviando...' : 'Enviar lembretes'}
                </button>
                <button
                  onClick={() => setShowDueSoonModal(false)}
                  className="p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-400"
                  disabled={dueSoonLoading || dueSoonEmailSending}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-auto max-h-[calc(85vh-88px)]">
              {dueSoonLoading ? (
                <div className="text-sm font-bold text-gray-500 dark:text-slate-400">Carregando...</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px]">
                    <thead>
                      <tr className="text-left text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest border-b border-gray-50 dark:border-slate-800">
                        <th className="py-4 pr-6">Nº</th>
                        <th className="py-4 pr-6">Cliente</th>
                        <th className="py-4 pr-6">Vencimento</th>
                        <th className="py-4 pr-6">Faltam</th>
                        <th className="py-4 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dueSoonRomaneios.map((r) => {
                        const dueIso = toIsoDateOnly(extractDueDate(r as any));
                        const days = daysUntilDue(dueIso);
                        const isOverdue = days !== null && days < 0;
                        const total = computeRomaneioTotal(r);
                        return (
                          <tr
                            key={String(r.id)}
                            className={`border-b border-gray-50 dark:border-slate-800 text-sm ${
                              isOverdue ? 'bg-red-50/70 dark:bg-red-900/10' : ''
                            }`}
                          >
                            <td className={`py-4 pr-6 font-black ${isOverdue ? 'text-red-700 dark:text-red-300' : 'text-gray-900 dark:text-white'}`}>{String(r.number || '')}</td>
                            <td className="py-4 pr-6 text-gray-700 dark:text-slate-300">{String(r.client?.name || r.customer?.name || '')}</td>
                            <td className={`py-4 pr-6 ${isOverdue ? 'text-red-700 dark:text-red-300 font-bold' : 'text-gray-600 dark:text-slate-400'}`}>{dueIso ? formatDate(dueIso) : '-'}</td>
                            <td className="py-4 pr-6">
                              {days === null ? (
                                <span className="text-gray-600 dark:text-slate-400">-</span>
                              ) : isOverdue ? (
                                <span className="inline-flex items-center px-3 py-1 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 text-[10px] font-black uppercase tracking-widest">
                                  Vencido
                                </span>
                              ) : (
                                <span className="text-gray-600 dark:text-slate-400">{`${days} dia(s)`}</span>
                              )}
                            </td>
                            <td className={`py-4 text-right font-black ${isOverdue ? 'text-red-700 dark:text-red-300' : 'text-gray-900 dark:text-white'}`}>{formatCurrency(total)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showLogoutModal && (
        <div className="fixed inset-0 z-[95] bg-black/60 backdrop-blur-sm p-4 flex items-center justify-center">
          <div className="bg-white dark:bg-slate-900 rounded-[28px] w-full max-w-md overflow-hidden shadow-2xl border border-gray-100 dark:border-slate-800">
            <div className="p-6 border-b border-gray-50 dark:border-slate-800 flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="bg-red-100 dark:bg-red-900/30 p-2 rounded-2xl text-red-700 dark:text-red-400">
                  <AlertTriangle size={18} />
                </div>
                <div>
                  <h3 className="text-base md:text-lg font-black text-gray-900 dark:text-white uppercase tracking-tight">
                    Deseja realmente sair do sistema?
                  </h3>
                  <p className="text-[11px] font-bold text-gray-500 dark:text-slate-400">
                    Você precisará informar suas credenciais novamente.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowLogoutModal(false)}
                className="p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-400"
                disabled={logoutLoading}
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 grid grid-cols-2 gap-3">
              <button
                onClick={() => setShowLogoutModal(false)}
                disabled={logoutLoading}
                className="px-4 py-3 rounded-2xl bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-slate-200 text-[10px] font-black uppercase tracking-widest hover:bg-gray-100 dark:hover:bg-slate-700 transition-all disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                onClick={() => void doLogout()}
                disabled={logoutLoading}
                className="px-4 py-3 rounded-2xl bg-red-600 hover:bg-red-700 text-white text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {logoutLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Saindo...
                  </>
                ) : (
                  <>
                    <LogOut size={16} />
                    Sair
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
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
              <div className="min-w-0">
                <div className="font-black text-gray-800 dark:text-white tracking-tight text-lg leading-tight">CARGACERTA</div>
                <div className="text-[10px] font-bold text-gray-400 dark:text-slate-500 truncate max-w-[170px] leading-tight">
                  {userEmail || '-'}
                </div>
              </div>
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
                  if (item.id === 'romaneios' || item.id === 'romaneios_compra') setSelectedRomaneio(null);
                  navigateTo(
                    item.id as Screen,
                    item.id === 'tracking' || item.id === 'tracking_compra' || item.id === 'dashboard' ? { reset: true } : undefined
                  );
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
              <p className="text-[9px] text-gray-300 dark:text-slate-600 font-bold uppercase tracking-widest mt-1">vr {String((pkg as any)?.version || '').trim() || '-'}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative bg-gray-50 dark:bg-slate-950 transition-colors duration-300">
        {screenStack.length > 1 && (
          <div className="no-print sticky top-0 z-40 bg-gray-50/90 dark:bg-slate-950/90 backdrop-blur border-b border-gray-100 dark:border-slate-800">
            <div className="p-4">
              <button
                type="button"
                onClick={goBack}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-200 border border-gray-100 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800 transition-all text-[10px] font-black uppercase tracking-widest"
              >
                <ChevronLeft size={18} />
                VOLTAR
              </button>
            </div>
          </div>
        )}
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
