import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { useUserPreferences } from '../context/UserPreferencesContext';
import ContentEditor from '../components/ContentEditor';
import { inputCls, labelCls, BTN_PRIMARY } from '../lib/ui';

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
  const [activeTab, setActiveTab] = useState<'usuario'|'general'|'fiscal'|'email'|'ses'|'paperless'|'preferences'|'contenido'>('usuario');
  const [smtpPass, setSmtpPass] = useState('');
  const [testEmail, setTestEmail] = useState('');
  const [testResult, setTestResult] = useState<{ok: boolean; message: string} | null>(null);
  const [testing, setTesting] = useState(false);
  const [sesTestResult, setSesTestResult] = useState<{ok: boolean; message: string} | null>(null);
  const [sesTesting, setSesTesting] = useState(false);
  const [paperlessTestResult, setPaperlessTestResult] = useState<{ok: boolean; message: string} | null>(null);
  const [paperlessTesting, setPaperlessTesting] = useState(false);
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

  const handleTestSes = async () => {
    setSesTesting(true);
    setSesTestResult(null);
    try {
      const res = await api.post('/organization/test-ses');
      setSesTestResult({ ok: res.data.ok, message: res.data.message });
    } catch (err: any) {
      setSesTestResult({ ok: false, message: err.response?.data?.message || 'Error desconocido' });
    } finally {
      setSesTesting(false);
    }
  };

  const handleTestPaperless = async () => {
    setPaperlessTesting(true);
    setPaperlessTestResult(null);
    try {
      const res = await api.post('/organization/test-paperless');
      setPaperlessTestResult({ ok: res.data.ok, message: res.data.message });
    } catch (err: any) {
      setPaperlessTestResult({ ok: false, message: err.response?.data?.message || 'Error desconocido' });
    } finally {
      setPaperlessTesting(false);
    }
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
    { id: 'paperless',   label: '📦 Paperless' },
    { id: 'contenido',   label: '📄 Contenido' },
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
            className={BTN_PRIMARY}>
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
                className={inputCls}>
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
              <label className={labelCls}>{t('settings.companyName')} *</label>
              <input value={currentValue('name')} onChange={f('name')}
                className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>{t('settings.contactEmail')}</label>
                <input type="email" value={currentValue('email')} onChange={f('email')}
                  className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>{t('common.phone')}</label>
                <input value={currentValue('phone')} onChange={f('phone')}
                  className={inputCls} />
              </div>
            </div>
            <div>
              <label className={labelCls}>{t('common.address')}</label>
              <textarea value={currentValue('address')} onChange={f('address')} rows={2}
                className={`${inputCls} resize-none`} />
            </div>
            <div>
              <label className={labelCls}>{language === 'es' ? 'URL pública del CRM' : 'CRM public URL'}</label>
              <input type="url" value={currentValue('publicUrl')} onChange={f('publicUrl')}
                placeholder="https://crm.greywoodhome.es"
                className={inputCls} />
              <p className="text-xs text-slate-500 mt-1">
                {language === 'es'
                  ? 'Se usa para generar los enlaces de exportación iCal. Si está vacío se usa el dominio actual.'
                  : 'Used to generate iCal export links. If empty, the current domain is used.'}
              </p>
            </div>
            <div>
              <label className={labelCls}>{language === 'es' ? 'URL pública' : 'Public base URL'}</label>
              <input type="url" value={currentValue('publicBaseUrl')} onChange={f('publicBaseUrl')}
                placeholder="https://crm.greywoodhome.es"
                className={inputCls} />
              <p className="text-xs text-slate-500 mt-1">
                {language === 'es'
                  ? 'Dominio público para enlaces de checkin, contratos e iCal. Ej: https://crm.greywoodhome.es. Si está vacío se usa FRONTEND_URL del servidor.'
                  : 'Public domain for checkin, contract and iCal links. E.g. https://crm.greywoodhome.es. If empty, the server FRONTEND_URL is used.'}
              </p>
            </div>
          </>
        )}

        {/* FISCAL */}
        {activeTab === 'fiscal' && (
          <>
            <div>
              <label className={labelCls}>{t('settings.nif')}</label>
              <input value={currentValue('nif')} onChange={f('nif')}
                className={inputCls} />
            </div>
            <div className="bg-slate-800 rounded-xl p-4 text-sm text-slate-400">
              <p className="font-semibold text-white mb-1">ℹ️ {language === 'es' ? 'Datos fiscales' : 'Tax information'}</p>
              <p>{t('settings.fiscalNote')}</p>
            </div>
            <div className="mt-2">
              <p className="text-sm font-semibold text-slate-300 mb-3">{language === 'es' ? 'Datos bancarios' : 'Bank details'}</p>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className={labelCls}>Swift / BIC</label>
                  <input value={currentValue('bankSwift')} onChange={f('bankSwift')} placeholder="Ej: CAIXESBBXXX" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>IBAN</label>
                  <input value={currentValue('bankIban')} onChange={f('bankIban')} placeholder="Ej: ES91 2100 0418 4502 0005 1332" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>{language === 'es' ? 'Beneficiario' : 'Beneficiary'}</label>
                  <input value={currentValue('bankBeneficiary')} onChange={f('bankBeneficiary')} placeholder={language === 'es' ? 'Nombre del titular de la cuenta' : 'Account holder name'} className={inputCls} />
                </div>
              </div>
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
                <label className={labelCls}>{t('settings.smtp.host')}</label>
                <input value={currentValue('smtpHost')} onChange={f('smtpHost')} placeholder="smtp.gmail.com"
                  className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>{t('settings.smtp.port')}</label>
                <input type="number" value={currentValue('smtpPort')} onChange={f('smtpPort')} placeholder="587"
                  className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>{t('settings.smtp.user')}</label>
                <input value={currentValue('smtpUser')} onChange={f('smtpUser')} placeholder="tu@email.com"
                  className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>
                  {t('settings.smtp.pass')} {org?.smtpPassSet && <span className="text-emerald-400 font-normal">{t('settings.smtp.saved')}</span>}
                </label>
                <input type="password" value={smtpPass} onChange={e => setSmtpPass(e.target.value)}
                  placeholder={org?.smtpPassSet ? '••••••••' : t('settings.smtp.pass')}
                  className={inputCls} />
              </div>
              <div className="col-span-2">
                <label className={labelCls}>{t('settings.smtp.from')}</label>
                <input value={currentValue('smtpFrom')} onChange={f('smtpFrom')} placeholder="noreply@tuempresa.com"
                  className={inputCls} />
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
                  className={`flex-1 ${inputCls}`}
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
                <label className={labelCls}>Usuario WS</label>
                <input value={currentValue('sesUsuarioWs')} onChange={f('sesUsuarioWs')}
                  placeholder="12345678AWS"
                  className={inputCls} />
                <p className="text-xs text-slate-500 mt-1">Tu NIF/CIF terminado en WS</p>
              </div>
              <div>
                <label className={labelCls}>Contraseña WS</label>
                <input type="password" value={currentValue('sesPasswordWs')} onChange={f('sesPasswordWs')}
                  placeholder="••••••••"
                  className={inputCls} />
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Código Arrendador</label>
                <input value={currentValue('sesCodigoArrendador')} onChange={f('sesCodigoArrendador')}
                  placeholder="0000000001"
                  className={inputCls} />
                <p className="text-xs text-slate-500 mt-1">Asignado al registrarte en SES</p>
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Entorno</label>
                <select value={currentValue('sesEntorno')} onChange={f('sesEntorno')}
                  className={inputCls}>
                  <option value="">— Seleccionar —</option>
                  <option value="produccion">🟢 Producción — hospedajes.ses.mir.es</option>
                  <option value="pruebas">🧪 Pruebas — hospedajes.pre-ses.mir.es</option>
                </select>
                <p className="text-xs text-slate-500 mt-1">Usa «Pruebas» hasta obtener el alta definitiva en el Ministerio</p>
              </div>
            </div>
            <div className="border-t border-slate-700 pt-4">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                {language === 'es' ? 'Probar conexión con el Ministerio' : 'Test connection to Ministry'}
              </label>
              <button
                onClick={handleTestSes}
                disabled={!currentValue('sesEntorno') || !currentValue('sesUsuarioWs') || sesTesting}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-600 rounded-lg text-sm font-semibold transition-colors">
                {sesTesting ? '⏳' : '🔌'} {language === 'es' ? 'Probar conexión SES' : 'Test SES connection'}
              </button>
              {sesTestResult && (
                <div className={`mt-3 p-3 rounded-lg text-sm ${sesTestResult.ok ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                  {sesTestResult.ok ? '✅' : '❌'} {sesTestResult.message}
                </div>
              )}
            </div>

            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-sm text-amber-400">
              <p className="font-semibold mb-1">⚠️ {language === 'es' ? 'Importante' : 'Important'}</p>
              <p>{language === 'es'
                ? 'Las credenciales se guardan cifradas. El código de establecimiento se configura por propiedad en la ficha de cada alojamiento.'
                : 'Credentials are stored encrypted. The establishment code is configured per property in each accommodation settings.'}</p>
            </div>
          </>
        )}

        {/* PAPERLESS */}
        {activeTab === 'paperless' && (
          <>
            <div className="bg-slate-800 rounded-xl p-4 text-sm text-slate-400 mb-2">
              <p className="font-semibold text-white mb-1">📦 Paperless-ngx — Gestión documental</p>
              <p>{language === 'es'
                ? 'Los contratos firmados se subirán automáticamente a tu instancia de Paperless-ngx.'
                : 'Signed contracts will be automatically uploaded to your Paperless-ngx instance.'}</p>
            </div>
            <div>
              <label className={labelCls}>
                URL de Paperless-ngx
              </label>
              <input
                value={currentValue('paperlessUrl')}
                onChange={f('paperlessUrl')}
                placeholder="http://192.168.1.50:8000"
                className={inputCls}
              />
              <p className="text-xs text-slate-500 mt-1">
                {language === 'es' ? 'URL base de tu servidor Paperless (sin slash final)' : 'Base URL of your Paperless server (no trailing slash)'}
              </p>
            </div>
            <div>
              <label className={labelCls}>
                API Token {org?.paperlessTokenSet && <span className="text-emerald-400 font-normal">✓ guardado</span>}
              </label>
              <input
                type="password"
                value={currentValue('paperlessToken')}
                onChange={f('paperlessToken')}
                placeholder={org?.paperlessTokenSet ? '••••••••' : 'Token de la API de Paperless-ngx'}
                className={inputCls}
              />
              <p className="text-xs text-slate-500 mt-1">
                {language === 'es'
                  ? 'Perfil → API Token en tu Paperless-ngx'
                  : 'Profile → API Token in your Paperless-ngx'}
              </p>
            </div>
            <div>
              <label className={labelCls}>
                Document Type ID
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={currentValue('paperlessDocTypeId')}
                onChange={f('paperlessDocTypeId')}
                placeholder="ID numérico del tipo de documento en Paperless-ngx"
                className={inputCls}
              />
              <p className="text-xs text-slate-500 mt-1">
                {language === 'es'
                  ? 'ID del tipo de documento para clasificar contratos (opcional). Paperless-ngx → Ajustes → Tipos de documento.'
                  : 'Document type ID to classify contracts (optional). Paperless-ngx → Settings → Document Types.'}
              </p>
            </div>
            <div>
              <label className={labelCls}>
                Secret webhook
              </label>
              <input
                type="password"
                value={currentValue('paperlessSecret')}
                onChange={f('paperlessSecret')}
                placeholder="Clave secreta para validar webhooks"
                className={inputCls}
              />
              <p className="text-xs text-slate-500 mt-1">
                {language === 'es'
                  ? 'Clave secreta para autenticar los webhooks entrantes de Paperless-ngx'
                  : 'Secret key to authenticate incoming webhooks from Paperless-ngx'}
              </p>
            </div>
            <div>
              <label className={labelCls}>
                URL Webhook
              </label>
              <input
                readOnly
                value={`${window.location.origin}/api/paperless/webhook`}
                className={inputCls + ' cursor-text select-all'}
              />
              <p className="text-xs text-slate-500 mt-1">
                {language === 'es'
                  ? 'Configura esta URL en Paperless-ngx → Ajustes → Webhooks'
                  : 'Configure this URL in Paperless-ngx → Settings → Webhooks'}
              </p>
            </div>
            <div className="border-t border-slate-700 pt-4">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                {language === 'es' ? 'Probar conexión' : 'Test connection'}
              </label>
              <p className="text-xs text-slate-500 mb-3">
                {language === 'es' ? 'Guarda los cambios antes de probar.' : 'Save changes before testing.'}
              </p>
              <button
                onClick={handleTestPaperless}
                disabled={!org?.paperlessUrl || paperlessTesting}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-600 rounded-lg text-sm font-semibold transition-colors">
                {paperlessTesting ? '⏳' : '🔌'} {language === 'es' ? 'Probar conexión' : 'Test connection'}
              </button>
              {paperlessTestResult && (
                <div className={`mt-3 p-3 rounded-lg text-sm ${paperlessTestResult.ok ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                  {paperlessTestResult.ok ? '✅' : '❌'} {paperlessTestResult.message}
                </div>
              )}
            </div>
          </>
        )}

        {/* CONTENIDO GLOBAL */}
        {activeTab === 'contenido' && (
          <ContentEditor propertyId={undefined} />
        )}

        {/* PREFERENCES */}
        {activeTab === 'preferences' && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>{t('settings.currency')}</label>
                <select value={currentValue('currency')} onChange={f('currency')}
                  className={inputCls}>
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>{t('settings.dateFormat')}</label>
                <select value={currentValue('dateFormat')} onChange={f('dateFormat')}
                  className={inputCls}>
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
