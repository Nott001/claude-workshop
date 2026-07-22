"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Footer } from "@/components/footer";

interface Question {
  question_id: number;
  question_text: string;
  submitted_type: string;
  sequence_order: number;
}

interface Survey {
  survey_id: number;
  title: string;
  SURVEY_QUESTIONS: Question[];
}

export default function SurveyFormPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.id as string;
  const surveyId = params.surveyId as string;
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [answers, setAnswers] = useState<Record<number, { text?: string; value?: number }>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);

  useEffect(() => {
    fetch(`/api/surveys/${surveyId}`)
      .then((r) => r.json())
      .then((data) => {
        setSurvey(data);
        setLoading(false);
      });
  }, [surveyId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!survey || submitting) return;
    setSubmitting(true);
    setError(null);

    const answersPayload = survey.SURVEY_QUESTIONS.map((q) => {
      const a = answers[q.question_id] ?? {};
      return {
        question_id: q.question_id,
        answer_text: q.submitted_type === "rating" ? null : (a.text ?? ""),
        answer_value: q.submitted_type === "rating" ? (a.value ?? null) : null,
      };
    });

    const res = await fetch(`/api/surveys/${surveyId}/responses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers: answersPayload }),
    });

    if (res.status === 409) {
      setAlreadySubmitted(true);
      setSubmitting(false);
      return;
    }

    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "Failed to submit");
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    router.push(`/events/${eventId}/surveys/${surveyId}/confirmed`);
  }

  if (alreadySubmitted) {
    return (
      <div>
        <h1>Already Submitted</h1>
        <p>You have already submitted this survey.</p>
        <button onClick={() => router.push(`/events/${eventId}/surveys`)}>Back to Surveys</button>
      </div>
    );
  }

  if (loading) return <div>Loading survey...</div>;
  if (!survey) return <div>Survey not found</div>;

  return (
    <>
    <div>
      <h1>{survey.title}</h1>
      <form onSubmit={handleSubmit}>
        {survey.SURVEY_QUESTIONS.map((q) => (
          <div key={q.question_id}>
            <p>
              <strong>{q.question_text}</strong>
              {q.submitted_type === "rating" && <span> (1-5)</span>}
            </p>

            {q.submitted_type === "text" && (
              <textarea
                value={answers[q.question_id]?.text ?? ""}
                onChange={(e) => setAnswers({ ...answers, [q.question_id]: { text: e.target.value } })}
                maxLength={1000}
              />
            )}

            {q.submitted_type === "multiple_choice" && (
              <input
                type="text"
                value={answers[q.question_id]?.text ?? ""}
                onChange={(e) => setAnswers({ ...answers, [q.question_id]: { text: e.target.value } })}
                placeholder="Your answer"
                maxLength={1000}
              />
            )}

            {q.submitted_type === "rating" && (
              <select
                value={answers[q.question_id]?.value ?? ""}
                onChange={(e) =>
                  setAnswers({ ...answers, [q.question_id]: { value: e.target.value ? Number(e.target.value) : undefined } })
                }
              >
                <option value="">Select...</option>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            )}
          </div>
        ))}

        {error && <p>{error}</p>}

        <button type="submit" disabled={submitting}>
          {submitting ? "Submitting..." : "Submit Survey"}
        </button>
      </form>

      <button onClick={() => router.push(`/events/${eventId}/surveys`)}>&larr; Back</button>
    </div>
    <Footer role="facilitator" />
    </>
  );
}
