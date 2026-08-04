import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BrandMark } from "@/components/BrandMark";
import ReactMarkdown from "react-markdown";

export const Route = createFileRoute("/terms")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Terms & Conditions | MODO BOOK" },
      { name: "description", content: "MODO BOOK platform terms and conditions for practitioners." },
      { property: "og:title", content: "Terms & Conditions | MODO BOOK" },
      { property: "og:description", content: "MODO BOOK platform terms and conditions for practitioners." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://modobook.uk/terms" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://modobook.uk/terms" }],
  }),
  component: TermsPage,
});

type TermsRow = {
  id: string;
  version: number;
  title: string;
  body_markdown: string;
  effective_at: string;
};

function TermsPage() {
  const [terms, setTerms] = useState<TermsRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("platform_terms")
        .select("id, version, title, body_markdown, effective_at")
        .eq("is_active", true)
        .maybeSingle();
      if (error) { setError(error.message); return; }
      setTerms(data as TermsRow | null);
    })();
  }, []);

  return (
    <div className="min-h-screen bg-muted/40 py-12 px-4">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex justify-center">
          <BrandMark size="lg" />
        </div>
        <div className="rounded-2xl border bg-card p-6 shadow-sm sm:p-10">
          {error && (
            <p className="text-sm text-destructive">Failed to load terms: {error}</p>
          )}
          {!error && !terms && (
            <p className="text-sm text-muted-foreground">Loading terms…</p>
          )}
          {terms && (
            <>
              <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                Version {terms.version} · Effective {new Date(terms.effective_at).toLocaleDateString()}
              </p>
              <article className="prose prose-sm sm:prose-base max-w-none [&_h1]:mt-0 [&_h2]:mt-8 [&_h3]:mt-6 [&_p]:leading-relaxed">
                <ReactMarkdown>{terms.body_markdown}</ReactMarkdown>
              </article>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
