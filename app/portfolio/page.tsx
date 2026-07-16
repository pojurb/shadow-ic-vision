'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import type { PortfolioHoldingQueueItem } from '@/lib/portfolio/priorityQueue';

export default function PortfolioStatusIndex() {
  const [index, setIndex] = useState<PortfolioHoldingQueueItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Sorting and Filtering
  const [sortField, setSortField] = useState<'priorityScore' | 'ticker' | 'daysSinceLastReview'>('priorityScore');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterMarket, setFilterMarket] = useState<'ALL' | 'US' | 'ID'>('ALL');

  useEffect(() => {
    async function fetchIndex() {
      try {
        const res = await fetch('/api/portfolio/briefing');
        if (res.ok) {
          const data = await res.json();
          setIndex(data.statusIndex || []);
        }
      } catch (err) {
        console.error('Failed to load status index', err);
      } finally {
        setLoading(false);
      }
    }
    fetchIndex();
  }, []);

  const filteredIndex = index.filter(item => {
    if (filterMarket !== 'ALL' && item.market !== filterMarket) return false;
    return true;
  });

  const sortedIndex = [...filteredIndex].sort((a, b) => {
    let comparison = 0;
    if (sortField === 'ticker') {
      comparison = a.ticker.localeCompare(b.ticker);
    } else if (sortField === 'priorityScore') {
      comparison = a.priorityScore - b.priorityScore;
    } else if (sortField === 'daysSinceLastReview') {
      comparison = a.daysSinceLastReview - b.daysSinceLastReview;
    }
    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc'); // Default to desc for score/days, maybe not ideal for ticker but fine.
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Portfolio Status Index</h1>
        <Link href="/" className="text-blue-500 hover:underline">← Back to Chat</Link>
      </div>

      <div className="flex gap-4 mb-4">
        <div>
          <label className="text-sm font-semibold mr-2">Market Filter:</label>
          <select 
            value={filterMarket} 
            onChange={e => setFilterMarket(e.target.value as 'ALL' | 'US' | 'ID')}
            className="border rounded p-1"
          >
            <option value="ALL">All Markets</option>
            <option value="US">US Only</option>
            <option value="ID">ID Only</option>
          </select>
        </div>
      </div>

      {loading ? (
        <p>Loading index...</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-100 border-b">
                <th className="p-3 font-semibold cursor-pointer" onClick={() => handleSort('ticker')}>
                  Ticker/Market {sortField === 'ticker' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th className="p-3 font-semibold cursor-pointer" onClick={() => handleSort('priorityScore')}>
                  Priority Score {sortField === 'priorityScore' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th className="p-3 font-semibold">Flags / Alerts</th>
                <th className="p-3 font-semibold cursor-pointer" onClick={() => handleSort('daysSinceLastReview')}>
                  Last Reviewed {sortField === 'daysSinceLastReview' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th className="p-3 font-semibold">Thesis Link</th>
              </tr>
            </thead>
            <tbody>
              {sortedIndex.map(item => (
                <tr key={item.id} className="border-b hover:bg-gray-50">
                  <td className="p-3 font-medium">
                    {item.ticker} <span className="text-xs bg-gray-200 px-1 rounded">{item.market}</span>
                  </td>
                  <td className="p-3 font-mono">
                    {item.priorityScore}
                  </td>
                  <td className="p-3 flex gap-2 items-center flex-wrap">
                    {item.unreadAlertCount > 0 && (
                      <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                        {item.unreadAlertCount} Alert(s)
                      </span>
                    )}
                    {item.hasChallengedAssumptions && (
                      <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">
                        Challenged
                      </span>
                    )}
                    {item.daysSinceLastReview > 7 && (
                      <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                        Stale
                      </span>
                    )}
                    {item.unreadAlertCount === 0 && !item.hasChallengedAssumptions && item.daysSinceLastReview <= 7 && (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                  <td className="p-3">
                    {item.daysSinceLastReview} days ago
                  </td>
                  <td className="p-3">
                    {item.thesisId ? (
                      <Link href={`/c/${item.thesisId}`} className="text-blue-500 hover:underline">
                        {item.thesisTitle || 'Untitled Thesis'}
                      </Link>
                    ) : (
                      <span className="text-gray-400 italic">Not Linked</span>
                    )}
                  </td>
                </tr>
              ))}
              {sortedIndex.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-3 text-center text-gray-500">
                    No portfolio holdings match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
