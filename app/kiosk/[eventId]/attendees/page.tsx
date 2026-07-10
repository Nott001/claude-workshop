"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { subscribeToCheckins } from "@/lib/realtime";

interface Attendee {
  full_name: string;
  email: string;
  checked_in_at: string;
}

export default function AttendeesPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.eventId as string;
  const { isLoaded, isSignedIn } = useUser();
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        setUserRole(data.role);
        if (data.role !== "facilitator") {
          router.push("/");
        }
      });
  }, [isLoaded, isSignedIn, router]);

  useEffect(() => {
    let ignore = false;
    fetch(`/api/checkin/${eventId}/attendees`)
      .then((r) => r.json())
      .then((data) => {
        if (!ignore) {
          setAttendees(data);
          setLoading(false);
        }
      });
    return () => {
      ignore = true;
    };
  }, [eventId]);

  useEffect(() => {
    if (!eventId) return;

    const sub = subscribeToCheckins(Number(eventId), () => {
      fetch(`/api/checkin/${eventId}/attendees`)
        .then((r) => r.json())
        .then((data) => setAttendees(data));
    });

    return () => {
      sub.unsubscribe();
    };
  }, [eventId]);

  if (userRole !== "facilitator") return null;

  return (
    <div>
      <h1>Checked-in Attendees</h1>
      <button onClick={() => router.push("/kiosk")}>&larr; Back to Scanner</button>

      {loading ? (
        <p>Loading...</p>
      ) : attendees.length === 0 ? (
        <p>No attendees checked in yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Checked In At</th>
            </tr>
          </thead>
          <tbody>
            {attendees.map((a, i) => (
              <tr key={i}>
                <td>{a.full_name}</td>
                <td>{a.email}</td>
                <td>{new Date(a.checked_in_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}