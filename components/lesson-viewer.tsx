interface Lesson {
  lesson_id: number;
  description: string;
  content_type: string;
  content_url: string;
  total_units: number;
}

export default function LessonViewer({ lesson }: { lesson: Lesson }) {
  switch (lesson.content_type) {
    case "pdf":
      return <iframe src={lesson.content_url} title={lesson.description} />;
    case "video":
      return <video controls src={lesson.content_url} />;
    case "image":
      return <img src={lesson.content_url} alt={lesson.description} />;
    case "link":
      return (
        <a href={lesson.content_url} target="_blank" rel="noopener noreferrer">
          Open {lesson.description}
        </a>
      );
    default:
      return <p>Unsupported content type: {lesson.content_type}</p>;
  }
}
