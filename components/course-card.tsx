import Link from "next/link";

interface CourseCardProps {
  courseId: number;
  title: string;
  moduleCount: number;
  thumbnailUrl?: string;
  href?: string;
}

export function CourseCard({ courseId, title, moduleCount, thumbnailUrl, href }: CourseCardProps) {
  const linkHref = href || `/courses/${courseId}`;

  return (
    <Link
      href={linkHref}
      className="flex flex-col gap-2.5 rounded-lg border border-border bg-surface p-3 transition-colors hover:bg-surface-hover"
    >
      <div className="flex aspect-video w-full items-center justify-center rounded-md bg-surface-hover">
        {thumbnailUrl ? (
          <img src={thumbnailUrl} alt={title} className="h-full w-full rounded-md object-cover" />
        ) : (
          <span className="material-symbols-rounded text-2xl text-muted-foreground">school</span>
        )}
      </div>
      <h4 className="text-sm font-semibold text-foreground">{title}</h4>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="material-symbols-rounded text-[15px]">menu_book</span>
        {moduleCount} modules
      </div>
    </Link>
  );
}
