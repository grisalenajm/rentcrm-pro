import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { BTN_PRIMARY, BTN_SECONDARY, platformBadgeColor } from '../lib/ui';

interface Feed {
  id: string;
  propertyId: string;
  icalUrl: string;
  platform: string;
  lastSyncAt: string | null;
  lastSyncStatus: string;
  eventCount: number;
}

export default function ICalFeeds() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [feedsLoading, setFeedsLoading] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<{ feedId: string; imported: number; skipped: number; total: number } | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ url: '', platform: 'airbnb' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [exportUrl, setExportUrl] = useState('');

  const { data: property, isLoading: propertyLoading } = useQuery({
    queryKey: ['property', id],
    queryFn: () => api.get(`/properties/${id}`).then(r => r.data),
    enabled: !!id,
  });

  useQuery({
    queryKey: ['ical-feeds-page', id],
    queryFn: async () => {
      setFeedsLoading(true);
      try {
        const [feedsRes, urlRes] = await Promise.all([
          api.get('/ical/feeds'),
          api.get(`/ical/export-url/${id}`),
        ]);
        setFeeds((feedsRes.data as Feed[]).filter((f: Feed) => f.propertyId === id));
        setExportUrl(urlRes.data.url);
      } finally {
        setFeedsLoading(false);
      }
      return null;
    },
    enabled: !!id,
  });

  const reloadFeeds = async () => {
    setFeedsLoading(true);
    try {
      const res = await api.get('/ical/feeds');
      setFeeds((res.data as Feed[]).filter((f: Feed) => f.propertyId === id));
    } finally {
      setFeedsLoading(false);
    }
  };

  const relativeTime = (dateStr: string | null): string => {
    if (!dateStr) return t('properties.ical.neverSynced');
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 2) return t('properties.ical.justNow');
    if (mins < 60) return t('properties.ical.minutesAgo', { count: mins });
    const hours = Math.floor(mins / 60);
    if (hours < 24) return t('properties.ical.hoursAgo', { count: hours });
    const days = Math.floor(hours / 24);
    return t('properties.ical.daysAgo', { count: days });
  };

  const copyToClipboard = (text: string) => {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).catch(() => {});
    } else {
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
  };

  const handleAddFeed = async () => {
    if (!form.url) { setError(t('properties.ical.errorRequired')); return; }
    setSaving(true);
    setError('');
    try {
      await api.post('/ical/feeds', { propertyId: id, url: form.url, platform: form.platform });
      setShowAdd(false);
      setForm({ url: '', platform: 'airbnb' });
      await reloadFeeds();
    } catch (e: any) {
      setError(e.response?.data?.message || t('properties.ical.errorSave'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteFeed = async (feedId: string) => {
    if (!confirm(t('properties.ical.confirmDelete'))) return;
    await api.delete(`/ical/feeds/${feedId}`);
    await reloadFeeds();
  };

  const handleSyncFeed = async (feedId: string) => {
    setSyncing(feedId);
    setSyncResult(null);
    try {
      const res = await api.post(`/ical/feeds/${feedId}/sync`);
      setSyncResult({ feedId, ...res.data });
    } catch (e: any) {
      alert(e.response?.data?.message || t('properties.ical.errorSync'));
    } finally {
      setSyncing(null);
    }
  };

  if (propertyLoading) {
    return <div className="p-6 text-slate-400">{t('common.loading')}</div>;
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <button
            onClick={() => navigate(`/properties/${id}`)}
            className="text-sm text-slate-400 hover:text-white transition-colors mb-2 block">
            {t('common.back')}
          </button>
          <h1 className="text-2xl font-bold">{t('properties.ical.sectionTitle')}</h1>
          {property && <p className="text-slate-400 text-sm mt-1">{property.name}</p>}
        </div>
        <button
          onClick={() => { setShowAdd(true); setError(''); }}
          className={BTN_PRIMARY}>
          + {t('properties.ical.addFeed')}
        </button>
      </div>

      {/* Export URL */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-4">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
          {t('properties.ical.exportUrl')}
        </p>
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={exportUrl}
            className="text-xs text-emerald-400 bg-slate-800 px-3 py-2 rounded-lg w-full min-w-0 outline-none cursor-text select-all"
            onFocus={(e) => e.target.select()}
          />
          <button
            onClick={() => {
              copyToClipboard(exportUrl);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className="text-xs text-slate-400 hover:text-white px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors shrink-0 whitespace-nowrap">
            {copied ? `✅ ${t('properties.ical.copied')}` : `📋 ${t('properties.ical.copy')}`}
          </button>
        </div>
      </div>

      {/* Add feed form */}
      {showAdd && (
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 space-y-3 mb-4">
          <h3 className="text-sm font-bold">{t('properties.ical.addFeedTitle')}</h3>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
              {t('properties.ical.platform')}
            </label>
            <select
              value={form.platform}
              onChange={(e) => setForm({ ...form, platform: e.target.value })}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500">
              <option value="airbnb">Airbnb</option>
              <option value="booking">Booking.com</option>
              <option value="other">{t('properties.ical.other')}</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
              {t('properties.ical.icalUrl')}
            </label>
            <input
              type="url"
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              placeholder="https://www.airbnb.com/calendar/ical/..."
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
            />
            <p className="text-xs text-slate-500 mt-1">{t('properties.ical.icalUrlHint')}</p>
          </div>
          {error && (
            <p className="text-sm text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">{error}</p>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => { setShowAdd(false); setError(''); }}
              className={`flex-1 ${BTN_SECONDARY}`}>
              {t('properties.ical.cancel')}
            </button>
            <button
              onClick={handleAddFeed}
              disabled={saving}
              className={`flex-1 ${BTN_PRIMARY}`}>
              {saving ? t('properties.ical.saving') : t('properties.ical.save')}
            </button>
          </div>
        </div>
      )}

      {/* Feed list */}
      {feedsLoading ? (
        <div className="text-slate-400 text-center py-12">{t('properties.ical.loading')}</div>
      ) : feeds.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-slate-800 rounded-2xl">
          <div className="text-4xl mb-3">📅</div>
          <p className="text-slate-400 text-sm">{t('properties.ical.noFeeds')}</p>
          <p className="text-slate-500 text-xs mt-1">{t('properties.ical.noFeedsHint')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {feeds.map((feed) => (
            <div key={feed.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${platformBadgeColor(feed.platform)}`}>
                      {feed.platform.toUpperCase()}
                    </span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">
                      {t('properties.ical.eventCount', { count: feed.eventCount ?? 0 })}
                    </span>
                    <span className="text-xs text-slate-500">{relativeTime(feed.lastSyncAt)}</span>
                  </div>
                  <p className="text-xs text-slate-400 truncate">{feed.icalUrl}</p>
                  {syncResult?.feedId === feed.id && (
                    <div className="mt-2 text-xs bg-emerald-500/10 text-emerald-400 rounded-lg px-3 py-2">
                      ✅ {t('properties.ical.syncResult', { imported: syncResult.imported, skipped: syncResult.skipped, total: syncResult.total })}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleSyncFeed(feed.id)}
                    disabled={syncing === feed.id}
                    className="text-xs bg-slate-800 hover:bg-slate-700 text-blue-400 px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50">
                    {syncing === feed.id ? '⏳' : '🔄'} {t('properties.ical.sync')}
                  </button>
                  <button
                    onClick={() => handleDeleteFeed(feed.id)}
                    className="text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 px-3 py-1.5 rounded-lg font-medium transition-colors">
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
