import { z } from "zod";

export const submittedTypeEnum = z.enum(["text", "multiple_choice", "rating"]);

export const surveyCreateSchema = z.object({
  title: z.string().min(1).max(200),
});

export const surveyUpdateSchema = z.object({
  title: z.string().min(1).max(200),
});

export const questionSchema = z.object({
  question_text: z.string().min(1).max(1000),
  submitted_type: submittedTypeEnum,
  sequence_order: z.number().int().min(0),
});

export const questionUpdateSchema = z.object({
  question_text: z.string().min(1).max(1000).optional(),
  submitted_type: submittedTypeEnum.optional(),
  sequence_order: z.number().int().min(0).optional(),
});

export const answerInputSchema = z.object({
  question_id: z.number().int().positive(),
  answer_text: z.string().max(1000).nullable().optional(),
  answer_value: z.number().int().min(1).max(5).nullable().optional(),
});

export const responseSubmitSchema = z.object({
  answers: z.array(answerInputSchema).min(1),
});

export function validateAnswers(
  answers: { question_id: number; answer_text?: string | null; answer_value?: number | null }[],
  questions: { question_id: number; submitted_type: string }[],
): string | null {
  const questionMap = new Map(questions.map((q) => [q.question_id, q.submitted_type]));

  if (answers.length !== questions.length) {
    return "Must provide exactly one answer per question";
  }

  for (const answer of answers) {
    const expectedType = questionMap.get(answer.question_id);
    if (!expectedType) {
      return `Question ${answer.question_id} not found in this survey`;
    }

    if (expectedType === "rating") {
      if (answer.answer_value == null || answer.answer_value < 1 || answer.answer_value > 5) {
        return `Rating question ${answer.question_id} requires a value between 1 and 5`;
      }
    } else {
      if (!answer.answer_text || answer.answer_text.trim().length === 0) {
        return `Question ${answer.question_id} requires text input`;
      }
    }
  }

  return null;
}
