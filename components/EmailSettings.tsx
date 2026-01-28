import React, { useEffect, useMemo, useState } from 'react';
import { Mail, Save } from 'lucide-react';
import { supabase } from '../supabaseClient';

type AuthType = 'TLS' | 'SSL';

const autoSendStorageKey = 'cc_auto_send_enabled';

type EmailSettingsRow = {
  id: string;
  owner_id: string;
  from_email: string;
  smtp_server: string;
  smtp_username: string;
  smtp_password: string;
  smtp_port: number;
  auth_type: AuthType;
  default_charset: string | null;
  from_name: string | null;
  ide_charset: string | null;
  auto_send_enabled?: boolean | null;
};

const normalize = (v: unknown) => String(v ?? '').trim();

const getStoredAutoSendEnabled = () => {
  try {
    const raw = globalThis?.localStorage?.getItem(autoSendStorageKey);
    if (raw === '0' || raw === 'false') return false;
    if (raw === '1' || raw === 'true') return true;
  } catch {
  }
  return true;
};

const setStoredAutoSendEnabled = (enabled: boolean) => {
  try {
    globalThis?.localStorage?.setItem(autoSendStorageKey, enabled ? '1' : '0');
  } catch {
  }
};

const toOptionalInt = (v: unknown) => {
  const s = normalize(v);
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  const i = Math.trunc(n);
  return Number.isFinite(i) ? i : null;
};

