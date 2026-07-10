import { describe, it, expect } from "vitest";
import {
  surveyCreateSchema,
  surveyUpdateSchema,
  questionSchema,
  questionUpdateSchema,
  responseSubmitSchema,
  validateAnswers,
  submittedTypeEnum,
} from "@/modules/surveys";

describe("submittedTypeEnum", () => {
  it("accepts valid types", () => {
    expect(submittedTypeEnum.safeParse("text").success).toBe(true);
    expect(submittedTypeEnum.safeParse("multiple_choice").success).toBe(true);
    expect(submittedTypeEnum.safeParse("rating").success).toBe(true);
  });

  it("rejects invalid type", () => {
    expect(submittedTypeEnum.safeParse("boolean").success).toBe(false);
  });
});

describe("surveyCreateSchema", () => {
  it("accepts valid title", () => {
    const result = surveyCreateSchema.safeParse({ title: "Event Feedback" });
    expect(result.success).toBe(true);
  });

  it("rejects empty title", () => {
    expect(surveyCreateSchema.safeParse({ title: "" }).success).toBe(false);
  });

  it("rejects missing title", () => {
    expect(surveyCreateSchema.safeParse({}).success).toBe(false);
  });
});

describe("surveyUpdateSchema", () => {
  it("accepts valid title", () => {
    expect(surveyUpdateSchema.safeParse({ title: "Updated Title" }).success).toBe(true);
  });
});

describe("questionSchema", () => {
  it("accepts valid question", () => {
    const result = questionSchema.safeParse({
      question_text: "How was the event?",
      submitted_type: "text",
      sequence_order: 0,
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing question_text", () => {
    const result = questionSchema.safeParse({ submitted_type: "text", sequence_order: 0 });
    expect(result.success).toBe(false);
  });
});

describe("questionUpdateSchema", () => {
  it("accepts partial update", () => {
    const result = questionUpdateSchema.safeParse({ question_text: "Updated question" });
    expect(result.success).toBe(true);
  });
});

describe("responseSubmitSchema", () => {
  it("accepts valid answers", () => {
    const result = responseSubmitSchema.safeParse({
      answers: [{ question_id: 1, answer_text: "Great!" }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty answers", () => {
    const result = responseSubmitSchema.safeParse({ answers: [] });
    expect(result.success).toBe(false);
  });
});

describe("validateAnswers", () => {
  const questions = [
    { question_id: 1, submitted_type: "text" },
    { question_id: 2, submitted_type: "rating" },
    { question_id: 3, submitted_type: "multiple_choice" },
  ];

  it("returns null for valid answers", () => {
    const result = validateAnswers(
      [
        { question_id: 1, answer_text: "Good event" },
        { question_id: 2, answer_value: 4 },
        { question_id: 3, answer_text: "Option A" },
      ],
      questions,
    );
    expect(result).toBeNull();
  });

  it("returns error for wrong answer count", () => {
    const result = validateAnswers([{ question_id: 1, answer_text: "Good" }], questions);
    expect(result).toBe("Must provide exactly one answer per question");
  });

  it("returns error for unknown question_id", () => {
    const result = validateAnswers(
      [
        { question_id: 99, answer_text: "Hmm" },
        { question_id: 2, answer_value: 3 },
        { question_id: 3, answer_text: "B" },
      ],
      questions,
    );
    expect(result).toContain("not found");
  });

  it("returns error for rating out of range", () => {
    const result = validateAnswers(
      [
        { question_id: 1, answer_text: "Good" },
        { question_id: 2, answer_value: 6 },
        { question_id: 3, answer_text: "B" },
      ],
      questions,
    );
    expect(result).toContain("value between 1 and 5");
  });

  it("returns error for missing text answer", () => {
    const result = validateAnswers(
      [
        { question_id: 1, answer_text: "" },
        { question_id: 2, answer_value: 3 },
        { question_id: 3, answer_text: "B" },
      ],
      questions,
    );
    expect(result).toContain("requires text input");
  });
});
