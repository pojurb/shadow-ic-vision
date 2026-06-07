"use client";

import { useMemo, useState } from "react";
import type { Analysis, PortfolioAnalysis, Vertical } from "@/lib/domain/types";

const VERTICAL_TAG: Record<Vertical, string> = {
  stocks: "EQ",
  startups: "VC",
  conventional: "RE",
};

export default function Library({
  analyses,
  portfolios,
  activeId,
  activePortfolioId,
  onOpen,
  onOpenPortfolio,
  onDelete,
  onDeletePortfolio,
  onNew,
  onNewPortfolio,
}: {
  analyses: Analysis[];
  portfolios: PortfolioAnalysis[];
  activeId: string | null;
  activePortfolioId: string | null;
  onOpen: (id: string) => void;
  onOpenPortfolio: (id: string) => void;
  onDelete: (id: string) => void;
  onDeletePortfolio: (id: string) => void;
  onNew: () => void;
  onNewPortfolio: () => void;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "draft" | "decided">("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return analyses.filter((a) => {
      if (status === "draft" && a.status !== "draft") return false;
      if (status === "decided" && a.decision == null) return false;
      if (!q) return true;
      return (
        a.title.toLowerCase().includes(q) ||
        a.assetName.toLowerCase().includes(q) ||
        a.tags.some((t) => t.includes(q))
      );
    });
  }, [analyses, query, status]);

  return (
    <aside className="library-sidebar">
      <div className="panel-header warning-stripes">
        <span className="panel-title">LIBRARY</span>
        <div className="library-new-actions">
          <button className="new-btn" onClick={onNew}>+ NEW</button>
          <button className="new-btn" onClick={onNewPortfolio} title="Compose a portfolio from existing analyses">+ PORTFOLIO</button>
        </div>
      </div>

      {portfolios.length > 0 && (
        <div className="library-section">
          <div className="library-section-h">PORTFOLIOS</div>
          {portfolios.map((p) => (
            <div
              key={p.id}
              className={`library-item${p.id === activePortfolioId ? " active" : ""}`}
              onClick={() => onOpenPortfolio(p.id)}
            >
              <div className="library-item-top">
                <span className="library-vtag library-vtag--pf">PF</span>
                <span className="library-item-title">{p.title}</span>
                <button
                  className="library-del"
                  title="Delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeletePortfolio(p.id);
                  }}
                >
                  ✕
                </button>
              </div>
              <div className="library-item-meta">
                <span className="mini-badge draft">
                  {p.members.length} {p.members.length === 1 ? "holding" : "holdings"}
                </span>
                <span className="library-date">{new Date(p.updatedAt).toLocaleDateString("id-ID")}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="library-controls">
        <input className="library-search" placeholder="Search analyses…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <div className="library-filter">
          {(["all", "draft", "decided"] as const).map((s) => (
            <button key={s} className={`filter-btn${status === s ? " active" : ""}`} onClick={() => setStatus(s)}>
              {s.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      <div className="library-list scrollable">
        {filtered.length === 0 ? (
          <div className="library-empty">No analyses yet. Hit + NEW to start.</div>
        ) : (
          filtered.map((a) => (
            <div
              key={a.id}
              className={`library-item${a.id === activeId ? " active" : ""}`}
              onClick={() => onOpen(a.id)}
            >
              <div className="library-item-top">
                <span className="library-vtag">{VERTICAL_TAG[a.vertical]}</span>
                <span className="library-item-title">{a.title}</span>
                <button
                  className="library-del"
                  title="Delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(a.id);
                  }}
                >
                  ✕
                </button>
              </div>
              <div className="library-item-meta">
                {a.decision ? (
                  <span className={`mini-badge ${a.decision.action}-text`}>{a.decision.action}</span>
                ) : (
                  <span className="mini-badge draft">DRAFT</span>
                )}
                <span className="library-date">{new Date(a.updatedAt).toLocaleDateString("id-ID")}</span>
              </div>
              {a.tags.length > 0 && (
                <div className="library-tags">{a.tags.map((t) => `#${t}`).join(" ")}</div>
              )}
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
