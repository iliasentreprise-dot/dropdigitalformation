import { createFileRoute } from "@tanstack/react-router";
import { MaintenanceScreen } from "@/components/dd/MaintenanceScreen";

export const Route = createFileRoute("/maintenance")({
  head: () => ({
    meta: [
      { title: "Ferrucci Système — Transformation en cours" },
      { name: "description", content: "Ferrucci Système évolue en profondeur : programme recréé, logiciels réunis dans un seul écosystème centralisé." },
      { property: "og:title", content: "Ferrucci Système — Transformation en cours" },
      { property: "og:description", content: "Nous construisons quelque chose de plus grand. Une nouvelle génération de Ferrucci Système arrive." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MaintenanceScreen,
});
