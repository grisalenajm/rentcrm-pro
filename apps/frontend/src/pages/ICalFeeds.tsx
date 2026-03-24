import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';

interface Feed {
  id: string;
  propertyId: string;
  icalUrl: string;
  platform: string;
  lastSyncAt: string | null;
  lastSyncStatus: string;
  property: { id: string; name: string };
}

interface Property {
  id: string;
  name: string;
}

export default function ICalFeeds() {
  const { t } = useTranslation();
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [publicUrl, setPublicUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<{ feedId: string; imported: number; skipped: number; total: number } | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ propertyId: '', url: '', platform: 'airbnb' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [feedsRes, propsRes, orgRes] = await Promise.all([
        api.get('/ical/feeds'),
        api.get('/properties'),
        api.get('/organization'),
      ]);
      setFeeds(feedsRes.data);
      setProperties(propsRes.data?.data || propsRes.data);
      setPublicUrl(orgRes.data?.publicUrl || window.location.origin);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    if (!form.propertyId || !form.url) { setError(t('ical.errorRequired')); return; }
    setSaving(true);
    setError('');
    try {
      await api.post('/ical/feeds', form);
      setShowModal(false);
      setForm({ propertyId: '', url: '', platform: 'airbnb' });
      load();
    } catch (e: any) {
      setError(e.response?.data?.message || t('ical.errorSave'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('ical.confirmDelete'))) return;
    await api.delete(`/ical/feeds/${id}`);
    load();
  };

  const handleSync = async (id: string) => {
    setSyncing(id);
    setSyncResult(null);
    try {
      const res = await api.post(`/ical/feeds/${id}/sync`);
      setSyncResult({ feedId: id, ...res.data });
    } catch (e: any) {
      alert(e.response?.data?.message || t('ical.errorSync'));
    } finally {
      setSyncing(null);
    }
  };

  const platformBadge = (platform: string) => {
    const colors: Record<string, string> = {
      airbnb: 'bg-rose-100 text-rose-700',
      booking: 'bg-blue-100 text-blue-700',
      other: 'bg-gray-100 text-gray-600',
    };
    return colors[platform] || colors.other;
  };

  const exportUrl = (propertyId: string) =>
    `${publicUrl}/api/ical/export/${propertyId}`;

  const handleCopy = async (text: string, id: string) => {
    let success = false;

    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        success = true;
      } catch { /* fall through */ }
    }

    if (!success) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      try { success = document.execCommand('copy'); } catch { /* fall through */ }
      document.body.removeChild(ta);
    }

    if (success) {
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    } else {
      window.prompt('Copia la URL manualmente:', text);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('ical.title')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('ical.subtitle')}</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
        >
          + {t('ical.addFeed')}
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">{t('ical.loading')}</div>
      ) : feeds.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
          <div className="text-4xl mb-3">📅</div>
          <p className="text-gray-500 dark:text-gray-400">{t('ical.noFeeds')}</p>
          <p className="text-sm text-gray-400 mt-1">{t('ical.noFeedsHint')}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {feeds.map((feed) => (
            <div key={feed.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${platformBadge(feed.platform)}`}>
                      {feed.platform.toUpperCase()}
                    </span>
                    <span className="font-medium text-gray-900 dark:text-white">{feed.property.name}</span>
                  </div>
                  <p className="text-xs text-gray-400 truncate">{feed.icalUrl}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {feed.lastSyncAt
                      ? `${t('ical.lastSync')}: ${new Date(feed.lastSyncAt).toLocaleString()}`
                      : t('ical.neverSynced')}
                  </p>
                  {syncResult?.feedId === feed.id && (
                    <div className="mt-2 text-xs bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-lg px-3 py-2">
                      ✅ {t('ical.syncResult', { imported: syncResult.imported, skipped: syncResult.skipped, total: syncResult.total })}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleSync(feed.id)}
                    disabled={syncing === feed.id}
                    className="text-xs bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-3 py-1.5 rounded-lg font-medium transition disabled:opacity-50"
                  >
                    {syncing === feed.id ? '⏳' : '🔄'} {t('ical.sync')}
                  </button>
                  <button
                    onClick={() => handleDelete(feed.id)}
                    className="text-xs bg-red-50 hover:bg-red-100 dark:bg-red-900/30 text-red-600 px-3 py-1.5 rounded-lg font-medium transition"
                  >
                    🗑️
                  </button>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                <p className="text-xs text-gray-400 mb-1">{t('ical.exportUrl')}:</p>
                <div className="flex items-center gap-2">
                  <code className="text-xs bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-300 px-2 py-1 rounded truncate flex-1">
                    {exportUrl(feed.propertyId)}
                  </code>
                  <button
                    onClick={() => handleCopy(exportUrl(feed.propertyId), feed.propertyId)}
                    className="text-xs text-blue-500 hover:text-blue-700 shrink-0 transition"
                  >
                    {copied === feed.propertyId ? '✅' : '📋'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">{t('ical.addFeedTitle')}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('ical.platform')}</label>
                <select
                  value={form.platform}
                  onChange={(e) => setForm({ ...form, platform: e.target.value })}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white"
                >
                  <option value="airbnb">Airbnb</option>
                  <option value="booking">Booking.com</option>
                  <option value="other">{t('ical.other')}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('ical.property')}</label>
                <select
                  value={form.propertyId}
                  onChange={(e) => setForm({ ...form, propertyId: e.target.value })}
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white"
                >
                  <option value="">{t('ical.selectProperty')}</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('ical.icalUrl')}</label>
                <input
                  type="url"
                  value={form.url}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                  placeholder="https://www.airbnb.com/calendar/ical/..."
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 dark:text-white"
                />
                <p className="text-xs text-gray-400 mt-1">{t('ical.icalUrlHint')}</p>
              </div>
              {error && (
                <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{error}</p>
              )}
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setShowModal(false); setError(''); }}
                className="flex-1 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition"
              >
                {t('ical.cancel')}
              </button>
              <button
                onClick={handleAdd}
                disabled={saving}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50"
              >
                {saving ? t('ical.saving') : t('ical.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
