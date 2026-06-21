"use client";

import { useMemo, useState } from "react";
import type { Analysis, PortfolioAnalysis, Vertical } from "@/lib/domain/types";
import { decisionLabel, deriveStatusFromDecisionHistory, latestDecision } from "@/lib/domain/decisions";
import { ASSET_TYPE_LABELS, assetTypeTag } from "@/lib/domain/ic";

const VERTICAL_TAG: Record<Vertical, string> = {
  stocks: "EQ",
  startups: "VC",
  conventional: "RE",
};

type StatusFilter = "all" | "draft" | "watching" | "decided" | "archived";

function reviewLifecycleLabel(analysis: Analysis): string {
  if (analysis.tags.includes("watchlist") && analysis.decisionHistory.length === 0) return "Saved to watchlist";
  if (analysis.decisionHistory.length > 0) return "Decision made";
  if (analysis.valuationMode === "engine" && !analysis.debate) return "Needs fact check";
  return "Ready for review";
}

export default function Library({
  analyses,
  portfolios,
  activeView,
  activeId,
  activePortfolioId,
  onOpenAgenda,
  onOpenTriage,
  onOpen,
  onOpenPortfolio,
  onDelete,
  onDeletePortfolio,
}: {
  analyses: Analysis[];
  portfolios: PortfolioAnalysis[];
  activeView: "agenda" | "triage" | "analysis" | "portfolio";
  activeId: string | null;
  activePortfolioId: string | null;
  onOpenAgenda: () => void;
  onOpenTriage: () => void;
  onOpen: (id: string) => void;
  onOpenPortfolio: (id: string) => void;
  onDelete: (id: string) => void;
  onDeletePortfolio: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return analyses.filter((a) => {
      const derivedStatus = deriveStatusFromDecisionHistory(a.decisionHistory);
      if (status !== "all" && derivedStatus !== status) return false;
      if (!q) return true;
      return (
        a.title.toLowerCase().includes(q) ||
        a.assetName.toLowerCase().includes(q) ||
        a.tags.some((t) => t.includes(q))
      );
    });
  }, [analyses, query, status]);

  return (
    <aside className="library-sidebar" data-qa="library">
      <div className="panel-header library-header">
        <span className="panel-title">WORKSPACE</span>
        <span className="library-header-note">home and saved investments</span>
      </div>

      <div className="library-section">
        <div className="library-section-h">HOME</div>
        <button
          className={`library-home-card${activeView === "agenda" ? " active" : ""}`}
          data-qa="library-agenda"
          onClick={onOpenAgenda}
        >
          <div className="library-home-top">
            <span className="library-vtag">HQ</span>
            <span className="library-home-title">What needs attention</span>
          </div>
          <div className="library-home-note">
            Your next money decisions, reviews, and follow-ups in one feed.
          </div>
        </button>
        <button
          className={`library-home-card${activeView === "triage" ? " active" : ""}`}
          data-qa="library-triage"
          onClick={onOpenTriage}
        >
          <div className="library-home-top">
            <span className="library-vtag">XP</span>
            <span className="library-home-title">Explore an idea</span>
          </div>
          <div className="library-home-note">
            Research a new idea first without saving it as an investment review.
          </div>
        </button>
      </div>

      {portfolios.length > 0 && (
        <div className="library-section">
          <div className="library-section-h">PORTFOLIOS</div>
          {portfolios.map((p) => (
            <PortfolioLibraryItem
              key={p.id}
              portfolio={p}
              active={p.id === activePortfolioId}
              onOpen={onOpenPortfolio}
              onDelete={onDeletePortfolio}
            />
          ))}
        </div>
      )}

      <div className="library-section">
        <div className="library-section-h">INVESTMENTS</div>
      <div className="library-controls">
        <input className="library-search" placeholder="Search investments..." value={query} onChange={(e) => setQuery(e.target.value)} />
        <div className="library-filter">
          {(["all", "draft", "watching", "decided", "archived"] as const).map((s) => (
            <button key={s} className={`filter-btn${status === s ? " active" : ""}`} onClick={() => setStatus(s)}>
              {s === "all" ? "ALL" : s === "watching" ? "WATCHLIST" : s.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="library-list scrollable">
        {filtered.length === 0 ? (
          <div className="library-empty">No investment reviews yet. Explore an idea first, or add something you already own.</div>
        ) : (
          filtered.map((a) => <AnalysisLibraryItem key={a.id} analysis={a} active={a.id === activeId} onOpen={onOpen} onDelete={onDelete} />)
        )}
      </div>
      </div>
    </aside>
  );
}

function AnalysisLibraryItem({
  analysis,
  active,
  onOpen,
  onDelete,
}: {
  analysis: Analysis;
  active: boolean;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const latest = latestDecision(analysis.decisionHistory);
  const status = deriveStatusFromDecisionHistory(analysis.decisionHistory);
  return (
    <div className={`library-item${active ? " active" : ""}`} data-qa={`library-analysis-${analysis.id}`} onClick={() => onOpen(analysis.id)}>
      <div className="library-item-top">
        <span className="library-vtag" title={ASSET_TYPE_LABELS[analysis.assetType]}>
          {analysis.vertical ? VERTICAL_TAG[analysis.vertical] : assetTypeTag(analysis.assetType)}
        </span>
        <span className="library-item-title">{analysis.title}</span>
        <button
          className="library-del"
          title="Delete"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(analysis.id);
          }}
        >
          x
        </button>
      </div>
      <div className="library-item-meta">
            <span className={`mini-badge ${status}`}>{latest ? decisionLabel(latest).replaceAll("_", " ") : reviewLifecycleLabel(analysis)}</span>
            <span className="library-date">{new Date(analysis.updatedAt).toLocaleDateString("id-ID")}</span>
          </div>
      {analysis.tags.length > 0 && (
        <div className="library-tags">{analysis.tags.map((t) => `#${t}`).join(" ")}</div>
      )}
    </div>
  );
}

function PortfolioLibraryItem({
  portfolio,
  active,
  onOpen,
  onDelete,
}: {
  portfolio: PortfolioAnalysis;
  active: boolean;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const latest = latestDecision(portfolio.decisionHistory);
  const status = deriveStatusFromDecisionHistory(portfolio.decisionHistory);
  return (
    <div className={`library-item${active ? " active" : ""}`} data-qa={`library-portfolio-${portfolio.id}`} onClick={() => onOpen(portfolio.id)}>
      <div className="library-item-top">
        <span className="library-vtag library-vtag--pf">PF</span>
        <span className="library-item-title">{portfolio.title}</span>
        <button
          className="library-del"
          title="Delete"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(portfolio.id);
          }}
        >
          x
        </button>
      </div>
      <div className="library-item-meta">
        <span className={`mini-badge ${status}`}>
          {latest ? decisionLabel(latest).replaceAll("_", " ") : `${portfolio.members.length} holdings`}
        </span>
        <span className="library-date">{new Date(portfolio.updatedAt).toLocaleDateString("id-ID")}</span>
      </div>
    </div>
  );
}
