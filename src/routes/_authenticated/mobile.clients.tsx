import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Search, Phone } from "lucide-react";
import { Input } from "@/components/ui/input";
import { listClients } from "@/lib/clients.functions";

export const Route = createFileRoute("/_authenticated/mobile/clients")({
  ssr: false,
  component: MobileClients,
});

function MobileClients() {
  const list = useServerFn(listClients);
  const q = useQuery({ queryKey: ["mobile-clients"], queryFn: () => list() });
  const [term, setTerm] = useState("");

  const clients = useMemo(() => {
    const t = term.trim().toLowerCase();
    const all = (q.data ?? []) as any[];
    if (!t) return all;
    return all.filter(
      (c) =>
        String(c.full_name ?? "").toLowerCase().includes(t) ||
        String(c.email ?? "").toLowerCase().includes(t) ||
        String(c.phone ?? "").toLowerCase().includes(t),
    );
  }, [q.data, term]);

  return (
    <div>
      <h1 className="font-serif text-3xl leading-tight">Clients</h1>

      <div className="relative mt-4">
        <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search name, email or phone"
          className="h-14 pl-12 text-lg"
        />
      </div>

      {q.isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : clients.length === 0 ? (
        <p className="mt-10 text-center text-lg text-muted-foreground">No clients found.</p>
      ) : (
        <ul className="mt-5 space-y-3">
          {clients.map((c) => (
            <li key={c.id} className="flex items-center gap-4 rounded-2xl border bg-card p-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-muted text-lg font-semibold">
                {String(c.full_name ?? "?").trim().charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-lg font-medium">{c.full_name}</div>
                <div className="truncate text-base text-muted-foreground">{c.phone || c.email || "—"}</div>
              </div>
              {c.phone && (
                <a
                  href={`tel:${c.phone}`}
                  aria-label={`Call ${c.full_name}`}
                  className="shrink-0 rounded-full border p-3 text-muted-foreground"
                >
                  <Phone className="h-5 w-5" />
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
