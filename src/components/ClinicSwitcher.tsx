import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listMyClinics, type ClinicMembership } from "@/lib/clinic-access.functions";
import { Building2, Check, ChevronsUpDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ROLE_LABEL, type ClinicRole } from "@/lib/staff-nav";

export function ClinicSwitcher() {
  const fetchClinics = useServerFn(listMyClinics);
  const [clinics, setClinics] = useState<ClinicMembership[]>([]);

  useEffect(() => {
    let alive = true;
    fetchClinics()
      .then((rows) => alive && setClinics(rows))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [fetchClinics]);

  if (clinics.length < 2) return null;
  const active = clinics.find((c) => c.active) ?? clinics[0];

  function choose(profileId: string) {
    document.cookie = `modo_clinic=${profileId}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    window.location.reload();
  }

  return (
    <div className="px-4 pt-4">
      <DropdownMenu>
        <DropdownMenuTrigger className="flex w-full items-center gap-2 rounded-lg border border-border/60 bg-background px-3 py-2 text-left text-sm hover:bg-muted/60">
          <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{active.clinicName}</span>
            <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">
              {ROLE_LABEL[active.role as ClinicRole]}
            </span>
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel>Switch clinic</DropdownMenuLabel>
          {clinics.map((c) => (
            <DropdownMenuItem key={c.profileId} onClick={() => choose(c.profileId)}>
              <span className="min-w-0 flex-1">
                <span className="block truncate">{c.clinicName}</span>
                <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">
                  {ROLE_LABEL[c.role as ClinicRole]}
                </span>
              </span>
              {c.active && <Check className="ml-2 h-4 w-4" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
