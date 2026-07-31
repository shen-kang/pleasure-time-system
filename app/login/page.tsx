"use client";

import { ArrowLeft, LogIn, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

function authErrorMessage(message: string, isSignUp: boolean) {
  const normalized = message.toLowerCase();
  if (normalized.includes("invalid login credentials")) return "邮箱或密码不正确。第一次使用请先点击“注册”。";
  if (normalized.includes("email not confirmed")) return "邮箱还没有验证，请先打开验证邮件完成确认。";
  if (normalized.includes("user already registered")) return "这个邮箱已经注册，请返回登录。";
  if (normalized.includes("password should be")) return "密码至少需要 6 位。";
  if (normalized.includes("rate limit")) return "尝试次数过多，请稍后再试。";
  return `${isSignUp ? "注册" : "登录"}失败：${message}`;
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase?.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace("/");
    });
  }, [router]);

  async function handleSubmit() {
    setMessage("");
    setError("");
    if (!supabase) { setError("云端服务尚未配置，请检查环境变量。"); return; }
    setBusy(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      if (isSignUp) {
        const { data, error: signUpError } = await supabase.auth.signUp({ email: normalizedEmail, password });
        if (signUpError) throw signUpError;
        if (data.user?.identities?.length === 0) {
          setError("这个邮箱已经注册，请返回登录。");
        } else if (data.session) {
          router.replace("/");
        } else {
          setMessage("注册成功，请查收验证邮件后登录。");
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
        if (signInError) throw signInError;
        router.replace("/");
      }
    } catch (caught: unknown) {
      const detail = caught instanceof Error ? caught.message : "操作失败，请重试";
      setError(authErrorMessage(detail, isSignUp));
    } finally {
      setBusy(false);
    }
  }
 
   return (
     <main className="safe-bottom mx-auto flex min-h-screen w-full max-w-sm flex-col items-center justify-center gap-7 px-4 py-10">
       <div className="text-center">
         <h1 className="text-4xl font-semibold text-slate-50">欢愉值</h1>
         <p className="mt-2 text-sm text-slate-400">时间银行</p>
       </div>
 
       <form
         onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}
         className="flex w-full flex-col gap-5 rounded-lg border border-line bg-panel p-6 shadow-deep"
       >
         <h2 className="text-lg font-semibold">{isSignUp ? "注册" : "登录"}</h2>
 
         <label className="flex flex-col gap-2 text-sm font-semibold text-slate-300">
           邮箱
           <input
             className="h-12 rounded-lg border border-line bg-canvas px-4 text-slate-100 outline-none placeholder:text-slate-600 focus:border-aqua"
             type="email"
             placeholder="you@example.com"
             value={email}
             onChange={(e) => setEmail(e.target.value)}
             required
           />
         </label>
 
         <label className="flex flex-col gap-2 text-sm font-semibold text-slate-300">
           密码
           <input
             className="h-12 rounded-lg border border-line bg-canvas px-4 text-slate-100 outline-none placeholder:text-slate-600 focus:border-aqua"
             type="password"
             placeholder="至少 6 位"
             value={password}
             onChange={(e) => setPassword(e.target.value)}
             minLength={6}
             required
           />
         </label>
 
         {error && <p className="rounded-lg border border-coral/30 bg-coral/10 p-3 text-sm text-red-300">{error}</p>}
         {message && <p className="rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-300">{message}</p>}
 
         <div className="flex gap-3">
           {isSignUp ? (
             <>
               <button
                 type="submit"
                 disabled={busy}
                 className="flex h-12 flex-1 items-center justify-center gap-2 rounded-lg bg-aqua font-semibold text-white disabled:cursor-wait disabled:opacity-50"
               >
                 <UserPlus size={18} /> {busy ? "注册中..." : "注册"}
               </button>
               <button
                 type="button"
                 onClick={() => setIsSignUp(false)}
                 aria-label="返回登录"
                 title="返回登录"
                 className="flex h-12 w-12 items-center justify-center rounded-lg bg-elevated text-slate-200 hover:bg-line"
               >
                 <ArrowLeft size={18} />
               </button>
             </>
           ) : (
             <>
               <button
                 type="submit"
                 disabled={busy}
                 className="flex h-12 flex-1 items-center justify-center gap-2 rounded-lg bg-aqua font-semibold text-white disabled:cursor-wait disabled:opacity-50"
               >
                 <LogIn size={18} /> {busy ? "登录中..." : "登录"}
               </button>
               <button
                 type="button"
                 onClick={() => setIsSignUp(true)}
                 className="h-12 rounded-lg bg-elevated px-4 font-semibold text-slate-200 transition hover:bg-line"
               >
                 注册
               </button>
             </>
           )}
         </div>
       </form>
     </main>
   );
 }
