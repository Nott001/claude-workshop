// Facade for the event service. Each concern lives in its own file below; the
// public names and their import sites are unchanged, so splitting the file did
// not touch any caller.
export * from "@/modules/events/lib/event-errors";
export * from "@/modules/events/lib/event-authz";
export * from "@/modules/events/lib/event-crud";
export * from "@/modules/events/lib/event-delete";
export * from "@/modules/events/lib/event-registration";
export * from "@/modules/events/lib/event-attendees";
