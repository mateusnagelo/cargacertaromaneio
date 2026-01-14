
import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Lock, 
  User, 
  Eye, 
  EyeOff, 
  ArrowRight,
  ShieldCheck,
  Truck
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import mapaBrasil from '../mapabrasil.png';

interface LoginProps {
  onLogin: () => void;
  forcePasswordReset?: boolean;
  onPasswordResetDone?: () => void;
}

const Login: React.FC<LoginProps> = ({ onLogin, forcePasswordReset, onPasswordResetDone }) => {
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot' | 'reset'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const parseRecoveryFromHash = () => {
      const hash = String(window.location.hash || '').replace(/^#/, '');
      const params = new URLSearchParams(hash);
      return params.get('type') === 'recovery';
    };

    const apply = () => {
      const isRecovery = !!forcePasswordReset || parseRecoveryFromHash();
      if (isRecovery) {
        setMode('reset');
        setError('');
        setSuccess('');
        setPassword('');
        setConfirmPassword('');
      }
    };

    apply();
    window.addEventListener('hashchange', apply);
    return () => window.removeEventListener('hashchange', apply);
  }, [forcePasswordReset]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (mode === 'forgot') {
      if (!username) {
        setError('Informe seu e-mail.');
        return;
      }
      setIsLoading(true);
      try {
        const redirectTo = window.location.origin;
        const { error: resetErr } = await supabase.auth.resetPasswordForEmail(username, { redirectTo });
        if (resetErr) {
          setError(resetErr.message || 'Falha ao enviar e-mail de recuperação.');
          setIsLoading(false);
          return;
        }
        setSuccess('Enviamos um link de recuperação para seu e-mail.');
        setIsLoading(false);
        return;
      } catch (err: any) {
        setError(String(err?.message || err || 'Falha ao enviar e-mail de recuperação.'));
        setIsLoading(false);
        return;
      }
    }

    if (mode === 'reset') {
      if (!password) {
        setError('Informe a nova senha.');
        return;
      }
      if (!confirmPassword) {
        setError('Por favor, confirme a nova senha.');
        return;
      }
      if (password !== confirmPassword) {
        setError('As senhas não conferem.');
        return;
      }
      if (String(password).length < 6) {
        setError('A senha precisa ter pelo menos 6 caracteres.');
        return;
      }
      setIsLoading(true);
      try {
        const { error: updateErr } = await supabase.auth.updateUser({ password });
        if (updateErr) {
          setError(updateErr.message || 'Falha ao atualizar senha.');
          setIsLoading(false);
          return;
        }
        await supabase.auth.signOut();
        window.location.hash = '';
        setMode('login');
        setPassword('');
        setConfirmPassword('');
        setSuccess('Senha atualizada. Faça login com a nova senha.');
        onPasswordResetDone?.();
        setIsLoading(false);
        return;
      } catch (err: any) {
        setError(String(err?.message || err || 'Falha ao atualizar senha.'));
        setIsLoading(false);
        return;
      }
    }

    if (!username || !password) {
      setError('Por favor, preencha todos os campos.');
      return;
    }

    if (mode === 'signup') {
      if (!confirmPassword) {
        setError('Por favor, confirme sua senha.');
        return;
      }
      if (password !== confirmPassword) {
        setError('As senhas não conferem.');
        return;
      }
      if (String(password).length < 6) {
        setError('A senha precisa ter pelo menos 6 caracteres.');
        return;
      }
    }

    setIsLoading(true);
    try {
      if (mode === 'signup') {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: username,
          password,
        });
        if (signUpError) {
          setError(signUpError.message || 'Falha ao criar conta.');
          setIsLoading(false);
          return;
        }
        if (data.session) {
          onLogin();
          setIsLoading(false);
          return;
        }
        setSuccess('Conta criada. Verifique seu e-mail para confirmar o cadastro.');
        setIsLoading(false);
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: username,
        password,
      });
      if (signInError) {
        setError(signInError.message || 'E-mail ou senha incorretos.');
        setIsLoading(false);
        return;
      }
      onLogin();
      setIsLoading(false);
    } catch (err: any) {
      setError(String(err?.message || err || 'Falha ao autenticar.'));
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full relative overflow-hidden bg-white font-sans selection:bg-yellow-200 selection:text-yellow-900">
      <div className="absolute top-0 left-0 w-full h-full z-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-yellow-100 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob"></div>
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-blue-100 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob animation-delay-2000"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full max-w-[800px] max-h-[800px] bg-yellow-50 rounded-full mix-blend-multiply filter blur-[100px] opacity-20 animate-pulse"></div>
      </div>

      <div className="relative z-10 min-h-screen grid grid-cols-1 lg:grid-cols-2">
        <div className="hidden lg:block relative">
          <div className="absolute inset-0 p-6">
            <div className="relative h-full w-full rounded-[40px] overflow-hidden border border-white/60 shadow-2xl shadow-yellow-100/50">
              <img
                src={mapaBrasil}
                alt="Mapa do Brasil"
                className="absolute inset-0 w-full h-full object-contain bg-[#eaf3ff]"
                draggable={false}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/15 to-transparent" />
              <div className="absolute left-10 right-10 bottom-10">
                <div className="inline-flex items-center gap-3 bg-white/90 backdrop-blur-xl border border-white px-5 py-4 rounded-3xl shadow-xl">
                  <div className="bg-yellow-400 p-2 rounded-2xl">
                    <Truck size={20} className="text-yellow-900" />
                  </div>
                  <div className="leading-tight">
                    <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Romaneios & Logística</p>
                    <p className="text-sm font-black text-gray-900">Mapa para acompanhamento operacional</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className={`flex items-center justify-center px-6 py-10 ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'} transition-all duration-1000 transform`}>
          <div className="w-full max-w-md">
            <div className="text-center mb-10">
              <div className="inline-flex items-center justify-center p-4 bg-yellow-400 rounded-3xl shadow-2xl shadow-yellow-200 mb-6 group transition-transform hover:scale-110 duration-500">
                <Truck size={40} className="text-yellow-900 group-hover:translate-x-2 transition-transform" />
              </div>
              <h1 className="text-4xl font-black text-gray-900 tracking-tight mb-2 uppercase">CARGACERTA</h1>
              <p className="text-gray-500 font-medium tracking-wide">Gestão de Romaneios & Logística</p>
            </div>

            <div className="bg-white/80 backdrop-blur-2xl border border-white p-8 md:p-10 rounded-[40px] shadow-2xl shadow-yellow-100/50">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-2 h-8 bg-yellow-400 rounded-full"></div>
            <h2 className="text-xl font-black text-gray-800 uppercase tracking-wider">
              {mode === 'signup' ? 'Criar Conta' : mode === 'forgot' ? 'Recuperar Senha' : mode === 'reset' ? 'Nova Senha' : 'Acesso ao Sistema'}
            </h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">E-mail</label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-yellow-600 transition-colors">
                  <User size={20} />
                </div>
                <input 
                  type="email" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="exemplo@cargacerta.com"
                  disabled={mode === 'reset'}
                  className="w-full pl-12 pr-4 py-4 bg-gray-50/50 border border-gray-100 rounded-2xl outline-none focus:ring-4 focus:ring-yellow-100 focus:border-yellow-400 focus:bg-white transition-all text-sm font-bold text-gray-900"
                />
              </div>
            </div>

            {mode !== 'forgot' && (
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">{mode === 'reset' ? 'Nova Senha' : 'Senha'}</label>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-yellow-600 transition-colors">
                    <Lock size={20} />
                  </div>
                  <input 
                    type={showPassword ? 'text' : 'password'} 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-12 pr-12 py-4 bg-gray-50/50 border border-gray-100 rounded-2xl outline-none focus:ring-4 focus:ring-yellow-100 focus:border-yellow-400 focus:bg-white transition-all text-sm font-bold text-gray-900"
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>
            )}

            {(mode === 'signup' || mode === 'reset') && (
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">{mode === 'reset' ? 'Confirmar Nova Senha' : 'Confirmar Senha'}</label>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-yellow-600 transition-colors">
                    <Lock size={20} />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-12 pr-12 py-4 bg-gray-50/50 border border-gray-100 rounded-2xl outline-none focus:ring-4 focus:ring-yellow-100 focus:border-yellow-400 focus:bg-white transition-all text-sm font-bold text-gray-900"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>
            )}

            {success && (
              <div className="bg-green-50 text-green-700 px-4 py-3 rounded-2xl text-xs font-bold border border-green-100 flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-green-600 rounded-full"></div>
                {success}
              </div>
            )}

            {error && (
              <div className="bg-red-50 text-red-600 px-4 py-3 rounded-2xl text-xs font-bold border border-red-100 flex items-center gap-2 animate-shake">
                <div className="w-1.5 h-1.5 bg-red-600 rounded-full animate-pulse"></div>
                {error}
              </div>
            )}

            <button 
              type="submit" 
              disabled={isLoading}
              className="w-full bg-gray-900 hover:bg-black text-white py-4 rounded-3xl font-black uppercase tracking-widest shadow-xl shadow-gray-200 hover:shadow-gray-300 transition-all active:scale-[0.98] flex items-center justify-center gap-3 group disabled:opacity-70 disabled:cursor-not-allowed overflow-hidden relative"
            >
              {isLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>{mode === 'signup' ? 'Criando conta...' : mode === 'forgot' ? 'Enviando...' : mode === 'reset' ? 'Atualizando...' : 'Autenticando...'}</span>
                </>
              ) : (
                <>
                  <span>{mode === 'signup' ? 'Criar Conta' : mode === 'forgot' ? 'Enviar Link' : mode === 'reset' ? 'Atualizar Senha' : 'Entrar no CargaCerta'}</span>
                  <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>

            {mode === 'login' && (
              <button
                type="button"
                onClick={() => {
                  setMode('forgot');
                  setError('');
                  setSuccess('');
                  setPassword('');
                  setConfirmPassword('');
                }}
                className="w-full text-center text-[11px] font-black uppercase tracking-widest text-gray-500 hover:text-gray-900 transition-colors"
              >
                Esqueci minha senha
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setMode((m) => (m === 'login' ? 'signup' : 'login'));
                setError('');
                setSuccess('');
                setPassword('');
                setConfirmPassword('');
              }}
              disabled={mode === 'forgot' || mode === 'reset'}
              className="w-full text-center text-[11px] font-black uppercase tracking-widest text-gray-500 hover:text-gray-900 transition-colors"
            >
              {mode === 'signup' ? 'Já tenho conta' : 'Criar conta'}
            </button>

            {(mode === 'forgot' || mode === 'reset') && (
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError('');
                  setSuccess('');
                  setPassword('');
                  setConfirmPassword('');
                  window.location.hash = '';
                  onPasswordResetDone?.();
                }}
                className="w-full text-center text-[11px] font-black uppercase tracking-widest text-gray-500 hover:text-gray-900 transition-colors"
              >
                Voltar
              </button>
            )}
          </form>

          <div className="mt-8 pt-8 border-t border-gray-50 flex items-center justify-between text-gray-400">
             <div className="flex items-center gap-2">
                <ShieldCheck size={16} className="text-green-500" />
                <span className="text-[10px] font-bold uppercase tracking-tight">Criptografia Ativa</span>
             </div>
             <span className="text-[10px] font-bold uppercase tracking-tight">v1.1.1</span>
          </div>
        </div>

            <p className="text-center mt-10 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
              VisionApp <span className="text-gray-300">•</span> Mateus Angelo
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
        .animate-shake {
          animation: shake 0.2s ease-in-out 0s 2;
        }
      `}</style>
    </div>
  );
};

export default Login;
