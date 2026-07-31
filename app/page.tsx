"use client";

import { addDays, endOfDay, format, isAfter, isSameDay, parseISO, startOfMonth, startOfWeek, startOfYear } from "date-fns";
import { ArrowDown, ArrowUp, BarChart3, Flame, LogOut, Plus, Settings, Trash2, Wifi, WifiOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase, hasSupabaseConfig } from "@/lib/supabase";
import { ActivityRecord, colorPalette, EntertainmentSpend, Period, UserCategory } from "@/lib/types";

const DAILY_TARGET = 80;
const recordStoragePrefix = "pleasure-records-";
const spendStoragePrefix = "pleasure-spends-";
const chartTooltipStyle = {
  backgroundColor: "#171C23",
  border: "1px solid #303943",
  borderRadius: 8,
  boxShadow: "0 12px 30px rgba(0, 0, 0, 0.28)",
};
const chartLabelStyle = { color: "#CBD5E1" };
const chartTick = { fill: "#94A3B8", fontSize: 11 };

function readLocal<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try { const v = window.localStorage.getItem(key); return v ? JSON.parse(v) as T : fallback; } catch { return fallback; }
}

function writeLocal(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function decimalHours(hours: number, minutes: number) { return hours + minutes / 60; }
function clampNumber(value: number, min: number, max: number) { return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min)); }
function formatMinutes(value: number) { return Number(value.toFixed(1)).toLocaleString("zh-CN", { maximumFractionDigits: 1 }); }
function diffDays(a: Date, b: Date) { return Math.floor((a.getTime() - b.getTime()) / 86400000); }
function periodStart(period: Period) { const n = new Date(); if (period === "week") return startOfWeek(n, { weekStartsOn: 1 }); if (period === "month") return startOfMonth(n); return startOfYear(n); }
function chartLabel(date: Date, period: Period) {
  if (period === "week") return ["日","一","二","三","四","五","六"][date.getDay()];
  if (period === "month") return format(date, "MM/dd");
  return format(date, "MM月");
}

type HistoryItem = {
  id: string;
  kind: "activity" | "spend";
  created_at: string;
  category?: string;
  hours?: number;
  minutes?: number;
  focus_score?: number;
  points?: number;
  earned_minutes?: number;
  amount?: number;
};

