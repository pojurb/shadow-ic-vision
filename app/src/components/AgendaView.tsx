"use client";

import { useMemo, useState } from "react";
import { deriveStatusFromDecisionHistory } from "@/lib/domain/decisions";
import {
  type AgendaFilter,
  type AgendaItem,
  deriveAgendaItems,
  filterAgendaItems,
} from "@/lib/domain/agenda";
import type { Analysis, PortfolioAnalysis } from "@/lib/domain/types";
import { ASSET_TYPE_LABELS } from "@/lib/domain/ic";

const FILTERS: Array<{ id: AgendaFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "due_now", label: "Review due" },
  { id: "stale", label: "Overdue" },
  { id: "contradictory_evidence", label: "Conflicting evidence" },
  { id: "valuation_drift", label: "Thesis changed" },
  { id: "shared_exposure", label: "Shared exposure" },
  { id: "watching", label: "Watchlist" },
  { id: "decided", label: "Decided" },
  { id: "archived", label: "Archived" },
];

export default function AgendaView({
  analyses,
  portfolios,
  onOpenAnalysis,
  onOpenPortfolio,
  onInvestigateIdea,
  onNewInvestment,
  onNewPortfolio,
}: {
  analyses: Analysis[];
  portfolios: PortfolioAnalysis[];
  onOpenAnalysis: (id: string) => void;
  onOpenPortfolio: (id: string) => void;
  onInvestigateIdea: () => void;
  onNewInvestment: () => void;
  onNewPortfolio: () => void;
}) {
  const [filter, setFilter] = useState<AgendaFilter>("all");
  const [agendaNow] = useState(() => Date.now());
  const items = useMemo(() => deriveAgendaItems(analyses, portfolios, agendaNow), [agendaNow, analyses, portfolios]);
  const visibleItems = useMemo(() => filterAgendaItems(items, filter, agendaNow), [agendaNow, filter, items]);
  const watchingCount = useMemo(
    () => analyses.filter((analysis) => deriveStatusFromDecisionHistory(analysis.decisionHistory) === "watching").length,
    [analyses],
  );
  const recentDecisionCount = useMemo(
    () => analyses.filter((analysis) => analysis.decisionHistory.length > 0).length + portfolios.filter((portfolio) => portfolio.decisionHistory.length > 0).length,
    [analyses, portfolios],
  );

  return (
    <div className="agenda-view" data-qa="agenda-view">
      <div className="agenda-shell">
        <section className="agenda-hero">
          <div>
            <div className="agenda-kicker">Home</div>
            <h2>What should I do next with my money?</h2>
            <p>
              Track your investments, see what needs attention, and review the next decision that actually matters.
            </p>
          </div>
          <div className="agenda-hero-stats">
            <div className="agenda-stat">
              <span className="agenda-stat-label">My holdings</span>
              <strong>{analyses.length}</strong>
            </div>
            <div className="agenda-stat">
              <span className="agenda-stat-label">Watchlist</span>
              <strong>{watchingCount}</strong>
            </div>
            <div className="agenda-stat">
              <span className="agenda-stat-label">Needs attention</span>
              <strong>{items.length}</strong>
            </div>
            <div className="agenda-stat">
              <span className="agenda-stat-label">Recent decisions</span>
              <strong>{recentDecisionCount}</strong>
            </div>
          </div>
        </section>

        <section className="agenda-actions">
          <button className="commit-btn" data-qa="agenda-investigate-idea" onClick={onInvestigateIdea}>
            Explore an idea
          </button>
          <button className="ghost-btn" data-qa="agenda-new-manual" onClick={onNewInvestment}>
            Add investment
          </button>
          <button className="ghost-btn" data-qa="agenda-new-portfolio" onClick={onNewPortfolio}>
            Create portfolio
          </button>
        </section>

        <section className="agenda-filters" data-qa="agenda-filters">
          {FILTERS.map((option) => (
            <button
              key={option.id}
              className={`filter-btn${filter === option.id ? " active" : ""}`}
              data-qa={`agenda-filter-${option.id}`}
              onClick={() => setFilter(option.id)}
            >
              {option.label}
            </button>
          ))}
        </section>

        <section className="agenda-list" data-qa="agenda-list">
          {visibleItems.length === 0 ? (
            <div className="agenda-empty">
              <h3>No urgent money tasks right now</h3>
              <p>You are clear for this filter. Explore a new idea, add an investment you already own, or create a portfolio when you are ready.</p>
            </div>
          ) : (
            visibleItems.map((item, index) => (
              <AgendaRow
                key={`${item.target.kind}:${item.target.id}`}
                item={item}
                rank={index + 1}
                now={agendaNow}
                onOpenAnalysis={onOpenAnalysis}
                onOpenPortfolio={onOpenPortfolio}
              />
            ))
          )}
        </section>
      </div>
    </div>
  );
}

