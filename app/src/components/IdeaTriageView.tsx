"use client";

import { useMemo, useState } from "react";
import type { SyntheticEvent } from "react";
import { deriveIdeaTriage, type TriageCandidate, type TriageResult } from "@/lib/domain/triage";

export default function IdeaTriageView({
  onStartCase,
  onAddToWatchlist,
  onBackAgenda,
}: {
  onStartCase: (candidate: TriageCandidate, prompt: string) => void;
  onAddToWatchlist: (candidate: TriageCandidate, prompt: string) => void;
  onBackAgenda: () => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState<TriageResult | null>(null);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [compareIds, setCompareIds] = useState<string[]>([]);

  const compared = useMemo(
    () => (result ? result.candidates.filter((candidate) => compareIds.includes(candidate.id)) : []),
    [compareIds, result],
  );

  function runTriage(event: SyntheticEvent) {
    event.preventDefault();
    const next = deriveIdeaTriage(prompt);
    setResult(next);
    setSavedIds([]);
    setCompareIds([]);
  }

  function dismissCandidate(id: string) {
    if (!result) return;
    setResult({ ...result, candidates: result.candidates.filter((candidate) => candidate.id !== id) });
    setCompareIds((ids) => ids.filter((candidateId) => candidateId !== id));
  }

  function toggleCompare(id: string) {
    setCompareIds((ids) => (ids.includes(id) ? ids.filter((candidateId) => candidateId !== id) : [...ids, id].slice(-3)));
  }

  function addToWatchlist(candidate: TriageCandidate) {
    onAddToWatchlist(candidate, prompt);
    setSavedIds((ids) => (ids.includes(candidate.id) ? ids : [...ids, candidate.id]));
  }

  return (
    <div className="triage-view" data-qa="idea-triage-view">
      <div className="triage-shell">
        <section className="triage-hero">
          <div>
            <div className="agenda-kicker">IC Chair Triage</div>
            <h2>Decide whether an idea deserves a case file</h2>
            <p>
              Temporary workspace for broad questions, opportunity screens, and first-pass framing.
              Nothing enters Library until you start a case or add it to the watchlist.
            </p>
          </div>
          <button className="tp-ghost" type="button" onClick={onBackAgenda}>
            Back to Agenda
          </button>
        </section>

        <form className="triage-input-panel" onSubmit={runTriage}>
          <label className="label-text" htmlFor="triage-prompt">
            Advisory prompt
          </label>
          <textarea
            id="triage-prompt"
            className="triage-input"
            data-qa="triage-prompt"
            rows={4}
            placeholder="Ask the IC Chair, e.g. any Indonesian stocks worth digging into?"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
          />
          <div className="triage-input-actions">
            <button className="commit-btn" data-qa="triage-run" type="submit">
              Run triage
            </button>
            <span>Advisory only. No thesis memory, evidence, or figures are created here.</span>
          </div>
        </form>

        {result ? (
          <section className="triage-result" data-qa="triage-result">
            <div className="triage-result-head">
              <div>
                <div className="agenda-kicker">Triage output</div>
                <h3>{result.heading}</h3>
              </div>
              <span className={`triage-mode triage-mode--${result.mode}`}>{result.mode.replaceAll("_", " ")}</span>
            </div>
            <p>{result.summary}</p>

            {result.chairNotes.length > 0 && (
              <div className="triage-notes">
                {result.chairNotes.map((note) => (
                  <div key={note} className="triage-note">
                    {note}
                  </div>
                ))}
              </div>
            )}

            {result.candidates.length > 0 ? (
              <div className="triage-candidates" data-qa="triage-candidates">
                {result.candidates.map((candidate) => (
                  <article className="triage-candidate" data-qa={`triage-candidate-${candidate.id}`} key={candidate.id}>
                    <div className="triage-candidate-top">
                      <div>
                        <h4>{candidate.title}</h4>
                        <div className="agenda-row-meta">
                          <span>{candidate.assetType.replaceAll("_", " ")}</span>
                          {candidate.ticker && <span className="library-vtag">{candidate.ticker}</span>}
                        </div>
                      </div>
                      {savedIds.includes(candidate.id) && <span className="mini-badge watching">added</span>}
                    </div>
                    <p>{candidate.thesisAngle}</p>
                    <TriageList title="Missing evidence" items={candidate.missingEvidence} />
                    <TriageList title="Risk lens" items={candidate.riskLens} />
                    <div className="triage-actions">
                      <button className="commit-btn" type="button" data-qa={`triage-start-${candidate.id}`} onClick={() => onStartCase(candidate, prompt)}>
                        Start case
                      </button>
                      <button className="ghost-btn" type="button" data-qa={`triage-watch-${candidate.id}`} onClick={() => addToWatchlist(candidate)}>
                        Add to watchlist
                      </button>
                      <button className="tp-mini-btn" type="button" onClick={() => toggleCompare(candidate.id)}>
                        {compareIds.includes(candidate.id) ? "Remove compare" : "Compare"}
                      </button>
                      <button className="tp-mini-btn" type="button" onClick={() => dismissCandidate(candidate.id)}>
                        Dismiss
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="agenda-empty">
                <h3>No case candidate yet</h3>
                <p>Ask about an opportunity set or name a concrete asset to begin triage.</p>
              </div>
            )}
          </section>
        ) : (
          <section className="triage-empty">
            <div>
              <span className="library-vtag">01</span>
              <h3>Screen before saving</h3>
              <p>Use this area for questions that should not become a case file yet.</p>
            </div>
            <div>
              <span className="library-vtag">02</span>
              <h3>Open cases deliberately</h3>
              <p>Start a case only when the idea deserves thesis memory, evidence, and review cadence.</p>
            </div>
            <div>
              <span className="library-vtag">03</span>
              <h3>Lock facts later</h3>
              <p>Verification stays inside the case file, after cited evidence exists.</p>
            </div>
          </section>
        )}

        {compared.length > 1 && (
          <section className="triage-compare" data-qa="triage-compare">
            <div className="agenda-kicker">Comparison frame</div>
            <div className="triage-compare-grid">
              {compared.map((candidate) => (
                <div key={candidate.id} className="triage-compare-card">
                  <h4>{candidate.assetName}</h4>
                  <p>{candidate.thesisAngle}</p>
                  <span>{candidate.riskLens[0]}</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function TriageList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="triage-list">
      <span>{title}</span>
      {items.map((item) => (
        <div key={item}>{item}</div>
      ))}
    </div>
  );
}
