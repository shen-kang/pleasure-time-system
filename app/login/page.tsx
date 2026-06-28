 "use client";
 
 import { LogIn, UserPlus } from "lucide-react";
 import { useRouter } from "next/navigation";
 import { useEffect, useState } from "react";
 import { supabase } from "@/lib/supabase";
 
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
   }, []);
 
   async function handleSubmit() {
     setMessage("");
     setError("");
     setBusy(true);
     try {
       if (isSignUp) {
         const { error } = await supabase!.auth.signUp({ email, password });
         if (error) throw error;
         setMessage("注册成功！请查收验证邮件（如果没有收到，可以先试试直接登录）。");
       } else {
         const { error } = await supabase!.auth.signInWithPassword({ email, password });
         if (error) throw error;
         router.replace("/");
       }
     } catch (e: any) {
       setError(e.message || "操作失败，请重试");
     }
     setBusy(false);
   }
 
   return (
     <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col items-center justify-center gap-6 px-4">
       <div className="text-center">
         <h1 className="text-4xl font-semibold">欢愉值</h1>
         <p className="mt-2 text-sm text-slate-500">时间银行</p>
       </div>
 
       <form
         onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}
         className="flex w-full flex-col gap-4 rounded-[28px] border border-white/70 bg-white/88 p-6 shadow-soft backdrop-blur"
       >
         <h2 className="text-lg font-semibold">{isSignUp ? "注册" : "登录"}</h2>
 
         <label className="flex flex-col gap-1 text-sm font-semibold text-slate-600">
           邮箱
           <input
             className="h-12 rounded-2xl border border-line bg-white px-4 outline-none focus:border-aqua"
             type="email"
             placeholder="you@example.com"
             value={email}
             onChange={(e) => setEmail(e.target.value)}
             required
           />
         </label>
 
         <label className="flex flex-col gap-1 text-sm font-semibold text-slate-600">
           密码
           <input
             className="h-12 rounded-2xl border border-line bg-white px-4 outline-none focus:border-aqua"
             type="password"
             placeholder="至少 6 位"
             value={password}
             onChange={(e) => setPassword(e.target.value)}
             minLength={6}
             required
           />
         </label>
 
         {error && <p className="rounded-2xl bg-red-50 p-3 text-sm text-red-600">{error}</p>}
         {message && <p className="rounded-2xl bg-green-50 p-3 text-sm text-green-700">{message}</p>}
 
         <div className="flex gap-3">
           {isSignUp ? (
             <>
               <button
                 type="submit"
                 disabled={busy}
                 className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-aqua text-white font-semibold disabled:opacity-50"
               >
                 <UserPlus size={18} /> 注册
               </button>
               <button
                 type="button"
                 onClick={() => setIsSignUp(false)}
                 className="h-12 rounded-2xl bg-mist px-4 font-semibold text-ink"
               >
                 ← 返回登录
               </button>
             </>
           ) : (
             <>
               <button
                 type="submit"
                 disabled={busy}
                 className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-aqua text-white font-semibold disabled:opacity-50"
               >
                 <LogIn size={18} /> 登录
               </button>
               <button
                 type="button"
                 onClick={() => setIsSignUp(true)}
                 className="h-12 rounded-2xl bg-mist px-4 font-semibold text-ink"
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
