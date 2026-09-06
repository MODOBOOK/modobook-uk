import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listPatientTermsAcceptances } from "@/lib/memberships.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileCheck2 } from "lucide-react";

type Acceptance = {
  id: string;
  plan_name: string | null;
  terms_text: string | null;
  checkbox_items: Array<{ label: string; agreed?: boolean }> | null;
  accepted_at: string;
};

export function PatientTermsCard({ clientId }: { clientId: string }) {
  const fetchFn = useServerFn(listPatientTermsAcceptances);
  const q = useQuery({
    queryKey: ["patient-terms-acceptances", clientId],
    queryFn: () => fetchFn({ data: { clientId } }),
  });
  const rows = (q.data ?? []) as unknown as Acceptance[];
  if (!rows.length) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileCheck2 className="h-4 w-4" />
          Membership terms agreed
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {rows.map((r) => (
          <div key={r.id} className="rounded-xl border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">{r.plan_name ?? "Membership"}</p>
              <p className="text-xs text-muted-foreground">
                Agreed {new Date(r.accepted_at).toLocaleString("en-GB")}
              </p>
            </div>
            {(r.checkbox_items ?? []).length ? (
              <ul className="mt-2 space-y-1 text-sm">
                {(r.checkbox_items ?? []).map((c, i) => (
                  <li key={i} className={c.agreed === false ? "text-muted-foreground" : ""}>
                    {c.agreed === false ? "○" : "✓"} {c.label}
                  </li>
                ))}
              </ul>
            ) : null}
            {r.terms_text ? (
              <details className="mt-2">
                <summary className="cursor-pointer text-sm underline">View terms wording</summary>
                <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{r.terms_text}</p>
              </details>
            ) : null}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
