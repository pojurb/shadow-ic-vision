'use client';

import React, { useEffect, useState } from 'react';
import { STALE_REVIEW_DAYS, VERDICT_LABEL, type PortfolioHoldingQueueItem, type ThesisResearchSummary } from '@/lib/portfolio/priorityQueue';

const VERDICT_TONE: Record<ThesisResearchSummary['verdictLevel'], string> = {
  breached: 'bg-red-100 text-red-800',
  at_risk: 'bg-orange-100 text-orange-800',
  holding: 'bg-green-100 text-green-800',
  insufficient_evidence: 'bg-gray-200 text-gray-700',
};

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
                {item.lastAction && (
                  <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded" title="Last Recorded Action">{item.lastAction}</span>
                )}
                {item.daysSinceLastReview > STALE_REVIEW_DAYS && (
                  <span className="text-[10px] bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded" title="Stale Review">Stale</span>
                )}
                {item.hasChallengedAssumptions && (
                  <span className="text-[10px] bg-orange-100 text-orange-800 px-1.5 py-0.5 rounded" title="Challenged Assumptions">⚠</span>
                )}
                {item.research && (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded ${VERDICT_TONE[item.research.verdictLevel]}`}
                    title="Thesis verdict"
                  >
                    {VERDICT_LABEL[item.research.verdictLevel]}
                  </span>
                )}
              </div>
            </button>
            {/*
              * The reason to review, not just the ticker. Without this the
              * weekly review surface showed a symbol and nothing about whether
              * the thesis still stands.
              */}
            {item.research && (
              <p className="text-[10px] text-gray-500 pl-8 pb-1">
                {item.research.supported} of {item.research.totalAssumptions} assumptions supported
                {item.research.relevanceUnassessedCount > 0
                  && ` · ${item.research.relevanceUnassessedCount} passages not relevance-checked`}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
