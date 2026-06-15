"use client";

import { useMemo, useState } from "react";
import type { DecisionEntry, DecisionOutcomeReview, ICAction } from "@/lib/domain/types";
import {
  addDecisionReview,
  decisionLabel,
  type DecisionDraft,
  validateDecisionDraft,
} from "@/lib/domain/decisions";

const ACTIONS: { value: ICAction; label: string }[] = [
  { value: "no_action", label: "No action" },
  { value: "watch", label: "Watch" },
  { value: "research_more", label: "Research more" },
  { value: "increase_conviction", label: "Increase conviction" },
  { value: "decrease_conviction", label: "Decrease conviction" },
  { value: "add_increase_position", label: "Add / increase position" },
  { value: "trim_reduce_position", label: "Trim / reduce position" },
  { value: "exit", label: "Exit" },
  { value: "archive", label: "Archive" },
];

const OUTCOMES: DecisionOutcomeReview["outcome"][] = ["worked", "mixed", "did_not_work", "unresolved"];
const REASONING: DecisionOutcomeReview["reasoningAssessment"][] = [
  "right_right_reason",
  "wrong_right_reason",
  "lucky",
  "unclear",
];

export default function DecisionLedger({
  history,
  onHistoryChange,
  createEntry,
  subjectLabel,
  dataQa,
}: {
  history: DecisionEntry[];
  onHistoryChange: (history: DecisionEntry[]) => void;
  createEntry: (draft: DecisionDraft) => DecisionEntry;
  subjectLabel: string;
  dataQa?: string;
}) {
  const [action, setAction] = useState<ICAction>("watch");
  const [rationale, setRationale] = useState("");
  const [preMortem, setPreMortem] = useState("");
  const [triggerDate, setTriggerDate] = useState("");
  const [triggerNote, setTriggerNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [renderedAt] = useState(() => Date.now());
  const newestFirst = useMemo(() => [...history].reverse(), [history]);

  function draft(): DecisionDraft {
    return {
      action,
      rationale,
      preMortem,
      triggerDueAt: triggerDate ? new Date(`${triggerDate}T00:00:00`).getTime() : null,
      triggerNote,
    };
  }

  function commit(e: React.FormEvent) {
    e.preventDefault();
    const nextDraft = draft();
    const validation = validateDecisionDraft(nextDraft);
    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }
    onHistoryChange([...history, createEntry(nextDraft)]);
    setErrors({});
    setRationale("");
    setPreMortem("");
    setTriggerDate("");
    setTriggerNote("");
  }

  function saveReview(entryId: string, review: Omit<DecisionOutcomeReview, "reviewedAt">) {
    onHistoryChange(history.map((entry) => (entry.id === entryId ? addDecisionReview(entry, review) : entry)));
    setReviewingId(null);
  }

  return (
    <div className="decision-ledger" data-qa={dataQa ?? "decision-ledger"}>
      {history.length === 0 ? (
        <div className="tp-muted-note">No decisions logged yet. {subjectLabel} is still in draft mode.</div>
      ) : null}

      <form className="decision-form" onSubmit={commit}>
        <div className="form-row">
          <label htmlFor="decision-action">IC action</label>
          <select id="decision-action" value={action} onChange={(e) => setAction(e.target.value as ICAction)}>
            {ACTIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        <div className="form-row">
          <label htmlFor="decision-rationale">Rationale</label>
          <textarea
            id="decision-rationale"
            rows={2}
            placeholder="Why this is the right committee action now..."
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
          />
          {errors.rationale && <div className="field-error">{errors.rationale}</div>}
        </div>

        {action === "add_increase_position" && (
          <div className="form-row">
            <label htmlFor="decision-premortem">Pre-mortem</label>
            <textarea
              id="decision-premortem"
              rows={2}
              placeholder="What would make this decision fail?"
              value={preMortem}
              onChange={(e) => setPreMortem(e.target.value)}
            />
            {errors.preMortem && <div className="field-error">{errors.preMortem}</div>}
          </div>
        )}

        {action !== "archive" && (
          <>
            <div className="form-row">
              <label htmlFor="decision-trigger-date">Review trigger date</label>
              <input
                id="decision-trigger-date"
                type="date"
                value={triggerDate}
                onChange={(e) => setTriggerDate(e.target.value)}
              />
              {errors.triggerDueAt && <div className="field-error">{errors.triggerDueAt}</div>}
            </div>
            <div className="form-row">
              <label htmlFor="decision-trigger-note">Trigger note</label>
              <textarea
                id="decision-trigger-note"
                rows={2}
                placeholder="What event or condition should force review?"
                value={triggerNote}
                onChange={(e) => setTriggerNote(e.target.value)}
              />
              {errors.triggerNote && <div className="field-error">{errors.triggerNote}</div>}
            </div>
          </>
        )}

        <button type="submit" className="commit-btn" data-qa="decision-commit">COMMIT DECISION</button>
      </form>

      {newestFirst.length > 0 && (
        <div className="decision-history">
          {newestFirst.map((entry) => (
            <DecisionHistoryEntry
              key={entry.id}
              entry={entry}
              renderedAt={renderedAt}
              reviewing={reviewingId === entry.id}
              onReview={() => setReviewingId(entry.id)}
              onCancelReview={() => setReviewingId(null)}
              onSaveReview={(review) => saveReview(entry.id, review)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DecisionHistoryEntry({
  entry,
  renderedAt,
  reviewing,
  onReview,
  onCancelReview,
  onSaveReview,
}: {
  entry: DecisionEntry;
  renderedAt: number;
  reviewing: boolean;
  onReview: () => void;
  onCancelReview: () => void;
  onSaveReview: (review: Omit<DecisionOutcomeReview, "reviewedAt">) => void;
}) {
  const due = entry.trigger != null && entry.trigger.dueAt < renderedAt && !entry.review;
  return (
    <div className={`decision-entry${due ? " is-due" : ""}`}>
      <div className="decision-entry-top">
        <span className="mini-badge">{decisionLabel(entry).replaceAll("_", " ").toUpperCase()}</span>
        {due && <span className="mini-badge warning">REVIEW DUE</span>}
        {entry.review && <span className="mini-badge decided">REVIEWED</span>}
        <span className="decision-date">{new Date(entry.decidedAt).toLocaleDateString("id-ID")}</span>
      </div>
      <div className="decision-rationale">{entry.rationale}</div>
      {entry.preMortem && <div className="decision-detail">Pre-mortem: {entry.preMortem}</div>}
      {entry.trigger && (
        <div className="decision-detail">
          Review {new Date(entry.trigger.dueAt).toLocaleDateString("id-ID")}: {entry.trigger.note}
        </div>
      )}
      <div className="decision-detail">Snapshot: {snapshotLabel(entry)}</div>
      {entry.legacyAction && <div className="decision-detail">Legacy action preserved: {entry.legacyAction}</div>}
      {entry.review ? (
        <div className="decision-review">
          Outcome: <strong>{entry.review.outcome.replaceAll("_", " ")}</strong> /{" "}
          {entry.review.reasoningAssessment.replaceAll("_", " ")}. {entry.review.notes}
        </div>
      ) : reviewing ? (
        <ReviewForm onCancel={onCancelReview} onSave={onSaveReview} />
      ) : (
        <button className="tp-mini-btn" data-qa="decision-review-open" type="button" onClick={onReview}>
          Log outcome review
        </button>
      )}
    </div>
  );
}

function ReviewForm({
  onCancel,
  onSave,
}: {
  onCancel: () => void;
  onSave: (review: Omit<DecisionOutcomeReview, "reviewedAt">) => void;
}) {
  const [outcome, setOutcome] = useState<DecisionOutcomeReview["outcome"]>("unresolved");
  const [reasoningAssessment, setReasoningAssessment] =
    useState<DecisionOutcomeReview["reasoningAssessment"]>("unclear");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!notes.trim()) {
      setError("Review notes are required.");
      return;
    }
    onSave({ outcome, reasoningAssessment, notes });
  }

  return (
    <form className="decision-review-form" onSubmit={submit}>
      <select value={outcome} onChange={(e) => setOutcome(e.target.value as DecisionOutcomeReview["outcome"])}>
        {OUTCOMES.map((item) => (
          <option key={item} value={item}>{item.replaceAll("_", " ")}</option>
        ))}
      </select>
      <select
        value={reasoningAssessment}
        onChange={(e) => setReasoningAssessment(e.target.value as DecisionOutcomeReview["reasoningAssessment"])}
      >
        {REASONING.map((item) => (
          <option key={item} value={item}>{item.replaceAll("_", " ")}</option>
        ))}
      </select>
      <textarea rows={2} placeholder="What actually happened?" value={notes} onChange={(e) => setNotes(e.target.value)} />
      {error && <div className="field-error">{error}</div>}
      <div className="decision-review-actions">
        <button type="submit" className="commit-btn" data-qa="decision-review-save">SAVE REVIEW</button>
        <button type="button" className="tp-mini-btn" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

function snapshotLabel(entry: DecisionEntry): string {
  if (entry.snapshot.kind === "analysis") return "analysis state";
  if (entry.snapshot.kind === "portfolio") return "portfolio state";
  return "legacy decision without snapshot";
}
