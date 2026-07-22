"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Footer } from "@/components/footer";

interface Answer {
  answer_id: number;
  question_id: number;
  answer_text: string | null;
  answer_value: number | null;
}

interface Response {
  response_id: number;
  USER: { full_name: string; email: string } | null;
  created_at: string;
  SURVEY_ANSWERS: Answer[];
}

interface Question {
  question_id: number;
  question_text: string;
  submitted_type: string;
}

export default function ResponsesPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.id as string;
  const surveyId = params.surveyId as string;
  const [responses, setResponses] = useState<Response[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`/api/surveys/${surveyId}`).then((r) => r.json()),
      fetch(`/api/surveys/${surveyId}/responses`).then((r) => r.json()),
    ]).then(([survey, data]) => {
      setQuestions(survey.SURVEY_QUESTIONS ?? []);
      setResponses(data);
      setLoading(false);
    });
  }, [surveyId]);

  function getQuestionText(questionId: number) {
    return questions.find((q) => q.question_id === questionId)?.question_text ?? "Unknown question";
  }

  function formatAnswer(answer: Answer, questionType?: string) {
    if (questionType === "rating") return answer.answer_value?.toString() ?? "N/A";
    return answer.answer_text ?? "N/A";
  }

  if (loading) return <div>Loading...</div>;

  return (
    <>
    <div>
      <h1>Survey Responses</h1>
      <button onClick={() => router.push(`/events/${eventId}/surveys`)}>&larr; Back</button>

      {responses.length === 0 ? (
        <p>No responses yet.</p>
      ) : (
        <ul>
          {responses.map((r) => (
            <li key={r.response_id}>
              <div>
                <strong>{r.USER?.full_name ?? "Unknown"}</strong>
                <span>{new Date(r.created_at).toLocaleString()}</span>
                <button onClick={() => setExpandedId(expandedId === r.response_id ? null : r.response_id)}>
                  {expandedId === r.response_id ? "Collapse" : "View"}
                </button>
              </div>

              {expandedId === r.response_id && (
                <div>
                  {r.SURVEY_ANSWERS.map((a) => {
                    const q = questions.find((q_) => q_.question_id === a.question_id);
                    return (
                      <div key={a.answer_id}>
                        <p>
                          <strong>{getQuestionText(a.question_id)}</strong>
                        </p>
                        <p>{formatAnswer(a, q?.submitted_type)}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
    <Footer role="facilitator" />
    </>
  );
}
