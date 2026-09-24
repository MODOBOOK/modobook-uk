import { createFileRoute, redirect } from "@tanstack/react-router";
import { getPublicClinic } from "@/lib/public-clinic.functions";
import { bookingLayoutOptionsEnabled } from "@/lib/feature-flags";
import { ClinicPage, type ClinicPageData } from "@/components/booking/ClinicPage";

export const Route = createFileRoute("/m/$slug/book/")({
  validateSearch: (search: Record<string, unknown>): { draft?: true } =>
    search.draft === "1" || search.draft === true ? { draft: true } : {},
  loaderDeps: ({ search }) => ({ draft: search.draft }),
  beforeLoad: ({ params }) => {
    // Split home/book pages are a pilot feature; other clinics keep the
    // single-page layout, so send their visitors back to the main page.
    if (!bookingLayoutOptionsEnabled(params.slug)) {
      throw redirect({ to: "/m/$slug", params: { slug: params.slug } });
    }
  },
  loader: async ({ params, deps }) =>
    getPublicClinic({ data: { slug: params.slug, draft: deps.draft } }),

  head: ({ params }) => ({
    meta: [
      { property: "og:url", content: `https://modobook.uk/m/${params.slug}/book` },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: `https://modobook.uk/m/${params.slug}` }],
  }),
  component: ClinicBookRoute,
});

function ClinicBookRoute() {
  const { slug } = Route.useParams();
  const data = Route.useLoaderData() as ClinicPageData;
  return <ClinicPage data={data} view="book" slug={slug} />;
}
