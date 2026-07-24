"use client";

interface Question {
  id: number;
  authorName: string;
  authorAvatar?: string;
  text: string;
  timestamp: string;
  isNew: boolean;
}

interface QALiveFeedProps {
  questions: Question[];
  newCount: number;
  onAnswer?: (questionId: number) => void;
  onFilter?: () => void;
}

export function QALiveFeed({ questions, newCount, onAnswer, onFilter }: QALiveFeedProps) {
  return (
    <div className="h-[600px] overflow-hidden rounded-xl border border-[#bdc8d0] bg-white shadow-[0_4px_10px_rgba(0,0,0,0.05)]">
      <div className="flex items-center justify-between border-b border-[#bdc8d0] bg-white px-6 py-6">
        <div className="flex items-center gap-2">
          <span className="text-[20px] leading-[30px] text-[#1b1c1c]">Q&A Live Feed</span>
          {newCount > 0 && (
            <span className="rounded-full bg-[#3db9ee] px-2 py-0.5 text-[10px] font-bold text-white">{newCount} NEW</span>
          )}
        </div>
        <button onClick={onFilter} className="p-1">
          <span className="material-symbols-rounded text-[18px] text-[#5f5e5e]">filter_list</span>
        </button>
      </div>

      <div className="flex flex-col gap-4 overflow-y-auto p-4" style={{ height: "calc(600px - 79px)" }}>
        {questions.map((q) => (
          <div
            key={q.id}
            className={`flex flex-col gap-2 rounded-lg border-l-4 bg-[#fbf9f8] p-4 shadow-[0_1px_1px_rgba(0,0,0,0.05)] ${
              q.isNew ? "border-[#3db9ee]" : "border-[#6e7980]"
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                {q.authorAvatar ? (
                  <img src={q.authorAvatar} alt="" className="size-6 overflow-hidden rounded-full bg-[#e4e2e1] object-cover" />
                ) : (
                  <div className="flex size-6 items-center justify-center overflow-hidden rounded-full bg-[#e4e2e1]">
                    <span className="material-symbols-rounded text-[14px] text-[#5f5e5e]">person</span>
                  </div>
                )}
                <span className="text-xs font-bold text-[#1b1c1c]">{q.authorName}</span>
              </div>
              <span className="text-[10px] leading-[15px] text-[#5f5e5e]">{q.timestamp}</span>
            </div>

            <p className={`text-base leading-6 text-[#1b1c1c] ${q.isNew ? "italic" : ""}`}>"{q.text}"</p>

            <div className="pt-1">
              <button
                onClick={() => onAnswer?.(q.id)}
                className="w-full rounded border border-[#3db9ee] py-2 text-xs font-bold text-[#3db9ee]"
              >
                Answer Now
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
