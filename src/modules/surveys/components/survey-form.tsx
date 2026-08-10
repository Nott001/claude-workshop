"use client";

import { useState } from "react";

const STAR_LABELS = ["Poor", "Fair", "Good", "Very good", "Excellent"];

export function StarRating({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={disabled}
          onClick={() => onChange(star)}
          className={disabled ? "cursor-default" : "cursor-pointer transition-transform hover:scale-110"}
          aria-label={`${star} star${star === 1 ? "" : "s"}`}
          aria-pressed={star <= value}
        >
          <span className={`material-symbols-rounded text-4xl ${star <= value ? "text-amber-400" : "text-muted-fg/40"}`}>
            star
          </span>
        </button>
      ))}
    </div>
  );
}

export function SurveyForm({
  eventTitle,
  token,
  readOnly = false,
}: {
  eventTitle: string;
  token?: string;
  readOnly?: boolean;
}) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    if (rating === 0) {
      setError("Please select a rating");
      return;
    }
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/surveys/${token}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating, comment }),
    });
    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "Failed to submit survey");
      setSubmitting(false);
      return;
    }
    setSubmitted(true);
    setSubmitting(false);
  }

  if (submitted) {
    return (
      <div className="text-center">
        <span className="material-symbols-rounded text-5xl text-success">task_alt</span>
        <h2 className="mt-4 text-2xl font-bold text-fg">Thank you for your feedback</h2>
        <p className="mt-2 text-sm text-muted-fg">Your response has been recorded.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <p className="mb-2 text-sm font-medium text-fg">How was your experience at {eventTitle}?</p>
        <StarRating value={rating} onChange={setRating} disabled={readOnly || submitting} />
        {rating > 0 && !readOnly && <p className="mt-1 text-xs text-muted-fg">{STAR_LABELS[rating - 1]}</p>}
      </div>

      <div>
        <label htmlFor="survey-comment" className="mb-2 block text-sm font-medium text-fg">
          Anything else you would like to share?
        </label>
        <textarea
          id="survey-comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          disabled={readOnly || submitting}
          rows={4}
          maxLength={2000}
          placeholder="Optional comment..."
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-muted-fg/60 focus:border-brand focus:outline-none"
        />
      </div>

      {error && <p className="text-sm text-error">{error}</p>}

      {!readOnly && (
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-brand px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand/80 disabled:opacity-50"
        >
          {submitting ? "Submitting..." : "Submit"}
        </button>
      )}
    </form>
  );
}
