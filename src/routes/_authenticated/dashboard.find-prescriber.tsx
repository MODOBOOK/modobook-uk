import { createFileRoute, redirect } from "@tanstack/react-router";

// The Find a Prescriber directory now lives inside the Prescriber Hub so it
// keeps the hub shell and colours. Old links/bookmarks land here and get
// forwarded on.
export const Route = createFileRoute("/_authenticated/dashboard/find-prescriber")({
  ssr: false,
  beforeLoad: () => {
    throw redirect({ to: "/hub/find-prescriber", replace: true });
  },
  component: () => null,
});
