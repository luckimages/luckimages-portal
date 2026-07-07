import { redirect } from "next/navigation";

// This page's job (browsing historical activity by day/month) now lives on
// the Calendar app, which has the same day-click detail view plus proper
// category filtering. The Command Center itself moved to /dashboard/updates.
export default function AdminUpdatesRedirect() {
  redirect("/dashboard/calendar");
}
