'use client';

import React, { useEffect, useState } from 'react';
import { STALE_REVIEW_DAYS, type PortfolioHoldingQueueItem } from '@/lib/portfolio/priorityQueue';

export function TopTenQueue({
  onSelect,
  refreshKey,
}: {
  onSelect: (holding: PortfolioHoldingQueueItem) => void;
  refreshKey?: number;
}) {
  const [queue, setQueue] = useState<PortfolioHoldingQueueItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchQueue() {
      try {
        const res = await fetch('/api/portfolio/briefing');
        if (res.ok) {
          const data = await res.json();
          setQueue(data.topTen || []);
        }
      } catch (err) {
        console.error('Failed to load priority queue', err);
      } finally {
        setLoading(false);
      }
    }
    fetchQueue();
  }, [refreshKey]);

  if (loading) {
    return <div className="text-sm text-gray-500 p-2">Loading priority queue...</div>;
  }

  if (queue.length === 0) {
    return <div className="text-sm text-gray-500 p-2">No active items require review.</div>;
  }

  return (
    <div className="flex flex-col gap-2 mt-2">
      <h3 className="text-xs font-semibold uppercase text-gray-400 px-2">Top-10 Review Queue</h3>
      <ul className="space-y-1">
        {queue.map((item, idx) => (
          <li key={item.id} className="group">
            <button
              onClick={() => onSelect(item)}
              className="w-full text-left px-2 py-1.5 rounded-md hover:bg-gray-100 flex items-center justify-between"
            >
              <div className="flex items-center gap-2 truncate">
                <span className="text-xs font-mono text-gray-400 w-4">{idx + 1}.</span>
                <span className="text-sm font-medium truncate">{item.ticker}</span>
                {item.unreadAlertCount > 0 && (
                  <span className="inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold text-white bg-red-500 rounded-full">
                    {item.unreadAlertCount}
                  </span>
                )}
              </div>
              <div className="flex gap-1">
                {item.daysSinceLastReview > STALE_REVIEW_DAYS && (
                  <span className="text-[10px] bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded" title="Stale Review">Stale</span>
                )}
                {item.hasChallengedAssumptions && (
                  <span className="text-[10px] bg-orange-100 text-orange-800 px-1.5 py-0.5 rounded" title="Challenged Assumptions">⚠</span>
                )}
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
