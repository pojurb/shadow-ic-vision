'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from './ChatUI.module.css';
import { TopTenQueue } from './TopTenQueue';

interface Conversation {
  id: string;
  title: string;
}

interface PortfolioPosition {
  id: string;
  ticker: string;
  market: 'US' | 'ID';
  status: 'owned' | 'watchlist';
  thesisId: string | null;
  thesisTitle: string | null;
}

interface Thesis {
  id: string;
  title: string;
  ticker: string | null;
}

interface PortfolioAlert {
  id: string;
  positionId: string;
  documentHash: string;
  isRead: boolean;
  createdAt: string;
  ticker: string;
  market: 'US' | 'ID';
  documentId: string;
  sourceUrl: string;
  sourceName: string;
  sourceFormat: string;
  sourceTier: 'official' | 'secondary';
  publishDate: string;
}

export function Sidebar() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [positions, setPositions] = useState<PortfolioPosition[]>([]);
  const [theses, setTheses] = useState<Thesis[]>([]);
  const [alerts, setAlerts] = useState<PortfolioAlert[]>([]);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Modal and form states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPosition, setEditingPosition] = useState<PortfolioPosition | null>(null);
  const [formTicker, setFormTicker] = useState('');
  const [formMarket, setFormMarket] = useState<'US' | 'ID'>('US');
  const [formStatus, setFormStatus] = useState<'owned' | 'watchlist'>('watchlist');
  const [formThesisId, setFormThesisId] = useState<string>('');

  // Sync & Alerts states
  const [isSyncing, setIsSyncing] = useState(false);
  const [portfolioRefreshKey, setPortfolioRefreshKey] = useState(0);
  const [alertsModalOpen, setAlertsModalOpen] = useState(false);
  const [activeAlertPosition, setActiveAlertPosition] = useState<PortfolioPosition | null>(null);

  const loadPortfolio = async () => {
    try {
      const pRes = await fetch('/api/portfolio');
      if (pRes.ok) {
        const pData = await pRes.json();
        setPositions(pData);
      }
      const tRes = await fetch('/api/theses');
      if (tRes.ok) {
        const tData = await tRes.json();
        setTheses(tData);
      }
      const aRes = await fetch('/api/portfolio/alerts');
      if (aRes.ok) {
        const aData = await aRes.json();
        setAlerts(aData);
      }
    } catch {
      setError('Unable to load portfolio.');
    }
  };

  useEffect(() => {
    fetch('/api/conversations')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setConversations(data);
      })
      .catch(() => setError('Unable to load theses.'));

    setTimeout(() => {
      loadPortfolio();
    }, 0);
  }, []);

  useEffect(() => {
    const handleTrackAsset = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) {
        setEditingPosition(null);
        setFormTicker(detail.ticker);
        setFormMarket(detail.market);
        setFormStatus('watchlist');
        setFormThesisId('');
        setModalOpen(true);
      }
    };
    window.addEventListener('jp-invest:track-asset', handleTrackAsset);
    return () => {
      window.removeEventListener('jp-invest:track-asset', handleTrackAsset);
    };
  }, []);

  // Found during live testing (2026-07-30): this component fetches its
  // conversation list once on mount and never refetches — it lives in the
  // root layout and never remounts on /c/[id] navigation. A server-side
  // title update (first message, or thesis confirmation) would otherwise
  // never reach the visible sidebar without a manual page reload.
  useEffect(() => {
    const handleTitleChanged = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) {
        setConversations(prev => prev.map(c => c.id === detail.conversationId ? { ...c, title: detail.title } : c));
      }
    };
    window.addEventListener('jp-invest:conversation-title-changed', handleTitleChanged);
    return () => {
      window.removeEventListener('jp-invest:conversation-title-changed', handleTitleChanged);
    };
  }, []);


  const createNew = async () => {
    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New Thesis' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Unable to create conversation.');
      if (data.id) {
        setConversations(prev => [data, ...prev]);
        router.push(`/c/${data.id}`);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to create conversation.');
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    try {
      const text = await file.text();
      const payload = JSON.parse(text);

      const res = await fetch('/api/theses/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Unable to import thesis.');

      const listRes = await fetch('/api/conversations');
      const listData = await listRes.json();
      if (Array.isArray(listData)) setConversations(listData);

      if (data.conversationId) {
        router.push(`/c/${data.conversationId}`);
      }
      loadPortfolio();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Import failed. Ensure it is a valid thesis JSON package.');
    } finally {
      e.target.value = ''; // Reset file input
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formTicker) {
      setError('Please provide a valid ticker.');
      return;
    }

    try {
      const url = editingPosition ? `/api/portfolio/${editingPosition.id}` : '/api/portfolio';
      const method = editingPosition ? 'PATCH' : 'POST';
      const body = {
        ticker: formTicker,
        market: formMarket,
        status: formStatus,
        thesisId: formThesisId || null,
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Failed to save holding.');
      }

      setModalOpen(false);
      loadPortfolio();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to save holding.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to remove this position?')) return;
    setError(null);
    try {
      const res = await fetch(`/api/portfolio/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Failed to delete holding.');
      }
      loadPortfolio();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to delete holding.');
    }
  };

  const handleSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setError(null);
    try {
      const res = await fetch('/api/research/refresh', { method: 'POST' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Filing synchronization failed.');
      }
      await loadPortfolio();
      setPortfolioRefreshKey(prev => prev + 1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Filing synchronization failed.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDismissAlert = async (alertId: string) => {
    try {
      const res = await fetch(`/api/portfolio/alerts/${alertId}`, {
        method: 'PATCH',
      });
      if (res.ok) {
        setAlerts(prev => prev.filter(a => a.id !== alertId));
      }
    } catch (err) {
      console.error('Failed to dismiss alert:', err);
    }
  };

  const handleDismissAllAlerts = async (positionId: string) => {
    try {
      const res = await fetch('/api/portfolio/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ positionId }),
      });
      if (res.ok) {
        setAlerts(prev => prev.filter(a => a.positionId !== positionId));
        setAlertsModalOpen(false);
      }
    } catch (err) {
      console.error('Failed to dismiss all alerts:', err);
    }
  };

  return (
    <aside className={styles.sidebar}>
      <div className={styles.sidebarSection}>
        <div className={styles.sidebarHeader}>
          <h2>Theses</h2>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={createNew} className={styles.newButton}>+ New</button>
            <label className={styles.newButton} style={{ cursor: 'pointer', margin: 0, display: 'flex', alignItems: 'center' }}>
              Import
              <input
                type="file"
                accept=".json"
                onChange={handleImport}
                style={{ display: 'none' }}
              />
            </label>
          </div>
        </div>
        {error && <p className={styles.sidebarError}>{error}</p>}
        <ul className={styles.conversationList}>
          {conversations.map(c => (
            <li key={c.id}>
              <Link href={`/c/${c.id}`} className={styles.conversationLink}>
                {c.title}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <TopTenQueue refreshKey={portfolioRefreshKey} onSelect={(holding) => {
        if (holding.conversationId) {
          router.push(`/c/${holding.conversationId}`);
        } else {
          setEditingPosition({
            id: holding.id,
            ticker: holding.ticker,
            market: holding.market,
            status: holding.status,
            thesisId: holding.thesisId,
            thesisTitle: holding.thesisTitle,
          });
          setFormTicker(holding.ticker);
          setFormMarket(holding.market);
          setFormStatus(holding.status);
          setFormThesisId(holding.thesisId || '');
          setModalOpen(true);
        }
      }} />

      <div className={styles.portfolioSection}>
        <div className={styles.sidebarHeader}>
          <h2>Portfolio</h2>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <Link href="/portfolio" className={styles.syncButton} style={{ textDecoration: 'none' }} title="Full Status Index">
              Index
            </Link>
            <button onClick={handleSync} disabled={isSyncing} className={styles.syncButton} title="Synchronize filings">
              {isSyncing ? '⟳ Syncing...' : '⟳ Sync'}
            </button>
            <button onClick={() => {
              setEditingPosition(null);
              setFormTicker('');
              setFormMarket('US');
              setFormStatus('watchlist');
              setFormThesisId('');
              setModalOpen(true);
            }} className={styles.addHoldingButton}>
              + Add
            </button>
          </div>
        </div>
        <ul className={styles.portfolioList}>
          {positions.length === 0 && (
            <li className={styles.emptyPortfolio}>No holdings tracked.</li>
          )}
          {positions.map(p => {
            const positionAlerts = alerts.filter(a => a.positionId === p.id);
            return (
              <li key={p.id} className={styles.portfolioItem}>
                <div className={styles.portfolioItemRow}>
                  <span className={styles.portfolioTicker}>
                    {p.ticker} <span className={styles.marketBadge}>{p.market}</span>
                    {' '}<span className={styles.marketBadge}>{p.status === 'owned' ? 'Owned' : 'Watchlist'}</span>
                    {positionAlerts.length > 0 && (
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveAlertPosition(p);
                          setAlertsModalOpen(true);
                        }}
                        className={styles.alertBadge}
                        title={`${positionAlerts.length} new filing alert(s)`}
                      >
                        🔔 {positionAlerts.length}
                      </span>
                    )}
                  </span>
                  <div className={styles.portfolioItemActions}>
                    <button onClick={() => {
                      setEditingPosition(p);
                      setFormTicker(p.ticker);
                      setFormMarket(p.market);
                      setFormStatus(p.status);
                      setFormThesisId(p.thesisId || '');
                      setModalOpen(true);
                    }} title="Edit position" className={styles.iconButton}>✎</button>
                    <button onClick={() => handleDelete(p.id)} title="Delete position" className={styles.iconButtonDel}>🗑</button>
                  </div>
                </div>
                {p.thesisId ? (
                  <div className={styles.linkedThesis}>
                    Linked: <span className={styles.thesisTitleBadge}>{p.thesisTitle || 'Untitled'}</span>
                  </div>
                ) : (
                  <div className={styles.unlinkedThesis}>
                    Unlinked (Local)
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {modalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContainer}>
            <div className={styles.modalHeader}>
              <h3>{editingPosition ? 'Edit Holding' : 'Add Holding'}</h3>
              <button onClick={() => setModalOpen(false)} className={styles.closeModal}>×</button>
            </div>
            <form onSubmit={handleSubmit} className={styles.modalForm}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Ticker</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. PLTR"
                  value={formTicker}
                  onChange={e => setFormTicker(e.target.value)}
                  disabled={!!editingPosition}
                  className={styles.modalInput}
                />
              </div>
              <div className={styles.formRow}>
                <div className={styles.formGroup} style={{ flex: 1 }}>
                  <label className={styles.formLabel}>Market</label>
                  <select
                    value={formMarket}
                    onChange={e => setFormMarket(e.target.value as 'US' | 'ID')}
                    disabled={!!editingPosition}
                    className={styles.modalSelect}
                  >
                    <option value="US">US</option>
                    <option value="ID">ID</option>
                  </select>
                </div>
                <div className={styles.formGroup} style={{ flex: 2 }}>
                  <label className={styles.formLabel}>Status</label>
                  <select
                    value={formStatus}
                    onChange={e => setFormStatus(e.target.value as 'owned' | 'watchlist')}
                    className={styles.modalSelect}
                  >
                    <option value="watchlist">Watchlist</option>
                    <option value="owned">Owned</option>
                  </select>
                </div>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Link to Thesis</label>
                <select
                  value={formThesisId}
                  onChange={e => setFormThesisId(e.target.value)}
                  className={styles.modalSelect}
                >
                  <option value="">None (Keep Local)</option>
                  {theses.map(t => (
                    <option key={t.id} value={t.id}>{t.title} ({t.ticker || 'N/A'})</option>
                  ))}
                </select>
              </div>
              <div className={styles.modalActions}>
                <button type="button" onClick={() => setModalOpen(false)} className={styles.cancelButton}>
                  Cancel
                </button>
                <button type="submit" className={styles.submitButton}>
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {alertsModalOpen && activeAlertPosition && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContainer} style={{ width: '500px' }}>
            <div className={styles.modalHeader}>
              <h3>New Filings: {activeAlertPosition.ticker} ({activeAlertPosition.market})</h3>
              <button onClick={() => setAlertsModalOpen(false)} className={styles.closeModal}>×</button>
            </div>
            <div className={styles.alertsList}>
              {alerts.filter(a => a.positionId === activeAlertPosition.id).map(a => (
                <div key={a.id} className={styles.alertListItem}>
                  <div className={styles.alertMeta}>
                    <span className={styles.alertDate}>{a.publishDate || 'Unknown Date'}</span>
                    <span className={styles.alertFormatBadge}>{a.sourceFormat?.toUpperCase()}</span>
                    {a.sourceTier === 'secondary' && (
                      <span className={styles.alertSecondaryBadge}>Secondary</span>
                    )}
                  </div>
                  <div className={styles.alertDocumentRow}>
                    <a href={a.sourceUrl} target="_blank" rel="noreferrer" className={styles.alertDocumentLink}>
                      {a.sourceName}
                    </a>
                    <button onClick={() => handleDismissAlert(a.id)} className={styles.dismissAlertButton}>
                      Dismiss
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className={styles.modalActions}>
              <button
                onClick={() => handleDismissAllAlerts(activeAlertPosition.id)}
                className={styles.dismissAllButton}
              >
                Dismiss All
              </button>
              <button onClick={() => setAlertsModalOpen(false)} className={styles.cancelButton}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
