import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Stats = {
  activeStudents: number;
  totalCompletions: number;
  avgCompletionPct: number;
  topModuleTitle: string;
};

type ModuleStat = {
  id: string;
  title: string;
  totalChapters: number;
  startedPct: number;
  fullyCompletedPct: number;
};

export function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [rows, setRows] = useState<ModuleStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [
        { data: modules },
        { data: chapters },
        { data: progress },
        { data: completions },
      ] = await Promise.all([
        supabase.from("modules").select("id, title"),
        supabase.from("chapters").select("id, module_id"),
        supabase.from("user_chapter_progress").select("user_id, chapter_id"),
        supabase.from("module_completions").select("user_id, module_id"),
      ]);

      const mods = modules ?? [];
      const chs = chapters ?? [];
      const prog = progress ?? [];
      const comps = completions ?? [];

      const activeUsers = new Set(prog.map((p: any) => p.user_id));
      const allUsers = new Set([
        ...prog.map((p: any) => p.user_id),
        ...comps.map((c: any) => c.user_id),
      ]);

      // Per module
      const moduleStats: ModuleStat[] = mods.map((m: any) => {
        const moduleChIds = chs.filter((c: any) => c.module_id === m.id).map((c: any) => c.id);
        const totalCh = moduleChIds.length;

        // Users that have at least 1 progress in this module
        const startedUsers = new Set<string>();
        const userCount = new Map<string, number>();
        for (const p of prog as any[]) {
          if (moduleChIds.includes(p.chapter_id)) {
            startedUsers.add(p.user_id);
            userCount.set(p.user_id, (userCount.get(p.user_id) ?? 0) + 1);
          }
        }
        const totalLearners = Math.max(allUsers.size, 1);
        const startedPct = Math.round((startedUsers.size / totalLearners) * 100);

        let fullyDone = 0;
        if (totalCh > 0) {
          for (const cnt of userCount.values()) if (cnt >= totalCh) fullyDone += 1;
        }
        const fullyCompletedPct = Math.round((fullyDone / totalLearners) * 100);

        return {
          id: m.id,
          title: m.title,
          totalChapters: totalCh,
          startedPct,
          fullyCompletedPct,
        };
      });

      moduleStats.sort((a, b) => b.fullyCompletedPct - a.fullyCompletedPct);

      const avgCompletionPct = moduleStats.length
        ? Math.round(
            moduleStats.reduce((acc, m) => acc + m.fullyCompletedPct, 0) /
              moduleStats.length,
          )
        : 0;

      // Top module by completions count
      const compsCount = new Map<string, number>();
      for (const c of comps as any[]) {
        compsCount.set(c.module_id, (compsCount.get(c.module_id) ?? 0) + 1);
      }
      let topId: string | null = null;
      let topN = -1;
      for (const [id, n] of compsCount.entries()) {
        if (n > topN) {
          topN = n;
          topId = id;
        }
      }
      const topModuleTitle =
        (topId && mods.find((m: any) => m.id === topId)?.title) || "—";

      setStats({
        activeStudents: activeUsers.size,
        totalCompletions: prog.length,
        avgCompletionPct,
        topModuleTitle,
      });
      setRows(moduleStats);
      setLoading(false);
    })();
  }, []);

  if (loading || !stats) {
    return <div style={{ color: "#9a7dbd", padding: 20 }}>Chargement des stats…</div>;
  }

  const cards = [
    { icon: "👥", label: "Élèves actifs", value: stats.activeStudents },
    { icon: "✅", label: "Chapitres validés", value: stats.totalCompletions },
    {
      icon: "📈",
      label: "Taux de complétion moyen",
      value: `${stats.avgCompletionPct}%`,
    },
    { icon: "🔥", label: "Module le plus populaire", value: stats.topModuleTitle },
  ];

  return (
    <div style={{ marginBottom: 32 }}>
      <h2 style={{ color: "#fff", fontSize: 18, margin: "0 0 14px" }}>📊 Dashboard</h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
          marginBottom: 20,
        }}
      >
        {cards.map((c) => (
          <div
            key={c.label}
            style={{
              background: "rgba(25,10,48,0.6)",
              border: "1px solid rgba(168,85,247,0.2)",
              borderRadius: 12,
              padding: 16,
            }}
          >
            <div style={{ fontSize: 22 }}>{c.icon}</div>
            <div
              style={{
                fontSize: 11,
                color: "#9a7dbd",
                textTransform: "uppercase",
                letterSpacing: 1,
                margin: "8px 0 4px",
              }}
            >
              {c.label}
            </div>
            <div
              style={{
                fontSize: 22,
                color: "#fff",
                fontWeight: 800,
                wordBreak: "break-word",
              }}
            >
              {c.value}
            </div>
          </div>
        ))}
      </div>

      <h3 style={{ color: "#c4a3f0", fontSize: 14, margin: "0 0 8px" }}>
        Progression par module
      </h3>
      <div
        style={{
          background: "rgba(25,10,48,0.6)",
          border: "1px solid rgba(168,85,247,0.2)",
          borderRadius: 10,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 100px 130px 130px",
            padding: "10px 14px",
            background: "rgba(168,85,247,0.1)",
            fontSize: 11,
            color: "#9a7dbd",
            textTransform: "uppercase",
            letterSpacing: 1,
            fontWeight: 700,
          }}
        >
          <span>Module</span>
          <span style={{ textAlign: "right" }}>Chapitres</span>
          <span style={{ textAlign: "right" }}>% démarré</span>
          <span style={{ textAlign: "right" }}>% complété</span>
        </div>
        {rows.map((r) => (
          <div
            key={r.id}
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 100px 130px 130px",
              padding: "10px 14px",
              borderTop: "1px solid rgba(168,85,247,0.1)",
              fontSize: 13,
              color: "#e2d0ff",
              alignItems: "center",
            }}
          >
            <span>{r.title}</span>
            <span style={{ textAlign: "right" }}>{r.totalChapters}</span>
            <span style={{ textAlign: "right", color: "#a855f7" }}>
              {r.startedPct}%
            </span>
            <span style={{ textAlign: "right", color: "#10b981" }}>
              {r.fullyCompletedPct}%
            </span>
          </div>
        ))}
        {rows.length === 0 && (
          <div style={{ padding: 20, color: "#9a7dbd", textAlign: "center" }}>
            Aucun module
          </div>
        )}
      </div>
    </div>
  );
}
