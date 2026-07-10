"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";

export default function NewSurveyPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.id as string;
  const [title, setTitle] = useState("");
  const [questions, setQuestions] = useState<{ question_text: string; submitted_type: string }[]>([]);
  const [saving, setSaving] = useState(false);

  function addQuestion() {
    setQuestions([...questions, { question_text: "", submitted_type: "text" }]);
  }

  function updateQuestion(index: number, field: string, value: string) {
    const updated = [...questions];
    (updated[index] as Record<string, string>)[field] = value;
    setQuestions(updated);
  }

  function removeQuestion(index: number) {
    setQuestions(questions.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || questions.length === 0 || saving) return;
    setSaving(true);

    const res = await fetch(`/api/events/${eventId}/surveys`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim() }),
    });
    if (!res.ok) return;
    const survey = await res.json();

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      await fetch(`/api/surveys/${survey.survey_id}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question_text: q.question_text,
          submitted_type: q.submitted_type,
          sequence_order: i,
        }),
      });
    }

    setSaving(false);
    router.push(`/events/${eventId}/surveys`);
  }

  return (
    <div>
      <h1>Create Survey</h1>
      <form onSubmit={handleSubmit}>
        <div>
          <label>Title</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
        </div>

        <h2>Questions</h2>
        {questions.map((q, i) => (
          <div key={i}>
            <input
              type="text"
              value={q.question_text}
              onChange={(e) => updateQuestion(i, "question_text", e.target.value)}
              placeholder="Question text"
              maxLength={1000}
            />
            <select value={q.submitted_type} onChange={(e) => updateQuestion(i, "submitted_type", e.target.value)}>
              <option value="text">Text</option>
              <option value="multiple_choice">Multiple Choice</option>
              <option value="rating">Rating (1-5)</option>
            </select>
            <button type="button" onClick={() => removeQuestion(i)}>
              Remove
            </button>
          </div>
        ))}
        <button type="button" onClick={addQuestion}>
          Add Question
        </button>

        <button type="submit" disabled={saving || !title.trim() || questions.length === 0}>
          {saving ? "Saving..." : "Create Survey"}
        </button>
      </form>

      <button onClick={() => router.push(`/events/${eventId}/surveys`)}>&larr; Cancel</button>
    </div>
  );
}
