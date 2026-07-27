import { Footer } from "@/components/footer";
import { getUpcomingEvents } from "@/lib/landing";
import { PostLoginRedirect } from "@/components/post-login-redirect";
import { LandingContent } from "@/modules/event-management/ui/landing-content";

export default async function HomePage() {
  const events = await getUpcomingEvents();

  return (
    <>
      <PostLoginRedirect />
      <LandingContent initialEvents={events} />
      <Footer role="attendee" />
    </>
  );
}
