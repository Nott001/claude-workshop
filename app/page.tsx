import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  ChevronRight,
  Clock3,
  Globe2,
  Home,
  MapPin,
  MessageCircle,
  Play,
  Sparkles,
  UsersRound,
  Users,
} from "lucide-react";

import { upcomingEvents } from "@/lib/landing";

const navItems = [
  { label: "Home", href: "/", icon: Home },
  { label: "Events", href: "#upcoming-events", icon: CalendarDays },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#fbf9f8] text-[#1b1c1c]">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[202px] flex-col border-r border-[#bdc8d0] bg-white px-5 py-7 lg:flex">
        <Link href="/" className="flex items-center gap-2 text-[17px] font-bold tracking-[-0.02em]">
          <span className="grid size-8 place-items-center rounded-lg bg-[#3db9ee] text-white">
            <Sparkles className="size-[18px]" />
          </span>
          StartupLab
        </Link>
        <nav className="mt-12 space-y-2" aria-label="Primary navigation">
          {navItems.map(({ label, href, icon: Icon }) => (
            <Link
              key={label}
              href={href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${label === "Home" ? "bg-[#e8f8fe] text-[#1789b8]" : "text-[#647078] hover:bg-[#f4f7f8] hover:text-[#1b1c1c]"}`}
            >
              <Icon className="size-[18px]" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto space-y-3">
          <Link
            href="/sign-in"
            className="block rounded-lg border border-[#bdc8d0] py-2.5 text-center text-xs font-semibold tracking-[0.04em] transition hover:border-[#3db9ee] hover:text-[#1789b8]"
          >
            SIGN IN
          </Link>
          <Link
            href="/sign-up"
            className="block rounded-lg bg-[#3db9ee] py-2.5 text-center text-xs font-semibold tracking-[0.04em] text-white transition hover:bg-[#239dce]"
          >
            SIGN UP
          </Link>
        </div>
      </aside>
      <div className="lg:pl-[202px]">
        <section className="relative overflow-hidden rounded-b-[40px] bg-[#3db9ee] px-6 py-10 sm:px-12 lg:px-16 lg:py-8">
          <div className="absolute inset-0 opacity-25 [background-image:radial-gradient(white_1px,transparent_1px)] [background-size:24px_24px]" />
          <div className="relative mx-auto grid max-w-[1110px] items-center gap-10 lg:min-h-[427px] lg:grid-cols-[1.1fr_.8fr] lg:gap-12">
            <div>
              <p className="mb-3 text-sm font-semibold tracking-[0.16em] text-white/80 uppercase">Learn. Connect. Grow.</p>
              <h1 className="max-w-xl text-4xl font-bold tracking-[-0.04em] text-white sm:text-5xl lg:text-6xl lg:leading-[1.12]">
                StartupLab
                <br />
                Business Center
              </h1>
              <p className="mt-5 max-w-[576px] text-base leading-7 text-white/90 sm:text-lg">
                Unlock the opportunities of the business era by equipping yourself with the knowledge and skills to harness
                artificial intelligence effectively for growth and innovation.
              </p>
              <Link
                href="/sign-up"
                className="mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-8 py-4 text-base font-bold text-[#3db9ee] shadow-lg shadow-sky-900/10 transition hover:-translate-y-0.5"
              >
                Join Now <ArrowRight className="size-[18px]" />
              </Link>
            </div>
            <div className="relative mx-auto w-full max-w-[448px] overflow-hidden rounded-3xl border border-white/40 bg-white/40 p-1 shadow-2xl shadow-sky-950/20 backdrop-blur-sm">
              <div className="relative flex aspect-[1.85] items-end overflow-hidden rounded-[20px] bg-gradient-to-br from-[#153d64] via-[#1b7295] to-[#5dd3e7] p-6">
                <div className="absolute inset-x-0 top-0 h-2/3 bg-[radial-gradient(circle_at_40%_0%,rgba(255,255,255,.5),transparent_42%)]" />
                <div className="relative w-full rounded-2xl border border-white/25 bg-slate-950/30 p-4 text-white backdrop-blur-md">
                  <div className="flex items-center justify-between text-xs font-medium text-white/80">
                    <span>Claude Workshop</span>
                    <span>Live session</span>
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <span className="grid size-10 place-items-center rounded-full bg-white text-[#269fcf]">
                      <Play className="ml-0.5 size-4 fill-current" />
                    </span>
                    <span className="text-sm font-semibold">Build with AI, together</span>
                  </div>
                </div>
                <span className="absolute left-1/2 top-1/2 grid size-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-[#3db9ee] shadow-lg">
                  <Play className="ml-0.5 size-5 fill-current" />
                </span>
              </div>
            </div>
          </div>
        </section>
        <section id="upcoming-events" className="bg-white px-6 py-20 sm:px-12 lg:px-16">
          <div className="mx-auto max-w-[1110px]">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-semibold tracking-[-0.03em] sm:text-[32px]">Upcoming Events</h2>
              <p className="mt-4 text-base leading-6 text-[#3e484f]">
                Live workshops and networking events designed to keep you at the forefront of business innovation.
              </p>
            </div>
            <div className="mt-12 grid gap-6 lg:grid-cols-2">
              {upcomingEvents.map((event, index) => (
                <article
                  key={event.title}
                  className="overflow-hidden rounded-xl border border-[#bdc8d0] bg-white shadow-[0_4px_20px_rgba(0,0,0,.05)]"
                >
                  <div className={`relative h-48 bg-gradient-to-br ${event.accent} p-6 text-white`}>
                    <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent_20%,rgba(255,255,255,.2)_20%,transparent_21%)] [background-size:28px_28px] opacity-50" />
                    <span className="relative inline-flex items-center gap-2 rounded-full border border-white/35 bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur-sm">
                      <Sparkles className="size-3.5" /> {event.type}
                    </span>
                    <div className="relative mt-9 flex items-center gap-3 text-white/95">
                      <span className="grid size-10 place-items-center rounded-xl bg-white/20">
                        <Users className="size-5" />
                      </span>
                      <span className="text-sm font-medium">StartupLab {index === 0 ? "Workshop Series" : "Community"}</span>
                    </div>
                  </div>
                  <div className="p-6">
                    <h3 className="text-2xl font-semibold tracking-[-0.02em]">{event.title}</h3>
                    <div className="mt-4 space-y-2 text-sm text-[#526069]">
                      <p className="flex items-center gap-2">
                        <CalendarDays className="size-4 text-[#3db9ee]" /> {event.date}
                      </p>
                      <p className="flex items-center gap-2">
                        <Clock3 className="size-4 text-[#3db9ee]" /> {event.time}
                      </p>
                      <p className="flex items-center gap-2">
                        <MapPin className="size-4 text-[#3db9ee]" /> StartupLab Business Center
                      </p>
                    </div>
                    <Link
                      href="/sign-up"
                      className="mt-6 inline-flex items-center gap-1 text-sm font-semibold text-[#168cb9] hover:underline"
                    >
                      Reserve your place <ChevronRight className="size-4" />
                    </Link>
                  </div>
                </article>
              ))}
            </div>
            <div className="mt-12 text-center">
              <Link
                href="/events"
                className="inline-flex items-center gap-2 rounded-xl border border-[#3db9ee] px-8 py-3 text-sm font-semibold text-[#168cb9] transition hover:bg-[#effaff]"
              >
                See All Upcoming Events <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
        </section>
        <footer className="border-t border-[#bdc8d0] bg-white px-6 py-12 sm:px-12 lg:px-16">
          <div className="mx-auto flex max-w-[1110px] flex-col gap-12 md:flex-row md:justify-between">
            <div className="max-w-xs">
              <div className="flex items-center gap-3 text-2xl font-bold tracking-[-0.03em]">
                <span className="grid size-8 place-items-center rounded-lg bg-[#3db9ee] text-white">
                  <Sparkles className="size-[18px]" />
                </span>
                StartupLab
              </div>
              <p className="mt-5 text-sm leading-5 text-[#3e484f]">
                Empowering the next generation of business leaders through AI-driven innovation and education.
              </p>
            </div>
            <div className="flex gap-16">
              <div>
                <h2 className="font-bold">Company</h2>
                <div className="mt-4 space-y-2 text-sm text-[#3e484f]">
                  <a href="#about" className="block hover:text-[#1789b8]">
                    About Us
                  </a>
                  <a href="mailto:hello@startuplab.example" className="block hover:text-[#1789b8]">
                    Contact
                  </a>
                </div>
              </div>
              <div>
                <h2 className="font-bold">Connect</h2>
                <div className="mt-4 flex gap-4 text-[#3e484f]">
                  <a href="#website" aria-label="Website">
                    <Globe2 className="size-5" />
                  </a>
                  <a href="#community" aria-label="Community">
                    <UsersRound className="size-5" />
                  </a>
                  <a href="#contact" aria-label="Contact">
                    <MessageCircle className="size-5" />
                  </a>
                </div>
              </div>
            </div>
          </div>
          <div className="mx-auto mt-12 max-w-[1110px] border-t border-[#bdc8d0] pt-6 text-xs text-[#607079]">
            © 2026 StartupLab Business Center. All rights reserved.
          </div>
        </footer>
      </div>
    </main>
  );
}
