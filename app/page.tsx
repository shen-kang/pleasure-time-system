"use client";

import { addDays, endOfDay, format, isAfter, isSameDay, parseISO, startOfMonth, startOfWeek, startOfYear } from "date-fns";
import { Activity, BarChart3, Clock3, Flame, Plus, Trash2, WalletCards, Wifi, WifiOff } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getProfileId, hasSupabaseConfig, supabase } from "@/lib/supabase";
import { ActivityRecord, categories, Category, EntertainmentSpend, Period } from "@/lib/types";

const recordStorageKey = "pleasure-time-records";
const spendStorageKey = "pleasure-time-spends";
const colorByCategory: Record<Category, string> = {
  投资: "#0EA5A4",
  套利: "#F9735B",
  健身: "#16A34A",
  羽毛球: "#2563EB",
  阅读: "#D9467A"
};

function readLocal<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  const value = window.localStorage.getItem(key);
  return value ? (JSON.parse(value) as T) : fallback;
}

function decimalHours(hours: number, minutes: number) {
  return hours + minutes / 60;
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

function periodStart(period: Period) {
  const now = new Date();
  if (period === "week") return startOfWeek(now, { weekStartsOn: 1 });
  if (period === "month") return startOfMonth(now);
  return startOfYear(now);
}

function chartLabel(date: Date, period: Period) {
  if (period === "week") return ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][date.getDay()];
  if (period === "month") return format(date, "MM/dd");
  return format(date, "MM月");
}

