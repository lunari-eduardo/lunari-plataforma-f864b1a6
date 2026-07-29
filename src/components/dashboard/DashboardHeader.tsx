import { useUserProfile } from "@/hooks/useUserProfile";
import { NextAppointmentCard } from "./NextAppointmentCard";

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export function DashboardHeader() {
  const { profile } = useUserProfile();
  const name = profile?.nome?.split(" ")[0] || "";
  const greeting = getGreeting();

  const weekdayFmt = new Intl.DateTimeFormat("pt-BR", { weekday: "long" });
  const dayFmt = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
  });
  const now = new Date();
  const weekday = weekdayFmt.format(now);
  const dayMonth = dayFmt.format(now);

  return (
    <section
      aria-label="Resumo do dia"
      className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"
    >
      <div className="min-w-0">
        <h1 className="font-heading text-xl font-medium tracking-tight text-foreground sm:text-2xl">
          {greeting}
          {name ? `, ${name}` : ""}
        </h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          <span className="capitalize">{weekday}</span>, {dayMonth}
        </p>
      </div>

      <NextAppointmentCard />
    </section>
  );
}
