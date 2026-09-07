import { createFileRoute } from "@tanstack/react-router";
import { FindPrescriberPage } from "@/components/prescribing/FindPrescriberPage";

export const Route = createFileRoute("/_authenticated/hub/find-prescriber")({
  ssr: false,
  component: FindPrescriberPage,
});