export default function Home() {
  const [profileId, setProfileId] = useState("local-demo");
  const [records, setRecords] = useState<ActivityRecord[]>([]);
  const [spends, setSpends] = useState<EntertainmentSpend[]>([]);
  const [category, setCategory] = useState<Category>("投资");
  const [hours, setHours] = useState("1");
  const [minutes, setMinutes] = useState("0");
  const [focusScore, setFocusScore] = useState(10);
  const [spendMinutes, setSpendMinutes] = useState("");
  const [period, setPeriod] = useState<Period>("week");
  const [syncState, setSyncState] = useState<"cloud" | "local">("local");

  useEffect(() => {
    const id = getProfileId();
    setProfileId(id);
    setRecords(readLocal<ActivityRecord[]>(recordStorageKey, []));
    setSpends(readLocal<EntertainmentSpend[]>(spendStorageKey, []));

    const client = supabase;
    if (!client) return;
    setSyncState("cloud");

    const load = async () => {
      const [{ data: activityData }, { data: spendData }] = await Promise.all([
        client.from("activity_records").select("*").eq("profile_id", id).order("created_at", { ascending: false }),
        client.from("entertainment_spends").select("*").eq("profile_id", id).order("created_at", { ascending: false })
      ]);
      if (activityData) setRecords(activityData as ActivityRecord[]);
      if (spendData) setSpends(spendData as EntertainmentSpend[]);
    };

    load();

    const channel = client
      .channel(`pleasure-time-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "activity_records", filter: `profile_id=eq.${id}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "entertainment_spends", filter: `profile_id=eq.${id}` }, load)
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem(recordStorageKey, JSON.stringify(records));
  }, [records]);

  useEffect(() => {
    window.localStorage.setItem(spendStorageKey, JSON.stringify(spends));
  }, [spends]);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      if (process.env.NODE_ENV === "production") {
        navigator.serviceWorker.register("/sw.js").catch(() => undefined);
      } else {
        navigator.serviceWorker.getRegistrations().then((registrations) => registrations.forEach((registration) => registration.unregister()));
        caches?.keys?.().then((keys) => keys.forEach((key) => caches.delete(key)));
      }
    }
  }, []);

  const totals = useMemo(() => {
    const earned = records.reduce((sum, item) => sum + item.earned_minutes, 0);
    const spent = spends.reduce((sum, item) => sum + item.minutes, 0);
    const today = records.filter((item) => isSameDay(parseISO(item.created_at), new Date()));
    return {
      earned,
      spent,
      balance: Math.max(0, earned - spent),
      todayPoints: today.reduce((sum, item) => sum + item.points, 0),
      todayHours: today.reduce((sum, item) => sum + item.decimal_hours, 0)
    };
  }, [records, spends]);

  const preview = useMemo(() => {
    const h = clampNumber(Number(hours), 0, 24);
    const m = clampNumber(Number(minutes), 0, 59);
    const decimal = decimalHours(h, m);
    const points = decimal * focusScore;
    return { decimal, points, earned: points * 4 };
  }, [focusScore, hours, minutes]);

  const trendData = useMemo(() => {
    const start = periodStart(period);
    const days = period === "week" ? 7 : period === "month" ? 31 : 12;
    return Array.from({ length: days }).map((_, index) => {
      const date = period === "year" ? new Date(new Date().getFullYear(), index, 1) : addDays(start, index);
      const next = period === "year" ? new Date(new Date().getFullYear(), index + 1, 1) : endOfDay(date);
      const points = records
        .filter((item) => {
          const created = parseISO(item.created_at);
          return !isAfter(start, created) && !isAfter(created, next);
        })
        .filter((item) => (period === "year" ? parseISO(item.created_at).getMonth() === index : isSameDay(parseISO(item.created_at), date)))
        .reduce((sum, item) => sum + item.points, 0);
      return { label: chartLabel(date, period), 积分: Number(points.toFixed(1)) };
    });
  }, [period, records]);

  const categoryData = useMemo(
    () =>
      categories.map((name) => ({
        name,
        value: Number(records.filter((item) => item.category === name).reduce((sum, item) => sum + item.decimal_hours, 0).toFixed(2))
      })),
    [records]
  );

  async function addRecord() {
    const h = clampNumber(Math.floor(Number(hours)), 0, 24);
    const m = clampNumber(Math.floor(Number(minutes)), 0, 59);
    if (h === 0 && m === 0) return;

    const decimal = decimalHours(h, m);
    const points = decimal * focusScore;
    const item: ActivityRecord = {
      id: crypto.randomUUID(),
      profile_id: profileId,
      category,
      hours: h,
      minutes: m,
      decimal_hours: Number(decimal.toFixed(2)),
      focus_score: focusScore,
      points: Number(points.toFixed(2)),
      earned_minutes: Number((points * 4).toFixed(1)),
      created_at: new Date().toISOString()
    };

    setRecords((current) => [item, ...current]);
    if (supabase) await supabase.from("activity_records").insert(item);
  }

  async function addSpend() {
    const amount = clampNumber(Math.floor(Number(spendMinutes)), 1, 1440);
    const item: EntertainmentSpend = {
      id: crypto.randomUUID(),
      profile_id: profileId,
      minutes: amount,
      created_at: new Date().toISOString()
    };
    setSpends((current) => [item, ...current]);
    setSpendMinutes("");
    if (supabase) await supabase.from("entertainment_spends").insert(item);
  }

  async function deleteRecord(id: string) {
    setRecords((current) => current.filter((item) => item.id !== id));
    if (supabase) await supabase.from("activity_records").delete().eq("id", id);
  }

  return (
    <main className="safe-bottom mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-4 px-4 pb-6 pt-3 sm:px-6 lg:grid lg:grid-cols-[1fr_1.25fr] lg:items-start lg:gap-6 lg:pt-6">
      <section className="flex flex-col gap-4">
        <div className="rounded-[28px] bg-ink p-5 text-white shadow-soft">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-sm text-white/65">当前可用娱乐时间</p>
              <h1 className="mt-1 text-5xl font-semibold tracking-normal">{Math.floor(totals.balance)}</h1>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/12">
              <WalletCards size={24} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-2xl bg-white/10 p-3">
              <p className="text-white/60">累计赚取</p>
              <p className="mt-1 text-xl font-semibold">{Math.floor(totals.earned)} 分钟</p>
            </div>
            <div className="rounded-2xl bg-white/10 p-3">
              <p className="text-white/60">累计消耗</p>
              <p className="mt-1 text-xl font-semibold">{Math.floor(totals.spent)} 分钟</p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-2xl bg-white/10 px-3 py-2 text-sm text-white/72">
            {syncState === "cloud" && hasSupabaseConfig ? <Wifi size={16} /> : <WifiOff size={16} />}
            <span>{syncState === "cloud" && hasSupabaseConfig ? "Supabase 实时同步已开启" : "本地体验模式：只保存在当前设备"}</span>
          </div>
        </div>

        <Panel title="记录活动" icon={<Plus size={20} />}>
          <div className="grid grid-cols-5 gap-2">
            {categories.map((item) => (
              <button
                key={item}
                onClick={() => setCategory(item)}
                className={`h-12 rounded-2xl text-sm font-semibold transition ${category === item ? "bg-ink text-white" : "bg-mist text-ink"}`}
              >
                {item}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <NumberField label="小时" value={hours} onChange={setHours} min={0} max={24} />
            <NumberField label="分钟" value={minutes} onChange={setMinutes} min={0} max={59} />
          </div>

          <div className="rounded-3xl bg-mist p-4">
            <div className="mb-3 flex items-center justify-between">
              <label className="text-sm font-semibold text-slate-600">专注评分</label>
              <span className="text-2xl font-semibold">{focusScore}</span>
            </div>
            <input className="h-10 w-full" type="range" min="0" max="20" value={focusScore} onChange={(event) => setFocusScore(Number(event.target.value))} />
          </div>

          <div className="grid grid-cols-3 gap-2 rounded-3xl border border-line p-3 text-center text-sm">
            <Metric label="小时" value={preview.decimal.toFixed(2)} />
            <Metric label="积分" value={preview.points.toFixed(1)} />
            <Metric label="娱乐" value={`${preview.earned.toFixed(0)}分`} />
          </div>

          <button onClick={addRecord} className="h-14 rounded-2xl bg-aqua text-lg font-semibold text-white shadow-soft">
            记录本次活动
          </button>
        </Panel>

        <Panel title="消耗娱乐时间" icon={<Flame size={20} />}>
          <div className="flex gap-3">
            <input
              className="h-14 min-w-0 flex-1 rounded-2xl border border-line bg-white px-4 text-lg outline-none focus:border-aqua"
              inputMode="numeric"
              placeholder="分钟数"
              value={spendMinutes}
              onChange={(event) => setSpendMinutes(event.target.value)}
            />
            <button onClick={addSpend} className="h-14 rounded-2xl bg-coral px-5 font-semibold text-white">
              确认
            </button>
          </div>
        </Panel>
      </section>

      <section className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <StatusCard icon={<Activity size={20} />} label="今日积分" value={totals.todayPoints.toFixed(1)} />
          <StatusCard icon={<Clock3 size={20} />} label="今日活动" value={`${totals.todayHours.toFixed(1)} 小时`} />
        </div>

        <Panel title="数据看板" icon={<BarChart3 size={20} />}>
          <div className="grid grid-cols-3 gap-2 rounded-2xl bg-mist p-1">
            {(["week", "month", "year"] as Period[]).map((item) => (
              <button key={item} onClick={() => setPeriod(item)} className={`h-11 rounded-xl font-semibold ${period === item ? "bg-white shadow-sm" : "text-slate-500"}`}>
                {item === "week" ? "周" : item === "month" ? "月" : "年"}
              </button>
            ))}
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer>
              <LineChart data={trendData} margin={{ top: 12, right: 8, left: -24, bottom: 0 }}>
                <CartesianGrid stroke="#DDE3EA" strokeDasharray="4 4" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={period === "month" ? 5 : 0} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="积分" stroke="#0EA5A4" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="h-56">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={categoryData} dataKey="value" nameKey="name" innerRadius={42} outerRadius={78} paddingAngle={3}>
                    {categoryData.map((entry) => (
                      <Cell key={entry.name} fill={colorByCategory[entry.name]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="h-56">
              <ResponsiveContainer>
                <BarChart data={categoryData} margin={{ top: 12, right: 8, left: -24, bottom: 0 }}>
                  <CartesianGrid stroke="#DDE3EA" strokeDasharray="4 4" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="value" name="小时" radius={[8, 8, 0, 0]}>
                    {categoryData.map((entry) => (
                      <Cell key={entry.name} fill={colorByCategory[entry.name]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Panel>

        <Panel title="历史记录" icon={syncState === "cloud" && hasSupabaseConfig ? <Wifi size={20} /> : <WifiOff size={20} />}>
          <div className="flex flex-col gap-3">
            {records.length === 0 ? (
              <div className="rounded-3xl bg-mist p-6 text-center text-slate-500">还没有记录，先完成一次活动吧。</div>
            ) : (
              records.map((item) => (
                <div key={item.id} className="grid grid-cols-[1fr_auto] gap-3 rounded-3xl border border-line bg-white p-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: colorByCategory[item.category] }} />
                      <p className="font-semibold">{item.category}</p>
                      <p className="text-sm text-slate-500">{format(parseISO(item.created_at), "MM/dd HH:mm")}</p>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">
                      {item.hours}小时{item.minutes}分钟 · 专注 {item.focus_score} · {item.points} 积分 · +{item.earned_minutes} 分钟
                    </p>
                  </div>
                  <button aria-label="删除记录" onClick={() => deleteRecord(item.id)} className="flex h-11 w-11 items-center justify-center rounded-2xl bg-mist text-slate-500">
                    <Trash2 size={18} />
                  </button>
                </div>
              ))
            )}
          </div>
        </Panel>
      </section>
    </main>
  );
}

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-[28px] border border-white/70 bg-white/88 p-4 shadow-soft backdrop-blur sm:p-5">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-mist text-ink">{icon}</div>
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

function NumberField({ label, value, onChange, min, max }: { label: string; value: string; onChange: (value: string) => void; min: number; max: number }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-semibold text-slate-600">{label}</span>
      <input
        className="h-14 rounded-2xl border border-line bg-white px-4 text-xl font-semibold outline-none focus:border-aqua"
        inputMode="numeric"
        min={min}
        max={max}
        type="number"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-slate-500">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}

function StatusCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-[24px] bg-white p-4 shadow-soft">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-mist text-ink">{icon}</div>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
