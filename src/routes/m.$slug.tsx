import { createFileRoute, Link, Outlet, useParams } from "@tanstack/react-router";
import { getPractitionerBio } from "@/lib/practitioner-public.functions";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/m/$slug")({
  loader: async ({ params }) => {
    const { profile } = await getPractitionerBio({ data: { slug: params.slug } });
    return { profile };
  },
  pendingComponent: () => (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  ),
  notFoundComponent: () => (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <h1 className="text-2xl font-bold">Page not found</h1>
      <p className="mt-2 text-muted-foreground">This MODO link does not exist.</p>
      <Link to="/" className="mt-6"><Button>Go home</Button></Link>
    </div>
  ),
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.profile.clinic_name ?? "Clinic"} · MODO` },
      { name: "description", content: loaderData?.profile.tagline ?? "Book aesthetic treatments on MODO." },
    ],
  }),
  component: ModoLayout,
});

function ModoLayout() {
  const { profile } = Route.useLoaderData();
  const { slug } = useParams({ from: "/m/$slug" });
  const brand = profile.brand_color || "#111827";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4">
          <Link to="/m/$slug" params={{ slug }} className="flex items-center gap-3">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full text-white" style={{ backgroundColor: brand }}>
                <span className="text-lg font-bold">{profile.clinic_name?.charAt(0) || "M"}</span>
              </div>
            )}
            <div>
              <div className="text-sm font-semibold leading-tight">{profile.clinic_name}</div>
              <div className="text-xs text-muted-foreground">{profile.full_name}</div>
            </div>
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <TabLink slug={slug} to="/m/$slug" label="Book" exact />
            <TabLink slug={slug} to="/m/$slug/about" label="About" />
            <TabLink slug={slug} to="/m/$slug/reviews" label="Reviews" />
            <Link to="/m/$slug/account" params={{ slug }}>
              <Button size="sm" variant="outline">My account</Button>
            </Link>
          </nav>
        </div>
      </header>
      <Outlet />
      <footer className="border-t mt-16">
        <div className="mx-auto max-w-5xl px-4 py-6 text-center text-xs text-muted-foreground">
          Powered by <span className="font-semibold tracking-wide">MODO</span>
        </div>
      </footer>
    </div>
  );
}

function TabLink({ slug, to, label, exact }: { slug: string; to: "/m/$slug" | "/m/$slug/about" | "/m/$slug/reviews"; label: string; exact?: boolean }) {
  return (
    <Link
      to={to}
      params={{ slug }}
      activeOptions={{ exact: !!exact }}
      className="rounded-md px-3 py-1.5 text-muted-foreground hover:text-foreground [&.active]:bg-muted [&.active]:text-foreground"
    >
      {label}
    </Link>
  );
}
