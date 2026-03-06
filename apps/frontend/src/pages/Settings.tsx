import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { useUserPreferences } from '../context/UserPreferencesContext';

const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'MXN', 'ARS', 'COP'];
const DATE_FORMATS = ['dd/MM/yyyy', 'MM/dd/yyyy', 'yyyy-MM-dd'];
const LANGUAGES = [
  { value: 'es', label: '🇪🇸 Español' },
  { value: 'en', label: '🇬🇧 English' },
];

export default function Settings() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<'usuario'|'general'|'fiscal'|'email'|'ses'|'preferences'>('usuario');
  const [smtpPass, setSmtpPass] = useState('');
  const [testEmail, setTestEmail] = useState('');
  const [testResult, setTestResult] = useState<{ok: boolean; message: string} | null>(null);
  const [testing, setTesting] = useState(false);
  const [form, setForm] = useState<any>({});
  const { theme, language, setTheme, setLanguage } = useUserPreferences();

  const { data: org, isLoading } = useQuery({
    queryKey: ['organization'],
    queryFn: () => api.get('/organization').then(r => r.data),
  });

  const currentValue = (field: string) => form[field] !== undefined ? form[field] : (org?.[field] ?? '');

  const updateMutation = useMutation({
    mutationFn: (data: any) => api.put('/organization', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['organization'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      setForm({});
      setSmtpPass('');
    },
  });

  const handleSave = () => {
    const data = { ...form };
    if (smtpPass) data.smtpPass = smtpPass;
    updateMutation.mutate(data);
  };

  const handleLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setForm({ ...form, logo: reader.result as string });
    reader.readAsDataURL(file);
  };

  const handleTestSmtp = async () => {
    if (!testEmail) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await api.post('/organization/test-smtp', { email: testEmail });
      setTestResult({ ok: true, message: res.data.message });
    } catch (err: any) {
      setTestResult({ ok: false, message: err.response?.data?.message || 'Error desconocido' });
    } finally {
      setTesting(false);
    }
  };

  const f = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [field]: e.target.value });

  const tabs = [
    { id: 'usuario',     label: t('settings.tabs.user') },
    { id: 'general',     label: t('settings.tabs.general') },
    { id: 'fiscal',      label: t('settings.tabs.fiscal') },
    { id: 'email',       label: t('settings.tabs.email') },
    { id: 'ses',         label: '🚔 SES Hospedajes' },
    { id: 'preferences', label: t('settings.tabs.preferences') },
  ];

  if (isLoading) return <div className="p-6 text-slate-400">{t('common.loading')}</div>;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t('settings.title')}</h1>
          <p className="text-slate-400 text-sm mt-1">{t('settings.subtitle')}</p>
        </div>
        {activeTab !== 'usuario' && (
          <button onClick={handleSave} disabled={updateMutation.isPending}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-700 rounded-lg text-sm font-semibold transition-colors">
            {saved ? t('common.saved') : updateMutation.isPending ? t('common.saving') : t('common.save')}
          </button>
        )}
      </div>

      <div className="flex gap-1 mb-6 bg-slate-900 border border-slate-800 rounded-xl p-1 flex-wrap">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${activeTab === tab.id ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5">

        {/* USUARIO */}
        {activeTab === 'usuario' && (
          <>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                {t('settings.theme')}
              </label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: 'dark', label: t('settings.themeDark'), icon: '🌙', desc: language === 'es' ? 'Fondo oscuro, texto claro' : 'Dark background, light text' },
                  { value: 'light', label: t('settings.themeLight'), icon: '☀️', desc: language === 'es' ? 'Fondo claro, texto oscuro' : 'Light background, dark text' },
                ].map(opt => (
                  <button key={opt.value} onClick={() => setTheme(opt.value as any)}
                    className={`p-4 rounded-xl border-2 transition-colors text-left ${theme === opt.value ? 'border-emerald-500 bg-slate-800' : 'border-slate-700 bg-slate-800 hover:border-slate-600'}`}>
                    <div className="text-2xl mb-2">{opt.icon}</div>
                    <div className="font-semibold text-sm">{opt.label}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{opt.desc}</div>
                    {theme === opt.value && <div className="text-xs text-emerald-400 mt-1">✓ {language === 'es' ? 'Activo' : 'Active'}</div>}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                {t('settings.language')}
              </label>
              <select
                value={language}
                onChange={e => setLanguage(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500">
                {LANGUAGES.map(l => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </select>
            </div>

            <div className="bg-slate-800 rounded-xl p-4 text-sm text-slate-400">
              <p className="font-semibold text-white mb-1">ℹ️ {language === 'es' ? 'Preferencias personales' : 'Personal preferences'}</p>
              <p>{t('settings.languageNote')}</p>
            </div>
          </>
        )}

        {/* GENERAL */}
        {activeTab === 'general' && (
          <>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">{t('settings.logo')}</label>
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 bg-slate-800 border border-slate-700 rounded-xl flex items-center justify-center overflow-hidden">
                  {currentValue('logo') ? (
                    <img src={currentValue('logo')} alt="Logo" className="w-full h-full object-contain" />
                  ) : (
                    <span className="text-slate-500 text-2xl">🏢</span>
                  )}
                </div>
                <div>
                  <button onClick={() => fileRef.current?.click()}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm transition-colors">
                    {t('settings.uploadLogo')}
                  </button>
                  {currentValue('logo') && (
                    <button onClick={() => setForm({...form, logo: ''})}
                      className="ml-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-sm transition-colors">
                      {t('settings.deleteLogo')}
                    </button>
                  )}
                  <p className="text-xs text-slate-500 mt-1">PNG, JPG {language === 'es' ? 'o' : 'or'} SVG. {language === 'es' ? 'Máx' : 'Max'} 2MB.</p>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogo} />
                </div>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{t('settings.companyName')} *</label>
              <input value={currentValue('name')} onChange={f('name')}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{t('settings.contactEmail')}</label>
                <input type="email" value={currentValue('email')} onChange={f('email')}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{t('common.phone')}</label>
                <input value={currentValue('phone')} onChange={f('phone')}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{t('common.address')}</label>
              <textarea value={currentValue('address')} onChange={f('address')} rows={2}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500 resize-none" />
            </div>
          </>
        )}

        {/* FISCAL */}
        {activeTab === 'fiscal' && (
          <>
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{t('settings.nif')}</label>
              <input value={currentValue('nif')} onChange={f('nif')}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500" />
            </div>
            <div className="bg-slate-800 rounded-xl p-4 text-sm text-slate-400">
              <p className="font-semibold text-white mb-1">ℹ️ {language === 'es' ? 'Datos fiscales' : 'Tax information'}</p>
              <p>{t('settings.fiscalNote')}</p>
            </div>
          </>
        )}

        {/* EMAIL */}
        {activeTab === 'email' && (
          <>
            <div className="bg-slate-800 rounded-xl p-4 text-sm text-slate-400 mb-2">
              <p className="font-semibold text-white mb-1">📧 {t('settings.smtp.title')}</p>
              <p>{language === 'es' ? 'Necesario para enviar contratos por email. Compatible con Gmail, Outlook, Mailgun, etc.' : 'Required to send contracts by email. Compatible with Gmail, Outlook, Mailgun, etc.'}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{t('settings.smtp.host')}</label>
                <input value={currentValue('smtpHost')} onChange={f('smtpHost')} placeholder="smtp.gmail.com"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{t('settings.smtp.port')}</label>
                <input type="number" value={currentValue('smtpPort')} onChange={f('smtpPort')} placeholder="587"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{t('settings.smtp.user')}</label>
                <input value={currentValue('smtpUser')} onChange={f('smtpUser')} placeholder="tu@email.com"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  {t('settings.smtp.pass')} {org?.smtpPassSet && <span className="text-emerald-400 font-normal">{t('settings.smtp.saved')}</span>}
                </label>
                <input type="password" value={smtpPass} onChange={e => setSmtpPass(e.target.value)}
                  placeholder={org?.smtpPassSet ? '••••••••' : t('settings.smtp.pass')}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{t('settings.smtp.from')}</label>
                <input value={currentValue('smtpFrom')} onChange={f('smtpFrom')} placeholder="noreply@tuempresa.com"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500" />
              </div>
            </div>

            <div className="border-t border-slate-700 pt-4">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                {language === 'en' ? 'Test email configuration' : 'Probar configuración de email'}
              </label>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={testEmail}
                  onChange={e => setTestEmail(e.target.value)}
                  placeholder={language === 'en' ? 'Send test to...' : 'Enviar prueba a...'}
                  className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
                />
                <button
                  onClick={handleTestSmtp}
                  disabled={!testEmail || testing}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-600 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap">
                  {testing ? '⏳' : '📧'} {language === 'en' ? 'Send test' : 'Enviar prueba'}
                </button>
              </div>
              {testResult && (
                <div className={`mt-3 p-3 rounded-lg text-sm ${testResult.ok ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                  {testResult.ok ? '✅' : '❌'} {testResult.message}
                </div>
              )}
            </div>
          </>
        )}


        {/* SES HOSPEDAJES */}
        {activeTab === 'ses' && (
          <>
            <div className="bg-slate-800 rounded-xl p-4 text-sm text-slate-400 mb-2">
              <p className="font-semibold text-white mb-1">🚔 SES Hospedajes — Webservice</p>
              <p>{language === 'es'
                ? 'Credenciales para el envío automático de partes de viajeros al Ministerio del Interior (Real Decreto 933/2021).'
                : 'Credentials for automatic traveller report submission to the Spanish Ministry of Interior.'}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Usuario WS</label>
                <input value={currentValue('sesUsuarioWs')} onChange={f('sesUsuarioWs')}
                  placeholder="12345678AWS"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500" />
                <p className="text-xs text-slate-500 mt-1">Tu NIF/CIF terminado en WS</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Contraseña WS</label>
                <input type="password" value={currentValue('sesPasswordWs')} onChange={f('sesPasswordWs')}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Código Arrendador</label>
                <input value={currentValue('sesCodigoArrendador')} onChange={f('sesCodigoArrendador')}
                  placeholder="0000000001"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500" />
                <p className="text-xs text-slate-500 mt-1">Asignado al registrarte en SES</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Código Establecimiento</label>
                <input value={currentValue('sesCodigoEstablecimiento')} onChange={f('sesCodigoEstablecimiento')}
                  placeholder="0000000002"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500" />
                <p className="text-xs text-slate-500 mt-1">Código del alojamiento en SES</p>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Endpoint</label>
                <input value={currentValue('sesEndpoint')} onChange={f('sesEndpoint')}
                  placeholder="https://hospedajes.ses.mir.es/hospedajes-web/ws/v1/comunicacion"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500" />
                <p className="text-xs text-slate-500 mt-1">
                  Producción: hospedajes.ses.mir.es · Pruebas: hospedajes.pre-ses.mir.es
                </p>
              </div>
            </div>
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-sm text-amber-400">
              <p className="font-semibold mb-1">⚠️ {language === 'es' ? 'Importante' : 'Important'}</p>
              <p>{language === 'es'
                ? 'Las credenciales se guardan cifradas. El código de establecimiento por defecto se puede sobrescribir por propiedad en la configuración de cada alojamiento.'
                : 'Credentials are stored encrypted. The default establishment code can be overridden per property in each accommodation settings.'}</p>
            </div>
          </>
        )}

        {/* PREFERENCES */
        {activeTab === 'preferences' && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{t('settings.currency')}</label>
                <select value={currentValue('currency')} onChange={f('currency')}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500">
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{t('settings.dateFormat')}</label>
                <select value={currentValue('dateFormat')} onChange={f('dateFormat')}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500">
                  {DATE_FORMATS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>
            <div className="bg-slate-800 rounded-xl p-4">
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-3">{language === 'es' ? 'Vista previa' : 'Preview'}</p>
              <div className="flex gap-6 text-sm">
                <div>
                  <span className="text-slate-500">{language === 'es' ? 'Precio: ' : 'Price: '}</span>
                  <span className="font-semibold">1.320 {currentValue('currency') || 'EUR'}</span>
                </div>
                <div>
                  <span className="text-slate-500">{language === 'es' ? 'Fecha: ' : 'Date: '}</span>
                  <span className="font-semibold">
                    {currentValue('dateFormat') === 'yyyy-MM-dd' ? '2026-04-01' :
                     currentValue('dateFormat') === 'MM/dd/yyyy' ? '04/01/2026' : '01/04/2026'}
                  </span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
