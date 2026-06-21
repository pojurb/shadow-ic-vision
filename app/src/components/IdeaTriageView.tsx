"use client";

import { useMemo, useState } from "react";
import type { SyntheticEvent } from "react";
import {
  deriveIdeaTriage,
  type ExploreDeeperResult,
  type ExploreDirection,
  type TriageCandidate,
  type TriageMode,
  type TriageResult,
} from "@/lib/domain/triage";
import { getProvider } from "@/lib/ai/registry";
import type { ProviderId } from "@/lib/ai/types";

type ExploreViewState = "idle" | "loading" | "resolved_temporary" | "unavailable";

export default function IdeaTriageView({
  onStartCase,
  onAddToWatchlist,
  onBackAgenda,
  provider,
  apiKey,
  model,
  onNeedSettings,
}: {
  onStartCase: (
    selection: { candidate?: TriageCandidate; direction?: ExploreDirection; deeperExploration?: ExploreDeeperResult | null },
    prompt: string,
    triageMode: TriageMode,
  ) => void;
  onAddToWatchlist: (
    selection: { candidate?: TriageCandidate; direction?: ExploreDirection; deeperExploration?: ExploreDeeperResult | null },
    prompt: string,
    triageMode: TriageMode,
  ) => void;
  onBackAgenda: () => void;
  provider: ProviderId;
  apiKey: string;
  model: string;
  onNeedSettings: () => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState<TriageResult | null>(null);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [viewState, setViewState] = useState<ExploreViewState>("idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDirectionId, setSelectedDirectionId] = useState<string | null>(null);
  const [deepeningDirectionId, setDeepeningDirectionId] = useState<string | null>(null);

  const compared = useMemo(
    () => (result?.exploration ? result.exploration.directions.filter((direction) => compareIds.includes(direction.id)) : []),
    [compareIds, result],
  );
  const selectedDirection = result?.exploration?.directions.find((direction) => direction.id === selectedDirectionId) ?? null;

  function unavailableResult(message: string): TriageResult {
    return {
      mode: "broad_screen",
      heading: "Explore unavailable",
      summary: message,
      candidates: [],
      chairNotes: ["Explore is still temporary. Nothing was saved."],
      source: "unavailable",
      exploration: null,
      deeperExploration: null,
    };
  }

  async function runTriage(event?: SyntheticEvent) {
    event?.preventDefault();
    if (busy) return;
    setError(null);
    setSavedIds([]);
    setCompareIds([]);
    setSelectedDirectionId(null);
    setDeepeningDirectionId(null);
    const inspected = deriveIdeaTriage(prompt);
    if (!inspected.requiresDiscovery) {
      setResult(inspected);
      setViewState("resolved_temporary");
      return;
    }
    if (!apiKey.trim()) {
      setResult(unavailableResult("AI discovery is not configured yet. Add a provider key in Settings to generate temporary guided exploration."));
      setViewState("unavailable");
      return;
    }
    setBusy(true);
    setViewState("loading");
    try {
      const exploration = await getProvider(provider).discoverIdeas({ apiKey, model, prompt });
      setResult({
        ...inspected,
        heading: "Temporary guided exploration",
        summary: exploration.summary,
        source: "ai",
        exploration,
        deeperExploration: null,
      });
      setViewState("resolved_temporary");
    } catch (err) {
      const message = err instanceof Error ? err.message : "AI discovery failed.";
      setError(message);
      setResult(unavailableResult(`AI discovery could not return usable guided exploration: ${message}`));
      setViewState("unavailable");
    } finally {
      setBusy(false);
    }
  }

  async function deepenDirection(direction: ExploreDirection) {
    if (busy) return;
    if (!apiKey.trim()) {
      setResult(unavailableResult("AI discovery is not configured yet. Add a provider key in Settings to continue exploring this direction."));
      setViewState("unavailable");
      return;
    }
    setBusy(true);
    setError(null);
    setSelectedDirectionId(direction.id);
    setDeepeningDirectionId(direction.id);
    setViewState("loading");
    try {
      const deeperExploration = await getProvider(provider).deepenIdea({ apiKey, model, prompt, direction });
      setResult((current) => current ? { ...current, deeperExploration } : current);
      setViewState("resolved_temporary");
    } catch (err) {
      const message = err instanceof Error ? err.message : "AI discovery failed.";
      setError(message);
      setResult(unavailableResult(`AI discovery could not deepen this direction: ${message}`));
      setViewState("unavailable");
    } finally {
      setBusy(false);
      setDeepeningDirectionId(null);
    }
  }

  function dismissDirection(id: string) {
    if (!result?.exploration) return;
    const directions = result.exploration.directions.filter((direction) => direction.id !== id);
    setResult({
      ...result,
      exploration: directions.length ? { ...result.exploration, directions } : null,
      deeperExploration: result.deeperExploration?.directionId === id ? null : result.deeperExploration,
    });
    if (selectedDirectionId === id) setSelectedDirectionId(null);
    setCompareIds((ids) => ids.filter((directionId) => directionId !== id));
  }

  function toggleCompare(id: string) {
    setCompareIds((ids) => (ids.includes(id) ? ids.filter((directionId) => directionId !== id) : [...ids, id].slice(-3)));
  }

  function addToWatchlist() {
    if (selectedDirection && result?.mode === "broad_screen") {
      onAddToWatchlist({ direction: selectedDirection, deeperExploration: result.deeperExploration ?? null }, prompt, result.mode);
      setSavedIds((ids) => (ids.includes(selectedDirection.id) ? ids : [...ids, selectedDirection.id]));
      return;
    }
  }

  function startReview() {
    if (selectedDirection && result?.mode === "broad_screen") {
      onStartCase({ direction: selectedDirection, deeperExploration: result.deeperExploration ?? null }, prompt, result.mode);
    }
  }

  function directStartReview(candidate: TriageCandidate) {
    onStartCase({ candidate }, prompt, result?.mode ?? "direct_asset");
  }

  function renderDirectionActions(direction: ExploreDirection) {
    const isSelected = selectedDirectionId === direction.id;
    const isSaved = savedIds.includes(direction.id);
    const deeperReady = result?.deeperExploration?.directionId === direction.id;
    return (
      <div className="triage-actions">
        {!deeperReady ? (
          <button
            className="commit-btn"
            type="button"
            data-qa={`triage-deepen-${direction.id}`}
            onClick={() => void deepenDirection(direction)}
            disabled={busy}
          >
            {deepeningDirectionId === direction.id ? "Exploring deeper..." : "Explore deeper"}
          </button>
        ) : (
          <>
            <button className="commit-btn" type="button" data-qa={`triage-start-${direction.id}`} onClick={startReview}>
              Start review
            </button>
            <button className="ghost-btn" type="button" data-qa={`triage-watch-${direction.id}`} onClick={addToWatchlist}>
              Save to watchlist
            </button>
          </>
        )}
        <button className="tp-mini-btn" type="button" onClick={() => toggleCompare(direction.id)}>
          {compareIds.includes(direction.id) ? "Remove compare" : "Compare"}
        </button>
        <button className="tp-mini-btn" type="button" onClick={() => dismissDirection(direction.id)}>
          Dismiss
        </button>
        {isSelected && deeperReady && <span className="mini-badge watching">{isSaved ? "saved draft" : "ready to save"}</span>}
      </div>
    );
  }

  return (
    <div className="triage-view" data-qa="idea-triage-view">
      <div className="triage-shell">
        <section className="triage-hero">
          <div>
            <div className="agenda-kicker">Explore</div>
            <div className="triage-temp-badge">Temporary sandbox · Not saved</div>
            <h2>Explore an idea before you save it</h2>
            <p>
              Use this space for broad questions, quick screens, and first-pass framing.
              Nothing enters your saved investments until you explicitly start a review or save it to your watchlist.
            </p>
          </div>
          <button className="tp-ghost" type="button" onClick={onBackAgenda}>
            Back home
          </button>
        </section>

        <form className="triage-input-panel" onSubmit={(event) => void runTriage(event)}>
          <label className="label-text" htmlFor="triage-prompt">
            What investment are you thinking about?
          </label>
          <textarea
            id="triage-prompt"
            className="triage-input"
            data-qa="triage-prompt"
            rows={4}
            placeholder="Example: AI infrastructure ideas, private laundry business, or analyze TLKM"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
          />
          <div className="triage-input-actions">
            <button className="commit-btn" data-qa="triage-run" type="submit" disabled={busy}>
              {busy ? "Exploring..." : "Explore an idea"}
            </button>
            <span>Exploration only. No saved investment, evidence, or key numbers are created here.</span>
          </div>
        </form>

        {viewState === "loading" && (
          <section className="triage-result triage-result--loading" data-qa="triage-loading">
            <div className="triage-result-head">
              <div>
                <div className="agenda-kicker">Explore loading</div>
                <h3>{deepeningDirectionId ? "Deepening this direction..." : "Building temporary guided exploration..."}</h3>
              </div>
              <span className="triage-mode triage-mode--broad_screen">loading</span>
            </div>
            <p>
              {deepeningDirectionId
                ? "Explore is sharpening this direction before anything can be saved."
                : "Explore is building temporary guidance. Nothing is being saved."}
            </p>
          </section>
        )}

        {viewState === "resolved_temporary" && result && (
          <section className="triage-result" data-qa="triage-result">
            <div className="triage-result-head">
              <div>
                <div className="agenda-kicker">Temporary guided exploration</div>
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

            {error && <div className="triage-error" data-qa="triage-error">{error}</div>}

            {result.mode === "direct_asset" && result.candidates.length > 0 && (
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
                    </div>
                    <p>{candidate.thesisAngle}</p>
                    <TriageList title="What still needs checking" items={candidate.missingEvidence} />
                    <TriageList title="Main risks" items={candidate.riskLens} />
                    <div className="triage-actions">
                      <button className="commit-btn" type="button" data-qa={`triage-start-${candidate.id}`} onClick={() => directStartReview(candidate)}>
                        Start review
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}

            {result.mode === "broad_screen" && result.exploration && (
              <>
                <div className="triage-candidates" data-qa="triage-directions">
                  {result.exploration.directions.map((direction) => (
                    <article className="triage-candidate" data-qa={`triage-direction-${direction.id}`} key={direction.id}>
                      <div className="triage-candidate-top">
                        <div>
                          <h4>{direction.title}</h4>
                          <div className="agenda-row-meta">
                            <span>{direction.assetType.replaceAll("_", " ")}</span>
                            {direction.ticker && <span className="library-vtag">{direction.ticker}</span>}
                          </div>
                        </div>
                      </div>
                      <p>{direction.thesisAngle}</p>
                      <TriageList title="Why it could work" items={direction.whyItCouldWork} />
                      <TriageList title="Main risks" items={direction.mainRisks} />
                      <TriageList title="Questions that matter next" items={direction.nextQuestions} />
                      {renderDirectionActions(direction)}
                    </article>
                  ))}
                </div>

                {selectedDirection && result.deeperExploration?.directionId === selectedDirection.id && (
                  <section className="triage-compare" data-qa="triage-deeper-result">
                    <div className="agenda-kicker">Deeper temporary exploration</div>
                    <h3>{selectedDirection.title}</h3>
                    <p>{result.deeperExploration.summary}</p>
                    <div className="triage-compare-grid">
                      <div className="triage-compare-card">
                        <h4>Why this may matter</h4>
                        {result.deeperExploration.whyItCouldWork.map((item) => <span key={item}>{item}</span>)}
                      </div>
                      <div className="triage-compare-card">
                        <h4>What could break it</h4>
                        {result.deeperExploration.mainRisks.map((item) => <span key={item}>{item}</span>)}
                      </div>
                      <div className="triage-compare-card">
                        <h4>Evidence to check next</h4>
                        {result.deeperExploration.evidenceToCheck.map((item) => <span key={item}>{item}</span>)}
                      </div>
                      <div className="triage-compare-card">
                        <h4>Decision questions</h4>
                        {result.deeperExploration.decisionQuestions.map((item) => <span key={item}>{item}</span>)}
                      </div>
                    </div>
                    <div className="triage-notes">
                      <div className="triage-note">This is still temporary. Saving starts only when you choose Start review or Save to watchlist.</div>
                    </div>
                  </section>
                )}
              </>
            )}
          </section>
        )}

        {viewState === "unavailable" && result && (
          <section className="triage-result" data-qa="triage-unavailable">
            <div className="triage-result-head">
              <div>
                <div className="agenda-kicker">Explore unavailable</div>
                <h3>{result.heading}</h3>
              </div>
              <span className="triage-mode triage-mode--broad_screen">unavailable</span>
            </div>
            <p>{result.summary}</p>
            {error && <div className="triage-error" data-qa="triage-error">{error}</div>}
            <div className="triage-actions">
              {!apiKey.trim() ? (
                <button className="ghost-btn" type="button" data-qa="triage-open-settings" onClick={onNeedSettings}>
                  Open Settings
                </button>
              ) : (
                <button className="tp-mini-btn" type="button" data-qa="triage-retry" onClick={() => void runTriage()}>
                  Try again
                </button>
              )}
            </div>
          </section>
        )}

        {viewState === "idle" && (
          <section className="triage-empty">
            <div>
              <span className="library-vtag">01</span>
              <h3>Explore before saving</h3>
              <p>Use this area for questions that should not become a saved investment yet.</p>
            </div>
            <div>
              <span className="library-vtag">02</span>
              <h3>Deepen one direction first</h3>
              <p>Your first direction pick stays temporary and sharpens the reasoning before any save step appears.</p>
            </div>
            <div>
              <span className="library-vtag">03</span>
              <h3>Check the facts next</h3>
              <p>Once you save a real review, then you can check the facts before making a decision.</p>
            </div>
          </section>
        )}

        {compared.length > 1 && (
          <section className="triage-compare" data-qa="triage-compare">
            <div className="agenda-kicker">Comparison frame</div>
            <div className="triage-compare-grid">
              {compared.map((direction) => (
                <div key={direction.id} className="triage-compare-card">
                  <h4>{direction.assetName}</h4>
                  <p>{direction.thesisAngle}</p>
                  <span>{direction.mainRisks[0]}</span>
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
