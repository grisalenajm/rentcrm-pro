import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { useTranslation } from 'react-i18next';

type OtpSetupData = { secret: string; qrCode: string; otpauthUrl: string };

export default function Profile() {
  const { user } = useAuth();
  const { t } = useTranslation();

  const [otpEnabled, setOtpEnabled] = useState<boolean | null>(null);
  const [loadingOtp, setLoadingOtp] = useState(false);

  // Password change
  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');
    setPwSuccess('');
    if (pwNew.length < 8) { setPwError(t('profile.passwordTooShort')); return; }
    if (pwNew !== pwConfirm) { setPwError(t('profile.passwordMismatch')); return; }
    setPwLoading(true);
    try {
      await api.put('/users/me/password', { currentPassword: pwCurrent, newPassword: pwNew });
      setPwSuccess(t('profile.passwordChanged'));
      setPwCurrent(''); setPwNew(''); setPwConfirm('');
    } catch (e: any) {
      setPwError(e?.response?.data?.message ?? 'Error al cambiar la contraseña');
    } finally {
      setPwLoading(false);
    }
  };

  // Setup flow
  const [setupData, setSetupData] = useState<OtpSetupData | null>(null);
  const [setupCode, setSetupCode] = useState('');
  const [setupError, setSetupError] = useState('');

  // Disable flow
  const [showDisableConfirm, setShowDisableConfirm] = useState(false);
  const [disableCode, setDisableCode] = useState('');
  const [disableError, setDisableError] = useState('');

  // Cargar estado 2FA del usuario
  useEffect(() => {
    api.get('/users/me').then(({ data }) => {
      setOtpEnabled(data.otpEnabled ?? false);
    });
  }, []);

  const handleSetup = async () => {
    setLoadingOtp(true);
    setSetupError('');
    try {
      const { data } = await api.post('/users/otp/setup');
      setSetupData(data);
    } catch (e: any) {
      setSetupError(e?.response?.data?.message ?? 'Error al iniciar configuración');
    } finally {
      setLoadingOtp(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingOtp(true);
    setSetupError('');
    try {
      await api.post('/users/otp/verify', { token: setupCode });
      setOtpEnabled(true);
      setSetupData(null);
      setSetupCode('');
    } catch (e: any) {
      setSetupError(e?.response?.data?.message ?? 'Código incorrecto');
      setSetupCode('');
    } finally {
      setLoadingOtp(false);
    }
  };

  const handleDisable = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingOtp(true);
    setDisableError('');
    try {
      await api.post('/users/otp/disable', { token: disableCode });
      setOtpEnabled(false);
      setShowDisableConfirm(false);
      setDisableCode('');
    } catch (e: any) {
      setDisableError(e?.response?.data?.message ?? 'Código incorrecto');
      setDisableCode('');
    } finally {
      setLoadingOtp(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">{t('profile.title')}</h1>

      {/* Datos básicos */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 mb-6">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">{t('profile.info')}</h2>
        <div className="space-y-3">
          <div>
            <span className="text-xs text-slate-500">Nombre</span>
            <p className="text-white font-medium">{user?.name}</p>
          </div>
          <div>
            <span className="text-xs text-slate-500">Email</span>
            <p className="text-white">{user?.email}</p>
          </div>
          <div>
            <span className="text-xs text-slate-500">Rol</span>
            <p className="text-white capitalize">{user?.role}</p>
          </div>
        </div>
      </div>

      {/* Cambiar contraseña */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 mb-6">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">{t('profile.changePassword')}</h2>
        <form onSubmit={handleChangePassword} className="space-y-4">
          {pwSuccess && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 text-sm">
              {pwSuccess}
            </div>
          )}
          {pwError && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {pwError}
            </div>
          )}
          <div>
            <label className="block text-xs text-slate-400 mb-1">{t('profile.currentPassword')}</label>
            <input
              type="password"
              value={pwCurrent}
              onChange={e => setPwCurrent(e.target.value)}
              required
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">{t('profile.newPassword')}</label>
            <input
              type="password"
              value={pwNew}
              onChange={e => setPwNew(e.target.value)}
              required
              minLength={8}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">{t('profile.confirmPassword')}</label>
            <input
              type="password"
              value={pwConfirm}
              onChange={e => setPwConfirm(e.target.value)}
              required
              minLength={8}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>
          <button
            type="submit"
            disabled={pwLoading || !pwCurrent || !pwNew || !pwConfirm}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {pwLoading ? t('profile.saving') : t('profile.save')}
          </button>
        </form>
      </div>

      {/* Seguridad — 2FA */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">{t('profile.security')}</h2>

        {otpEnabled === null ? (
          <p className="text-slate-500 text-sm">Cargando...</p>
        ) : otpEnabled ? (
          /* 2FA activado */
          <>
            {!showDisableConfirm ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-emerald-600/20 rounded-lg flex items-center justify-center text-emerald-400">🔐</div>
                  <div>
                    <p className="text-white font-medium text-sm">Autenticación en dos pasos activada</p>
                    <p className="text-slate-500 text-xs">Tu cuenta está protegida con 2FA</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowDisableConfirm(true)}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white text-sm rounded-lg transition-colors"
                >
                  Desactivar
                </button>
              </div>
            ) : (
              <form onSubmit={handleDisable} className="space-y-4">
                <p className="text-slate-300 text-sm">
                  Introduce el código de tu app de autenticación para confirmar la desactivación del 2FA.
                </p>
                {disableError && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                    {disableError}
                  </div>
                )}
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={disableCode}
                  onChange={e => setDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  autoFocus
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm text-center tracking-[0.5em] font-mono focus:outline-none focus:border-red-500 transition-colors"
                />
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => { setShowDisableConfirm(false); setDisableCode(''); setDisableError(''); }}
                    className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded-lg transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={loadingOtp || disableCode.length !== 6}
                    className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-slate-700 text-white text-sm rounded-lg transition-colors"
                  >
                    {loadingOtp ? 'Desactivando...' : 'Confirmar desactivación'}
                  </button>
                </div>
              </form>
            )}
          </>
        ) : (
          /* 2FA desactivado */
          <>
            {!setupData ? (
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-slate-700 rounded-lg flex items-center justify-center text-slate-400 shrink-0">🔓</div>
                  <div>
                    <p className="text-white font-medium text-sm">Autenticación en dos pasos desactivada</p>
                    <p className="text-slate-400 text-xs mt-0.5">
                      Al activar 2FA necesitarás tu app de autenticación cada vez que inicies sesión.
                      Compatible con Google Authenticator, Authy y similares.
                    </p>
                  </div>
                </div>
                {setupError && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                    {setupError}
                  </div>
                )}
                <button
                  onClick={handleSetup}
                  disabled={loadingOtp}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  {loadingOtp ? 'Generando...' : 'Activar autenticación de dos factores'}
                </button>
              </div>
            ) : (
              /* Mostrar QR para escanear */
              <div className="space-y-5">
                <div>
                  <p className="text-white font-medium text-sm mb-1">Paso 1 — Escanea el código QR</p>
                  <p className="text-slate-400 text-xs mb-4">
                    Abre Google Authenticator, Authy o cualquier app TOTP y escanea el código.
                  </p>
                  <div className="flex justify-center">
                    <div className="bg-white p-3 rounded-xl inline-block">
                      <img src={setupData.qrCode} alt="QR 2FA" className="w-48 h-48" />
                    </div>
                  </div>
                  <details className="mt-3">
                    <summary className="text-xs text-slate-500 cursor-pointer hover:text-slate-400">
                      No puedo escanear el código — introducir clave manualmente
                    </summary>
                    <p className="mt-2 text-xs font-mono bg-slate-800 px-3 py-2 rounded-lg text-slate-300 break-all select-all">
                      {setupData.secret}
                    </p>
                  </details>
                </div>

                <form onSubmit={handleVerify} className="space-y-3">
                  <div>
                    <p className="text-white font-medium text-sm mb-1">Paso 2 — Confirma con el primer código</p>
                    <p className="text-slate-400 text-xs mb-3">
                      Introduce el código de 6 dígitos que muestra tu app para confirmar la activación.
                    </p>
                    {setupError && (
                      <div className="mb-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                        {setupError}
                      </div>
                    )}
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      value={setupCode}
                      onChange={e => setSetupCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                      autoFocus
                      className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm text-center tracking-[0.5em] font-mono focus:outline-none focus:border-emerald-500 transition-colors"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => { setSetupData(null); setSetupCode(''); setSetupError(''); }}
                      className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded-lg transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={loadingOtp || setupCode.length !== 6}
                      className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-700 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      {loadingOtp ? 'Activando...' : 'Activar 2FA'}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
