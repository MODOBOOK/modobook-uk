import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/dashboard/patients")({
  ssr: false,
  component: () => <Outlet />,
});