function AgendaRow({
  item,
  rank,
  now,
  onOpenAnalysis,
  onOpenPortfolio,
}: {
  item: AgendaItem;
  rank: number;
  now: number;
  onOpenAnalysis: (id: string) => void;
  onOpenPortfolio: (id: string) => void;
}) {
  const assetLabel = item.assetType === "portfolio" ? "Portfolio" : ASSET_TYPE_LABELS[item.assetType];
  const dueLabel = formatDueLabel(item, now);
  const nextAction = actionLabel(item);
  const open = () => {
    if (item.target.kind === "analysis") onOpenAnalysis(item.target.id);
    else onOpenPortfolio(item.target.id);
  };

  return (
    <button
      className="agenda-row"
      data-qa={`agenda-row-${item.target.kind}-${item.target.id}`}
      onClick={open}
    >
      <div className="agenda-row-rank">{rank}</div>
      <div className="agenda-row-main">
        <div className="agenda-row-top">
          <div>
            <div className="agenda-row-title">{item.title}</div>
            <div className="agenda-row-meta">
              <span>{assetLabel}</span>
              <span className={`mini-badge ${item.status}`}>{item.status}</span>
              {item.latestDecisionSummary && <span>{item.latestDecisionSummary}</span>}
            </div>
          </div>
          <div className="agenda-row-side">
            {dueLabel && <span className="agenda-row-due">{dueLabel}</span>}
            <span className="agenda-row-score">{nextAction}</span>
          </div>
        </div>
        <div className="agenda-reasons">
          {item.reasons.slice(0, 3).map((reason) => (
            <div key={`${reason.category}-${reason.message}`} className="agenda-reason">
              <span className="agenda-reason-tag">{reason.category.replaceAll("_", " ")}</span>
              <span>{reason.message}</span>
            </div>
          ))}
        </div>
      </div>
    </button>
  );
}

function actionLabel(item: AgendaItem): string {
  const categories = item.reasons.map((reason) => reason.category);
  if (categories.includes("contradiction_pressure")) return "Check evidence";
  if (categories.includes("valuation_drift")) return "Update thesis";
  if (categories.includes("decision_follow_up")) return "Follow up";
  return "Review now";
}

function formatDueLabel(item: AgendaItem, now: number): string | null {
  if (typeof item.followUpDueAt === "number" && item.followUpDueAt <= now) {
    return `Follow-up overdue ${daysOverdue(item.followUpDueAt, now)}d`;
  }
  if (typeof item.reviewDueAt === "number" && item.reviewDueAt <= now) {
    return `Review overdue ${daysOverdue(item.reviewDueAt, now)}d`;
  }
  if (typeof item.followUpDueAt === "number") {
    return `Follow-up due ${new Date(item.followUpDueAt).toLocaleDateString("id-ID")}`;
  }
  if (typeof item.reviewDueAt === "number") {
    return `Review due ${new Date(item.reviewDueAt).toLocaleDateString("id-ID")}`;
  }
  return null;
}

function daysOverdue(dueAt: number, now: number): number {
  return Math.max(1, Math.ceil((now - dueAt) / (24 * 60 * 60 * 1000)));
}