const EmailSettings: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [fromEmail, setFromEmail] = useState('');
  const [smtpServer, setSmtpServer] = useState('');
  const [smtpUsername, setSmtpUsername] = useState('');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [smtpPort, setSmtpPort] = useState('587');
  const [authType, setAuthType] = useState<AuthType>('TLS');
  const [defaultCharset, setDefaultCharset] = useState('UTF-8');
  const [fromName, setFromName] = useState('');
  const [ideCharset, setIdeCharset] = useState('UTF-8');
  const [autoSendEnabled, setAutoSendEnabled] = useState(() => getStoredAutoSendEnabled());

  const inputClass =
    'w-full p-3 border border-gray-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-gray-900 dark:text-white transition-all';

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError('');
      try {
        const { data: userRes, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        const userId = userRes?.user?.id;
        if (!userId) throw new Error('Usuário não autenticado.');

        const { data, error } = await supabase
          .from('email_settings')
          .select('*')
          .eq('owner_id', userId)
          .limit(1)
          .maybeSingle();

        if (error) {
          const msg = String((error as any)?.message || error);
          if (msg.toLowerCase().includes('does not exist') || msg.toLowerCase().includes('relation')) {
            throw new Error('Tabela email_settings não existe no Supabase (execute as migrations).');
          }
          throw error;
        }

        const row = (data || null) as EmailSettingsRow | null;
        if (row) {
          setFromEmail(normalize(row.from_email));
          setSmtpServer(normalize(row.smtp_server));
          setSmtpUsername(normalize(row.smtp_username));
          setSmtpPassword(String(row.smtp_password ?? ''));
          setSmtpPort(String(row.smtp_port ?? ''));
          setAuthType((normalize(row.auth_type) as AuthType) || 'TLS');
          setDefaultCharset(normalize(row.default_charset || 'UTF-8') || 'UTF-8');
          setFromName(normalize(row.from_name || ''));
          setIdeCharset(normalize(row.ide_charset || 'UTF-8') || 'UTF-8');
          if (typeof row.auto_send_enabled === 'boolean') {
            setAutoSendEnabled(row.auto_send_enabled);
            setStoredAutoSendEnabled(row.auto_send_enabled);
          }
        }
      } catch (e: any) {
        setError(String(e?.message || e || 'Falha ao carregar configurações.'));
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, []);

  const canSave = useMemo(() => {
    if (!normalize(fromEmail)) return false;
    if (!normalize(smtpServer)) return false;
    if (!normalize(smtpUsername)) return false;
    if (!normalize(smtpPassword)) return false;
    const p = toOptionalInt(smtpPort);
    if (p === null || p <= 0) return false;
    return true;
  }, [fromEmail, smtpServer, smtpUsername, smtpPassword, smtpPort]);

  const handleSave = async () => {
    setError('');
    if (!canSave) return;

    setSaving(true);
    try {
      const { data: userRes, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      const userId = userRes?.user?.id;
      if (!userId) throw new Error('Usuário não autenticado.');

      const port = toOptionalInt(smtpPort);
      if (port === null || port <= 0) throw new Error('Port inválida.');

      const payload = {
        owner_id: userId,
        from_email: normalize(fromEmail),
        smtp_server: normalize(smtpServer),
        smtp_username: normalize(smtpUsername),
        smtp_password: String(smtpPassword),
        smtp_port: port,
        auth_type: authType,
        default_charset: normalize(defaultCharset) || null,
        from_name: normalize(fromName) || null,
        ide_charset: normalize(ideCharset) || null,
        auto_send_enabled: !!autoSendEnabled,
      };

      const { error } = await supabase.from('email_settings').upsert([payload], { onConflict: 'owner_id' });
      if (error) throw error;
      alert('Configurações salvas.');
    } catch (e: any) {
      setError(String(e?.message || e || 'Falha ao salvar configurações.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 md:p-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-blue-50 dark:bg-blue-900/20 p-2.5 rounded-xl">
          <Mail size={20} className="text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h2 className="text-lg md:text-xl font-black text-gray-900 dark:text-white uppercase tracking-tight">
            Configuração de E-mail
          </h2>
          <p className="text-[11px] font-bold text-gray-500 dark:text-slate-400">SMTP para lembretes e mensagens automáticas.</p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800 p-6 shadow-sm">
        {loading ? (
          <div className="text-sm font-bold text-gray-500 dark:text-slate-400">Carregando...</div>
        ) : (
          <>
            {error && <div className="mb-4 text-xs font-bold text-red-600 dark:text-red-400">{error}</div>}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-gray-500 dark:text-slate-500 uppercase mb-2">
                  Envio automático
                </label>
                <label className="inline-flex items-center gap-3 text-sm font-bold text-gray-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={autoSendEnabled}
                    onChange={(e) => {
                      const next = e.target.checked;
                      setAutoSendEnabled(next);
                      setStoredAutoSendEnabled(next);
                    }}
                    className="w-4 h-4"
                  />
                  Enviar e-mails automaticamente (romaneio criado e lembretes)
                </label>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-gray-500 dark:text-slate-500 uppercase mb-1">
                  From e-mail origem
                </label>
                <input
                  type="email"
                  className={inputClass}
                  value={fromEmail}
                  onChange={(e) => setFromEmail(e.target.value)}
                  placeholder="exemplo@seudominio.com"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-slate-500 uppercase mb-1">Servidor SMTP</label>
                <input
                  type="text"
                  className={inputClass}
                  value={smtpServer}
                  onChange={(e) => setSmtpServer(e.target.value)}
                  placeholder="smtp.seudominio.com"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-slate-500 uppercase mb-1">
                  User name (usuário e-mail conta)
                </label>
                <input
                  type="text"
                  className={inputClass}
                  value={smtpUsername}
                  onChange={(e) => setSmtpUsername(e.target.value)}
                  placeholder="exemplo@seudominio.com"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-slate-500 uppercase mb-1">Password</label>
                <input
                  type="password"
                  className={inputClass}
                  value={smtpPassword}
                  onChange={(e) => setSmtpPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-slate-500 uppercase mb-1">Port</label>
                <input
                  type="number"
                  className={inputClass}
                  value={smtpPort}
                  onChange={(e) => setSmtpPort(e.target.value)}
                  placeholder="587"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-slate-500 uppercase mb-1">
                  Tipo autenticação (TLS e SSL)
                </label>
                <select className={inputClass} value={authType} onChange={(e) => setAuthType(e.target.value as AuthType)}>
                  <option value="TLS">TLS</option>
                  <option value="SSL">SSL</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-slate-500 uppercase mb-1">From Name</label>
                <input
                  type="text"
                  className={inputClass}
                  value={fromName}
                  onChange={(e) => setFromName(e.target.value)}
                  placeholder="CARGACERTA"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-slate-500 uppercase mb-1">Default charset</label>
                <input
                  type="text"
                  className={inputClass}
                  value={defaultCharset}
                  onChange={(e) => setDefaultCharset(e.target.value)}
                  placeholder="UTF-8"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-gray-500 dark:text-slate-500 uppercase mb-1">
                  IDE Charset
                </label>
                <input
                  type="text"
                  className={inputClass}
                  value={ideCharset}
                  onChange={(e) => setIdeCharset(e.target.value)}
                  placeholder="UTF-8"
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end">
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={!canSave || saving}
                className="px-4 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    Salvar
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default EmailSettings;

