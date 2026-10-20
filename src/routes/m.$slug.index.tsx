import { createFileRoute } from "@tanstack/react-router";
import { getPublicClinic } from "@/lib/public-clinic.functions";
import { bookingLayoutOptionsEnabled } from "@/lib/feature-flags";
import { ClinicPage, type ClinicPageData } from "@/components/booking/ClinicPage";

export const Route = createFileRoute("/m/$slug/")({
  validateSearch: (search: Record<string, unknown>): { draft?: true } =>
    search.draft === "1" || search.draft === true ? { draft: true } : {},
  loaderDeps: ({ search }) => ({ draft: search.draft }),
  loader: async ({ params, deps }) =>
    getPublicClinic({ data: { slug: params.slug, draft: deps.draft } }),

  head: ({ params, loaderData }) => ({
    meta: [
      { title: `${loaderData?.profile.clinic_name || "Clinic"} | Book with MODO` },
      { name: "description", content: `Browse treatments and book with ${loaderData?.profile.clinic_name || "this clinic"} on MODO.` },
      { property: "og:title", content: `${loaderData?.profile.clinic_name || "Clinic"} | Book with MODO` },
      { property: "og:description", content: `Browse treatments and book with ${loaderData?.profile.clinic_name || "this clinic"} on MODO.` },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:url", content: `https://modobook.uk/m/${params.slug}` },
    ],
    links: [{ rel: "canonical", href: `https://modobook.uk/m/${params.slug}` }],
  }),
  component: ClinicHomeRoute,
});

function ClinicHomeRoute() {
  const { slug } = Route.useParams();
  const data = Route.useLoaderData() as ClinicPageData;
  const view = bookingLayoutOptionsEnabled(slug) ? "home" : "all";
  return <ClinicPage data={data} view={view} slug={slug} />;
}
