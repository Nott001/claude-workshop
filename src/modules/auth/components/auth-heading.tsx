/** The centred title and one line of orientation each card page opens with. */
export function AuthHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="text-center">
      <h2 className="text-[2rem] leading-10 font-semibold tracking-[-0.01em] text-fg">{title}</h2>
      <p className="mt-2 text-base text-muted-fg">{subtitle}</p>
    </div>
  );
}
