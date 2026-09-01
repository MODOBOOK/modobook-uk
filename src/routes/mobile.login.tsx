import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/mobile/login")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Practitioner sign in | MODO Mobile" },
      { name: "description", content: "Sign in to the MODO practitioner mobile app to see today's diary, bookings and clients." },
      { property: "og:title", content: "Practitioner sign in | MODO Mobile" },
      { property: "og:description", content: "Sign in to the MODO practitioner mobile app to see today's diary, bookings and clients." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MobileLogin,
});

function MobileLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    navigate({ to: "/mobile", replace: true });
  }

  return (
    <div className="flex min-h-screen flex-col justify-between bg-background px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-16">
      <div>
        <BrandMark className="h-10" />
        <h1 className="mt-10 font-serif text-4xl leading-tight">Welcome back</h1>
        <p className="mt-2 text-lg text-muted-foreground">Sign in to your clinic day.</p>

        <form onSubmit={onSubmit} className="mt-10 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-base">Email</Label>
            <Input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-14 text-lg"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password" className="text-base">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-14 text-lg"
            />
          </div>
          <Button type="submit" disabled={loading} className="h-14 w-full text-lg">
            {loading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
            Sign in
          </Button>
        </form>
      </div>

      <p className="mt-10 text-center text-base text-muted-foreground">
        Need the full desktop tools?{" "}
        <Link to="/auth" className="font-medium text-foreground underline">
          Open MODO web
        </Link>
      </p>
    </div>
  );
}
