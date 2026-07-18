import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/patients/$id/")({
  ssr: false,
  component: PatientIndexRedirect,
});

function PatientIndexRedirect() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  useEffect(() => {
    navigate({ to: "/dashboard/patients/$id/details", params: { id }, replace: true });
  }, [id, navigate]);
  return <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin" /></div>;
}
