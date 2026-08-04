import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

const BASE_URL = "https://modobook.uk";

interface SitemapEntry {
  path: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

const STATIC_ENTRIES: SitemapEntry[] = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/features", changefreq: "monthly", priority: "0.9" },
  { path: "/pricing", changefreq: "monthly", priority: "0.9" },
  { path: "/who-its-for", changefreq: "monthly", priority: "0.8" },
  { path: "/prescriber-hub", changefreq: "monthly", priority: "0.8" },
  { path: "/rewards", changefreq: "monthly", priority: "0.7" },
  { path: "/faq", changefreq: "monthly", priority: "0.7" },
  { path: "/terms", changefreq: "yearly", priority: "0.3" },
  { path: "/privacy", changefreq: "yearly", priority: "0.3" },
  { path: "/privacy/cookies", changefreq: "yearly", priority: "0.2" },
  { path: "/privacy/dpa", changefreq: "yearly", priority: "0.2" },
  { path: "/privacy/retention", changefreq: "yearly", priority: "0.2" },
  { path: "/privacy/complaints", changefreq: "yearly", priority: "0.2" },
  { path: "/privacy/acceptable-use", changefreq: "yearly", priority: "0.2" },
  { path: "/privacy/breach-response", changefreq: "yearly", priority: "0.2" },
  { path: "/privacy/dpia", changefreq: "yearly", priority: "0.2" },
];

async function fetchClinicSlugs(): Promise<string[]> {
  const url = process.env["VITE_SUPABASE_URL"] ?? process.env["SUPABASE_URL"];
  const key =
    process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ??
    process.env["SUPABASE_PUBLISHABLE_KEY"] ??
    process.env["SUPABASE_ANON_KEY"];
  if (!url || !key) return [];

  try {
    const res = await fetch(
      `${url}/rest/v1/profiles?select=slug&slug=not.is.null&limit=5000`,
      { headers: { apikey: key, Accept: "application/json" } },
    );
    if (!res.ok) return [];
    const rows = (await res.json()) as Array<{ slug: string | null }>;
    return rows.map((r) => r.slug).filter((s): s is string => Boolean(s));
  } catch {
    return [];
  }
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const slugs = await fetchClinicSlugs();
        const entries: SitemapEntry[] = [
          ...STATIC_ENTRIES,
          ...slugs.flatMap((slug) => [
            { path: `/m/${slug}`, changefreq: "weekly" as const, priority: "0.8" },
            { path: `/m/${slug}/about`, changefreq: "monthly" as const, priority: "0.5" },
            { path: `/m/${slug}/reviews`, changefreq: "weekly" as const, priority: "0.5" },
          ]),
        ];

        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${BASE_URL}${e.path}</loc>`,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            `  </url>`,
          ]
            .filter(Boolean)
            .join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