export default function Home() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState("");
  const [authLoading, setAuthLoading] = useState(true);

  // ---------- auth ----------
  useEffect(() => {
    const client = supabase;
    if (!client) { setAuthLoading(false); return; }
    client.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace("/login"); return; }
      setUserId(session.user.id);
      setUserEmail(session.user.email || "");
      setAuthLoading(false);
    });
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace("/login"); else { setUserId(session.user.id); setUserEmail(session.user.email || ""); }
    });
    return () => subscription.unsubscribe();
  }, []);

  // ---------- state ----------
  const [categories, setCategories] = useState<UserCategory[]>([]);
  const [records, setRecords] = useState<ActivityRecord[]>([]);
  const [spends, setSpends] = useState<EntertainmentSpend[]>([]);
  const [selectedCat, setSelectedCat] = useState("");
  const [hours, setHours] = useState("1");
  const [minutes, setMinutes] = useState("0");
  const [focusScore, setFocusScore] = useState(10);
  const [spendMinutes, setSpendMinutes] = useState("");
  const [period, setPeriod] = useState<Period>("week");
  const [syncState, setSyncState] = useState<"cloud" | "local">("local");
  const [showCatModal, setShowCatModal] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatColor, setNewCatColor] = useState<string>(colorPalette[0]);
  const [catMsg, setCatMsg] = useState("");
  const [highlightedLine, setHighlightedLine] = useState<string | null>(null);
  const [displayCount, setDisplayCount] = useState(10);
  const [saving, setSaving] = useState<"activity" | "spend" | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ---------- toast ----------
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  function showToast(msg: string, type: "success" | "error" = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2200);
  }

  // ---------- load categories ----------
 useEffect(() => {
   const catClient = supabase;
   if (!userId || !catClient) return;
   const uid = userId;
   (async () => {
     const { data } = await catClient.from("categories").select("*").eq("user_id", uid).order("created_at");
     if (data && data.length > 0) {
       setCategories(data);
     } else {
       const defaults: UserCategory[] = colorPalette.slice(0, 5).map((c, i) => ({
         id: crypto.randomUUID(), name: ["投资","套利","健身","羽毛球","阅读"][i], color: c, created_at: new Date().toISOString(),
       }));
       await catClient.from("categories").insert(defaults.map(d => ({ ...d, user_id: uid })));
       setCategories(defaults);
     }
   })();
  }, [userId]);

  useEffect(() => { if (categories.length > 0 && !selectedCat) setSelectedCat(categories[0].name); }, [categories]);

  // ---------- load records ----------
  useEffect(() => {
    const rk = recordStoragePrefix + (userId || "local");
    const sk = spendStoragePrefix + (userId || "local");
    setRecords(readLocal(rk, [])); setSpends(readLocal(sk, []));
   const recClient = supabase;
   if (!recClient || !userId) return;
   setSyncState("cloud");
   const uid = userId;

   const load = async () => {
     const [{ data: rd }, { data: sd }] = await Promise.all([
       recClient.from("activity_records").select("*").eq("user_id", uid).order("created_at", { ascending: false }),
       recClient.from("entertainment_spends").select("*").eq("user_id", uid).order("created_at", { ascending: false }),
     ]);
      if (rd) { setRecords(rd as ActivityRecord[]); writeLocal(rk, rd); }
      if (sd) { setSpends(sd as EntertainmentSpend[]); writeLocal(sk, sd); }
    };
    load();

    const channel = recClient.channel(`pleasure-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "activity_records", filter: `user_id=eq.${userId}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "entertainment_spends", filter: `user_id=eq.${userId}` }, load)
      .subscribe();
    return () => { recClient.removeChannel(channel); };
  }, [userId]);

  // ---------- persist to localStorage ----------
  useEffect(() => { writeLocal(recordStoragePrefix + (userId || "local"), records); }, [records, userId]);
  useEffect(() => { writeLocal(spendStoragePrefix + (userId || "local"), spends); }, [spends, userId]);

  // ---------- service worker ----------
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      if (process.env.NODE_ENV === "production") navigator.serviceWorker.register("/sw.js").catch(() => undefined);
      else navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach(r => r.unregister()))?.then(() => caches?.keys?.().then(ks => ks.forEach(k => caches.delete(k))));
    }
  }, []);

  // ---------- calculations ----------
  const totals = useMemo(() => {
    const earned = records.reduce((s, i) => s + i.earned_minutes, 0);
    const spent = spends.reduce((s, i) => s + i.minutes, 0);
    const today = records.filter(i => isSameDay(parseISO(i.created_at), new Date()));
    return { earned, spent, balance: earned - spent, todayPoints: today.reduce((s, i) => s + i.points, 0), todayHours: today.reduce((s, i) => s + i.decimal_hours, 0) };
  }, [records, spends]);

  const preview = useMemo(() => {
    const h = clampNumber(Number(hours), 0, 24), m = clampNumber(Number(minutes), 0, 59);
    const dec = decimalHours(h, m), pts = dec * focusScore;
    return { decimal: dec, points: pts, earned: pts * 4 };
  }, [focusScore, hours, minutes]);

  const weekPoints = useMemo(() => {
    const start = startOfWeek(new Date(), { weekStartsOn: 1 });
    return records.filter(r => !isAfter(start, parseISO(r.created_at))).reduce((s, r) => s + r.points, 0);
  }, [records]);
  const monthPoints = useMemo(() => {
    const start = startOfMonth(new Date());
    return records.filter(r => !isAfter(start, parseISO(r.created_at))).reduce((s, r) => s + r.points, 0);
  }, [records]);

  // v2: Daily target calculation
  const targetGap = useMemo(() => {
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const monthStart = startOfMonth(now);
    const daysWeek = diffDays(now, weekStart) + 1;
    const daysMonth = diffDays(now, monthStart) + 1;
    const weekExpected = DAILY_TARGET * daysWeek;
    const monthExpected = DAILY_TARGET * daysMonth;
    const weekGap = Number((weekPoints - weekExpected).toFixed(1));
    const monthGap = Number((monthPoints - monthExpected).toFixed(1));
    const todayGap = Number((totals.todayPoints - DAILY_TARGET).toFixed(1));
    return { weekGap, monthGap, todayGap, weekExpected, monthExpected };
  }, [weekPoints, monthPoints, totals.todayPoints]);

  // Entertainment time calculations (takes spend minutes, converts to hours)
  const todayEntertainment = useMemo(() => {
    const now = new Date();
    const yesterday = addDays(now, -1);
    // Today's entertainment (spend minutes converted to hours)
    const todayMins = spends
      .filter(s => isSameDay(parseISO(s.created_at), now))
      .reduce((s, i) => s + i.minutes, 0);
    const todayHours = Number((todayMins / 60).toFixed(1));

    // Keep the production dashboard definition: rolling 7/30-day average, excluding today.
    const weekStart = addDays(now, -7);
    const weekSpends = spends.filter(s => {
      const d = parseISO(s.created_at);
      return d > weekStart && d <= yesterday;
    });
    const weekTotalMins = weekSpends.reduce((s, i) => s + i.minutes, 0);
    const weekAvgHours = Number((weekTotalMins / 60 / 7).toFixed(2));

    const monthStart = addDays(now, -30);
    const monthSpends = spends.filter(s => {
      const d = parseISO(s.created_at);
      return d > monthStart && d <= yesterday;
    });
    const monthTotalMins = monthSpends.reduce((s, i) => s + i.minutes, 0);
    const monthAvgHours = Number((monthTotalMins / 60 / 30).toFixed(2));

    return { todayHours, weekAvgHours, monthAvgHours };
  }, [spends]);

  const trendData = useMemo(() => {
    const start = periodStart(period);
    const days = period === "week" ? 7 : period === "month" ? 31 : 12;
    return Array.from({ length: days }).map((_, i) => {
      const date = period === "year" ? new Date(new Date().getFullYear(), i, 1) : addDays(start, i);
      const next = period === "year" ? new Date(new Date().getFullYear(), i + 1, 1) : endOfDay(date);
      const pts = records.filter(r => { const c = parseISO(r.created_at); return !isAfter(start, c) && !isAfter(c, next); })
        .filter(r => period === "year" ? parseISO(r.created_at).getMonth() === i : isSameDay(parseISO(r.created_at), date))
        .reduce((s, r) => s + r.points, 0);
      const entMins = spends.filter(s => { const c = parseISO(s.created_at); return !isAfter(start, c) && !isAfter(c, next); })
        .filter(s => period === "year" ? parseISO(s.created_at).getMonth() === i : isSameDay(parseISO(s.created_at), date))
        .reduce((s, r) => s + r.minutes, 0);
      const earnedMins = records.filter(r => { const c = parseISO(r.created_at); return !isAfter(start, c) && !isAfter(c, next); })
        .filter(r => period === "year" ? parseISO(r.created_at).getMonth() === i : isSameDay(parseISO(r.created_at), date))
        .reduce((s, r) => s + r.earned_minutes, 0);
      return { label: chartLabel(date, period), 积分: Number(pts.toFixed(1)), 娱乐: Number((entMins / 60).toFixed(2)), 储藏: Number(((earnedMins - entMins) / 60).toFixed(2)) };
    });
  }, [period, records, spends]);

  const categoryData = useMemo(() => {
    const start = periodStart(period);
    const periodRecords = records.filter(record => !isAfter(start, parseISO(record.created_at)) && !isAfter(parseISO(record.created_at), new Date()));
    return categories.map(category => ({
      name: category.name,
      value: Number(periodRecords.filter(record => record.category === category.name).reduce((sum, record) => sum + record.decimal_hours, 0).toFixed(2)),
      color: category.color,
    }));
  }, [records, categories, period]);

  // ---------- unified history ----------
  const history = useMemo<HistoryItem[]>(() => {
    const acts: HistoryItem[] = records.map(r => ({
      id: r.id, kind: "activity" as const, created_at: r.created_at,
      category: r.category, hours: r.hours, minutes: r.minutes,
      focus_score: r.focus_score, points: r.points, earned_minutes: r.earned_minutes,
    }));
    const sps: HistoryItem[] = spends.map(s => ({
      id: s.id + "-spend", kind: "spend" as const, created_at: s.created_at, amount: s.minutes,
    }));
    return [...acts, ...sps].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [records, spends]);

  // ---------- actions ----------
  async function addRecord() {
    if (saving) return;
    const h = clampNumber(Math.floor(Number(hours)), 0, 24), m = clampNumber(Math.floor(Number(minutes)), 0, 59);
    if (!selectedCat) { showToast("请先选择活动分类", "error"); return; }
    if (h === 0 && m === 0) { showToast("请填写时间", "error"); return; }
    const dec = decimalHours(h, m), pts = dec * focusScore;
    const item: ActivityRecord = {
      id: crypto.randomUUID(), user_id: userId || undefined, profile_id: userId || "",
      category: selectedCat, hours: h, minutes: m, decimal_hours: Number(dec.toFixed(2)),
      focus_score: focusScore, points: Number(pts.toFixed(2)), earned_minutes: Number((pts * 4).toFixed(1)),
      created_at: new Date().toISOString(),
    };
    setSaving("activity");
    try {
      if (supabase && userId) {
        const { error } = await supabase.from("activity_records").insert({ ...item, user_id: userId });
        if (error) {
          const blockedByOldCategoryRule = error.message.toLowerCase().includes("category") && error.message.toLowerCase().includes("check");
          showToast(blockedByOldCategoryRule ? "数据库需要升级后才能记录自定义分类" : `保存失败：${error.message}`, "error");
          return;
        }
      }
      setRecords(current => [item, ...current.filter(record => record.id !== item.id)]);
      showToast("记录成功！+" + formatMinutes(item.earned_minutes) + " 分钟娱乐时间");
    } catch {
      showToast("网络连接失败，本次活动尚未保存", "error");
    } finally {
      setSaving(null);
    }
  }

  async function addSpend() {
    if (saving) return;
    const rawAmount = Math.floor(Number(spendMinutes));
    if (!Number.isFinite(rawAmount) || rawAmount <= 0) { showToast("请输入正确的分钟数", "error"); return; }
    const amount = clampNumber(rawAmount, 1, 1440);
    if (amount > totals.balance) { showToast(`当前只有 ${formatMinutes(totals.balance)} 分钟可用`, "error"); return; }
    const item: EntertainmentSpend = { id: crypto.randomUUID(), user_id: userId || undefined, profile_id: userId || "", minutes: amount, created_at: new Date().toISOString() };
    setSaving("spend");
    try {
      if (supabase && userId) {
        const { error } = await supabase.from("entertainment_spends").insert({ ...item, user_id: userId });
        if (error) { showToast(`保存失败：${error.message}`, "error"); return; }
      }
      setSpends(current => [item, ...current.filter(spend => spend.id !== item.id)]);
      setSpendMinutes("");
      showToast("消耗 " + amount + " 分钟娱乐时间");
    } catch {
      showToast("网络连接失败，本次消耗尚未保存", "error");
    } finally {
      setSaving(null);
    }
  }

  async function deleteItem(item: HistoryItem) {
    if (deletingId) return;
    setDeletingId(item.id);
    try {
      if (item.kind === "activity") {
        if (supabase && userId) {
          const { data, error } = await supabase.from("activity_records").delete().eq("id", item.id).eq("user_id", userId).select("id").maybeSingle();
          if (error || !data) { showToast(error ? `删除失败：${error.message}` : "云端未删除这条活动记录", "error"); return; }
        }
        setRecords(current => current.filter(record => record.id !== item.id));
        showToast(`已删除活动，可用娱乐时间 -${formatMinutes(item.earned_minutes || 0)} 分钟`);
      } else {
        const spendId = item.id.replace("-spend", "");
        if (supabase && userId) {
          const { data, error } = await supabase.from("entertainment_spends").delete().eq("id", spendId).eq("user_id", userId).select("id").maybeSingle();
          if (error || !data) { showToast(error ? `删除失败：${error.message}` : "请先执行数据库升级脚本", "error"); return; }
        }
        setSpends(current => current.filter(spend => spend.id !== spendId));
        showToast(`已删除消耗，可用娱乐时间 +${formatMinutes(item.amount || 0)} 分钟`);
      }
    } catch {
      showToast("网络连接失败，这条记录尚未删除", "error");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleAddCategory() {
    if (!newCatName.trim() || !supabase || !userId) return;
    setCatMsg("");
    const exists = categories.some(c => c.name === newCatName.trim());
    if (exists) { setCatMsg("已存在同名分类"); return; }
    const item: UserCategory = { id: crypto.randomUUID(), name: newCatName.trim(), color: newCatColor, created_at: new Date().toISOString() };
    const { error } = await supabase.from("categories").insert({ ...item, user_id: userId });
    if (error) { setCatMsg("添加失败: " + error.message); return; }
    setCategories(c => [...c, item]);
    setNewCatName(""); setCatMsg("");
    showToast("分类已添加");
  }

  async function handleDeleteCategory(cat: UserCategory) {
    if (!supabase || !userId) return;
    const hasRecords = records.some(r => r.category === cat.name);
    if (hasRecords) { setCatMsg("该分类已有记录，无法删除"); return; }
    const { error } = await supabase.from("categories").delete().eq("id", cat.id).eq("user_id", userId);
    if (error) { setCatMsg("删除失败: " + error.message); return; }
    setCategories(c => c.filter(x => x.id !== cat.id));
    if (selectedCat === cat.name && categories.length > 1) setSelectedCat(categories.find(x => x.id !== cat.id)?.name || "");
    showToast("分类已删除");
  }

 async function handleLogout() {
   if (supabase) await supabase.auth.signOut();
   router.replace("/login");
 }

  if (authLoading) return <main className="flex min-h-screen items-center justify-center"><p className="text-slate-400">加载中...</p></main>;

  const colorByCat = (name: string) => categories.find(c => c.name === name)?.color || "#0EA5A4";

  return (
    <>
      {/* Toast */}
      {toast && (
        <div className="toast-animate fixed left-1/2 top-[max(1rem,env(safe-area-inset-top))] z-[100] w-max max-w-[calc(100vw-2rem)] -translate-x-1/2">
          <div className={`rounded-lg px-5 py-3 text-sm font-semibold shadow-lg backdrop-blur ${toast.type === "success" ? "bg-aqua/95 text-white" : "bg-coral/95 text-white"}`}>
            {toast.msg}
          </div>
        </div>
      )}

      {/* Top bar */}
      <div className="safe-top fixed left-0 right-0 top-0 z-50 flex items-center justify-between border-b border-line/80 bg-canvas/90 px-4 py-2.5 backdrop-blur-xl sm:px-6">
        <span className="min-w-0 truncate pr-3 text-sm font-semibold text-slate-300">{userEmail}</span>
        <div className="flex shrink-0 items-center gap-2">
          <button aria-label="管理分类" title="管理分类" onClick={() => setShowCatModal(true)} className="flex h-10 w-10 items-center justify-center rounded-lg bg-elevated text-slate-200 transition hover:bg-line">
            <Settings size={18} />
          </button>
          <button aria-label="退出登录" title="退出登录" onClick={handleLogout} className="flex h-10 w-10 items-center justify-center rounded-lg bg-elevated text-slate-200 transition hover:bg-line">
            <LogOut size={18} />
          </button>
        </div>
      </div>

      {/* Category modal */}
      {showCatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => setShowCatModal(false)}>
          <div className="w-full max-w-sm rounded-lg border border-line bg-panel p-5 shadow-deep" onClick={e => e.stopPropagation()}>
            <h3 className="mb-4 text-lg font-semibold">管理分类</h3>
            <div className="mb-4 flex max-h-48 flex-col gap-2 overflow-y-auto">
              {categories.map(c => (
                <div key={c.id} className="flex items-center justify-between rounded-lg bg-elevated px-3 py-2.5 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: c.color }} />
                    <span className="font-semibold">{c.name}</span>
                  </div>
                  <button aria-label={`删除分类 ${c.name}`} onClick={() => handleDeleteCategory(c)} className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-line hover:text-coral">
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_44px] gap-2">
              <input className="h-11 min-w-0 rounded-lg border border-line bg-canvas px-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-aqua" placeholder="分类名称" value={newCatName} onChange={e => setNewCatName(e.target.value)} />
              <button aria-label="添加分类" onClick={handleAddCategory} className="flex h-11 w-11 items-center justify-center rounded-lg bg-aqua text-white transition hover:brightness-110"><Plus size={18} /></button>
              <div className="col-span-2 grid grid-cols-8 gap-1">
                {colorPalette.slice(0, 8).map(c => (
                  <button aria-label={`选择颜色 ${c}`} key={c} onClick={() => setNewCatColor(c)} className={`aspect-square w-full rounded-full border-2 ${newCatColor === c ? "border-white" : "border-transparent"}`} style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
            {catMsg && <p className="mt-2 text-xs text-red-500">{catMsg}</p>}
            <button onClick={() => setShowCatModal(false)} className="mt-4 h-11 w-full rounded-lg bg-aqua text-sm font-semibold text-white">完成</button>
          </div>
        </div>
      )}

      <main className="safe-bottom mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-4 overflow-x-hidden px-4 pb-6 pt-20 sm:px-6 lg:grid lg:grid-cols-[1fr_1fr] lg:gap-6 lg:pt-24">

        {/* ===== Left Column ===== */}
        <section className="flex min-w-0 flex-col gap-4">
          <div className="rounded-lg border border-line bg-ink p-5 text-white shadow-deep">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
              <div className="min-w-0">
                <p className="text-sm text-white/65">当前可用娱乐时间</p>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="min-w-0 text-4xl font-semibold tabular-nums tracking-normal">{formatMinutes(totals.balance)}</span>
                  <span className="text-sm text-white/50">分钟</span>
                </div>
              </div>
              <div className="shrink-0 border-l border-white/15 pl-4">
                <p className="text-xs text-white/60">今日已娱乐</p>
                <p className="mt-0.5 text-lg font-semibold">{todayEntertainment.todayHours} 小时</p>
                <p className="mt-0.5 text-xs text-white/40">周均{todayEntertainment.weekAvgHours}h | 月均{todayEntertainment.monthAvgHours}h</p>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-3 border-t border-white/15 pt-4 text-sm">
              <div className="min-w-0 pr-2"><p className="text-white/60">今日积分</p><p className="mt-1 text-xl font-semibold tabular-nums">{totals.todayPoints.toFixed(1)}</p><p className={`mt-0.5 text-xs ${targetGap.todayGap >= 0 ? "text-green-400" : "text-coral"}`}>{targetGap.todayGap >= 0 ? "+" : ""}{targetGap.todayGap.toFixed(1)} (目标 {DAILY_TARGET})</p></div>
              <div className="min-w-0 border-l border-white/15 px-2"><p className="text-white/60">本周积分</p><p className="mt-1 text-xl font-semibold tabular-nums">{weekPoints.toFixed(1)}</p><p className={`mt-0.5 text-xs ${targetGap.weekGap >= 0 ? "text-green-400" : "text-coral"}`}>{targetGap.weekGap >= 0 ? "+" : ""}{targetGap.weekGap.toFixed(1)} (目标 {targetGap.weekExpected.toFixed(0)})</p></div>
              <div className="min-w-0 border-l border-white/15 pl-2"><p className="text-white/60">本月积分</p><p className="mt-1 text-xl font-semibold tabular-nums">{monthPoints.toFixed(1)}</p><p className={`mt-0.5 text-xs ${targetGap.monthGap >= 0 ? "text-green-400" : "text-coral"}`}>{targetGap.monthGap >= 0 ? "+" : ""}{targetGap.monthGap.toFixed(1)} (目标 {targetGap.monthExpected.toFixed(0)})</p></div>
            </div>
          </div>

          <Panel title="记录活动" icon={<Plus size={20} />}>
            <div className="flex flex-wrap gap-2">
              {categories.map(c => (
                <button key={c.id} onClick={() => setSelectedCat(c.name)}
                  className={`h-11 rounded-lg px-4 text-sm font-semibold transition ${selectedCat === c.name ? "text-white shadow-sm" : "bg-elevated text-slate-200 hover:bg-line"}`}
                  style={selectedCat === c.name ? { backgroundColor: c.color } : {}}>
                  {c.name}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <NumberField label="小时" value={hours} onChange={setHours} min={0} max={24} />
              <NumberField label="分钟" value={minutes} onChange={setMinutes} min={0} max={59} />
            </div>
            <div className="rounded-lg bg-elevated p-4">
              <div className="mb-3 flex items-center justify-between"><label className="text-sm font-semibold text-slate-300">专注评分</label><span className="text-2xl font-semibold tabular-nums">{focusScore}</span></div>
              <input className="h-10 w-full" type="range" min="0" max="20" value={focusScore} onChange={e => setFocusScore(Number(e.target.value))} />
            </div>
            <div className="grid grid-cols-3 gap-2 rounded-lg border border-line p-3 text-center text-sm">
              <Metric label="小时" value={preview.decimal.toFixed(2)} />
              <Metric label="积分" value={preview.points.toFixed(1)} />
              <Metric label="娱乐" value={`${preview.earned.toFixed(0)}分`} />
            </div>
            <button disabled={saving !== null} onClick={addRecord} className="h-14 rounded-lg bg-aqua text-lg font-semibold text-white shadow-soft transition hover:brightness-110 active:scale-[0.98] disabled:cursor-wait disabled:opacity-60">{saving === "activity" ? "正在保存..." : "记录本次活动"}</button>
          </Panel>

          <Panel title="消耗娱乐时间" icon={<Flame size={20} />}>
            <div className="flex gap-3">
              <input className="h-14 min-w-0 flex-1 rounded-lg border border-line bg-canvas px-4 text-lg text-slate-100 outline-none placeholder:text-slate-500 focus:border-aqua" inputMode="numeric" placeholder="分钟数" value={spendMinutes} onChange={e => setSpendMinutes(e.target.value)} />
              <button disabled={saving !== null} onClick={addSpend} className="h-14 min-w-20 shrink-0 rounded-lg bg-coral px-5 font-semibold text-white transition hover:brightness-110 active:scale-[0.98] disabled:cursor-wait disabled:opacity-60">{saving === "spend" ? "保存中" : "确认"}</button>
            </div>
          </Panel>
        </section>

        {/* ===== Right Column ===== */}
        <section className="flex min-w-0 flex-col gap-4">


          <Panel title="数据看板" icon={<BarChart3 size={20} />}>
            <div className="grid grid-cols-3 gap-2 rounded-lg bg-elevated p-1">
              {(["week", "month", "year"] as Period[]).map(p => (
                <button key={p} onClick={() => setPeriod(p)} className={`h-11 rounded-md font-semibold transition ${period === p ? "bg-aqua text-white shadow-sm" : "text-slate-400 hover:text-slate-100"}`}>{p === "week" ? "周" : p === "month" ? "月" : "年"}</button>
              ))}
            </div>
            <div className="h-56 w-full">
              <ResponsiveContainer>
                <LineChart data={trendData} margin={{ top: 12, right: 4, left: -24, bottom: 0 }}>
                  <CartesianGrid stroke="#29313B" strokeDasharray="4 4" />
                  <XAxis dataKey="label" axisLine={{ stroke: "#46515E" }} tickLine={false} tick={chartTick} interval={period === "month" ? 5 : 0} />
                  <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={chartTick} />
                  <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={chartTick} label={{ value: "小时", angle: -90, position: "insideRight", offset: 2, fill: "#94A3B8" }} />
                  <Tooltip contentStyle={chartTooltipStyle} labelStyle={chartLabelStyle} />
                  <Legend formatter={value => <span className="text-slate-300">{value}</span>} onMouseEnter={entry => setHighlightedLine(String(entry.value ?? ""))} onMouseLeave={() => setHighlightedLine(null)} />
                  <Line yAxisId="left" type="monotone" dataKey="积分" stroke="#20B8AE" strokeWidth={3} dot={false} name="积分" strokeOpacity={highlightedLine === null || highlightedLine === "积分" ? 1 : 0.15} />
                  <Line yAxisId="right" type="monotone" dataKey="娱乐" stroke="#FF745F" strokeWidth={2} dot={false} name="娱乐(小时)" strokeOpacity={highlightedLine === null || highlightedLine === "娱乐(小时)" ? 1 : 0.15} />
                  <Line yAxisId="right" type="monotone" dataKey="储藏" stroke="#16A34A" strokeWidth={2} dot={false} name="储藏(小时)" strokeOpacity={highlightedLine === null || highlightedLine === "储藏(小时)" ? 1 : 0.15} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="grid gap-4">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%"><PieChart>
                  <Pie data={categoryData} dataKey="value" nameKey="name" innerRadius={42} outerRadius={78} paddingAngle={3}>
                    {categoryData.map(e => (<Cell key={e.name} fill={e.color} />))}
                  </Pie>
                  <Tooltip contentStyle={chartTooltipStyle} labelStyle={chartLabelStyle} /><Legend formatter={value => <span className="text-slate-300">{value}</span>} />
                </PieChart></ResponsiveContainer>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%"><BarChart data={categoryData} margin={{ top: 12, right: 8, left: -24, bottom: 0 }}>
                  <CartesianGrid stroke="#29313B" strokeDasharray="4 4" />
                  <XAxis dataKey="name" axisLine={{ stroke: "#46515E" }} tickLine={false} tick={{ ...chartTick, fontSize: 12 }} /><YAxis axisLine={false} tickLine={false} tick={chartTick} />
                  <Tooltip contentStyle={chartTooltipStyle} labelStyle={chartLabelStyle} />
                  <Bar dataKey="value" name="小时" radius={[8, 8, 0, 0]}>
                    {categoryData.map(e => (<Cell key={e.name} fill={e.color} />))}
                  </Bar>
                </BarChart></ResponsiveContainer>
              </div>
            </div>
          </Panel>

          {/* ===== Unified Timeline ===== */}
          <Panel title="时间线" icon={syncState === "cloud" && hasSupabaseConfig ? <Wifi size={20} /> : <WifiOff size={20} />}>
            <div className="flex flex-col gap-3">
              {history.length === 0 ? (
                <div className="rounded-lg bg-elevated p-6 text-center text-slate-400">还没有记录，开始你的第一次活动吧。</div>
              ) : history.slice(0, displayCount).map(item => (
                <div key={item.id} className={`rounded-lg border p-4 ${item.kind === "activity" ? "border-line bg-elevated" : "border-coral/25 bg-coral/[0.06]"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      {item.kind === "activity" ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-aqua/10 text-aqua"><ArrowUp size={14} /></span>
                          <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: colorByCat(item.category || "") }} />
                          <p className="font-semibold">{item.category}</p>
                          <p className="text-sm text-slate-400">{format(parseISO(item.created_at), "MM/dd HH:mm")}</p>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-coral/10 text-coral"><ArrowDown size={14} /></span>
                          <p className="font-semibold text-coral">消耗</p>
                          <p className="text-sm text-slate-400">{format(parseISO(item.created_at), "MM/dd HH:mm")}</p>
                        </div>
                      )}
                      {item.kind === "activity" ? (
                        <p className="mt-1.5 text-sm text-slate-300">{item.hours}小时{item.minutes}分钟 · 专注 {item.focus_score} · {Number(item.points || 0).toFixed(1)} 积分 · <span className="font-semibold text-aqua">+{formatMinutes(item.earned_minutes || 0)} 分钟</span></p>
                      ) : (
                        <p className="mt-1.5 text-sm text-slate-300"><span className="font-semibold text-coral">-{formatMinutes(item.amount || 0)} 分钟</span> 娱乐时间</p>
                      )}
                    </div>
                    <button disabled={deletingId !== null} aria-label="删除" onClick={() => deleteItem(item)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-canvas text-slate-400 transition hover:bg-coral/15 hover:text-coral disabled:cursor-wait disabled:opacity-50"><Trash2 className={deletingId === item.id ? "animate-pulse" : ""} size={16} /></button>
                  </div>
                </div>
              ))}
              {displayCount < history.length && (
                <button onClick={() => setDisplayCount(d => d + 10)} className="h-12 w-full rounded-lg border border-line bg-elevated text-sm font-semibold text-slate-300 transition hover:bg-line">展开更多 (共{history.length}条)</button>
              )}
            </div>
          </Panel>
        </section>
      </main>
    </>
  );
}

// ===== helper components =====

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-panel p-4 shadow-deep sm:p-5">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-elevated text-aqua">{icon}</div>
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

function NumberField({ label, value, onChange, min, max }: { label: string; value: string; onChange: (v: string) => void; min: number; max: number }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-semibold text-slate-300">{label}</span>
      <input className="h-14 rounded-lg border border-line bg-canvas px-4 text-xl font-semibold text-slate-100 outline-none focus:border-aqua" inputMode="numeric" min={min} max={max} type="number" value={value} onChange={e => onChange(e.target.value)} />
    </label>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><p className="text-slate-400">{label}</p><p className="mt-1 truncate font-semibold tabular-nums">{value}</p></div>;
}
