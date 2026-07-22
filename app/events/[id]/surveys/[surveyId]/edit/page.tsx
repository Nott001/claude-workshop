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

export default function EditSurveyPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.id as string;
  const surveyId = params.surveyId as string;
  const [title, setTitle] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/surveys/${surveyId}`)
      .then((r) => r.json())
      .then((data) => {
        setTitle(data.title);
        setQuestions(data.SURVEY_QUESTIONS ?? []);
        setLoading(false);
      });
  }, [surveyId]);

  async function handleSaveTitle() {
    await fetch(`/api/surveys/${surveyId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
  }

  async function handleAddQuestion() {
    const res = await fetch(`/api/surveys/${surveyId}/questions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question_text: "New question",
        submitted_type: "text",
        sequence_order: questions.length,
      }),
    });
    if (res.ok) {
      const q = await res.json();
      setQuestions([...questions, q]);
    }
  }

  async function handleUpdateQuestion(questionId: number, field: string, value: string) {
    const res = await fetch(`/api/surveys/${surveyId}/questions/${questionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    if (res.ok) {
      setQuestions(questions.map((q) => (q.question_id === questionId ? { ...q, [field]: value } : q)));
    }
  }

  async function handleDeleteQuestion(questionId: number) {
    const res = await fetch(`/api/surveys/${surveyId}/questions/${questionId}`, { method: "DELETE" });
    if (res.ok) {
      setQuestions(questions.filter((q) => q.question_id !== questionId));
    }
  }

  if (loading) return <div>Loading...</div>;

  return (
    <>
    <div>
      <h1>Edit Survey</h1>

      <div>
        <label>Title</label>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
        <button onClick={handleSaveTitle}>Save Title</button>
      </div>

      <h2>Questions</h2>
      {questions.map((q) => (
        <div key={q.question_id}>
          <input
            type="text"
            value={q.question_text}
            onChange={(e) => handleUpdateQuestion(q.question_id, "question_text", e.target.value)}
          />
          <select
            value={q.submitted_type}
            onChange={(e) => handleUpdateQuestion(q.question_id, "submitted_type", e.target.value)}
          >
            <option value="text">Text</option>
            <option value="multiple_choice">Multiple Choice</option>
            <option value="rating">Rating (1-5)</option>
          </select>
          <button onClick={() => handleDeleteQuestion(q.question_id)}>Delete</button>
        </div>
      ))}
      <button onClick={handleAddQuestion}>Add Question</button>

      <button onClick={() => router.push(`/events/${eventId}/surveys`)}>&larr; Back</button>
    </div>
    <Footer role="facilitator" />
    </>
  );
}
