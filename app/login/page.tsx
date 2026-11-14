"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CircleAlert } from "lucide-react";
import { Input } from "@/app/components/ui/form-controls";
import { Button } from "@/components/ui/button";
import { Logo } from "@/app/components/ui/logo";
import { cn } from "@/lib/shared/utils";
import { toast } from "sonner";

interface FormErrors {
  username?: string;
  password?: string;
  general?: string;
}

/** 进入动效类（globals.css 定义，animation-delay 逐元素递增） */
const RISE = "rise-in";
const delay = (ms: number) => ({ animationDelay: `${ms}ms` });

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    // session 过期由 lib/client/api.ts 统一跳转 ?expired=1，此处给出人性化提示
    if (new URLSearchParams(window.location.search).get("expired") === "1") {
      toast.error("登录已过期，请重新登录");
    }
    fetch("/api/auth/me")
      .then((res) => {
        if (res.ok) {
          router.replace("/");
        }
      })
      .finally(() => setChecking(false));
  }, [router]);

  const validate = (): boolean => {
    const next: FormErrors = {};
    if (!username.trim()) next.username = "请输入用户名";
    if (!password.trim()) next.password = "请输入密码";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    if (!validate()) return;

    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`欢迎，${data.data?.user?.name || data.data?.user?.username}`);
        router.replace("/");
        router.refresh();
      } else {
        const message = data.error || "登录失败";
        setErrors({ general: message });
        toast.error(message);
      }
    } catch {
      const message = "网络错误，请稍后重试";
      setErrors({ general: message });
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <Logo className="h-12 w-12 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-white">
      {/* ── 品牌区（桌面端） ── */}
      <aside className="relative hidden w-[55%] flex-col justify-between overflow-hidden p-12 lg:flex xl:w-[58%]">
        {/* 暖色氛围：左上极淡洗光 + 右下橙光，统一白色画布上的唯一色彩层次 */}
        <div
          aria-hidden
          className="pointer-events-none absolute -left-32 -top-32 h-[420px] w-[420px]"
          style={{
            background:
              "radial-gradient(closest-side, color-mix(in oklch, var(--primary) 5%, transparent), transparent)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-40 -right-40 h-[480px] w-[480px]"
          style={{
            background:
              "radial-gradient(closest-side, color-mix(in oklch, var(--primary) 12%, transparent), transparent)",
          }}
        />
        {/* 同心细环，慢旋转 */}
        <svg
          aria-hidden
          viewBox="0 0 320 320"
          fill="none"
          className="absolute -bottom-24 -right-24 h-80 w-80 animate-[spin_60s_linear_infinite] text-foreground/[0.08]"
        >
          <circle cx="160" cy="160" r="150" stroke="currentColor" />
          <circle cx="160" cy="160" r="110" stroke="currentColor" />
          <circle cx="160" cy="160" r="70" stroke="currentColor" />
          <circle
            cx="160"
            cy="160"
            r="34"
            stroke="var(--primary)"
            strokeOpacity="0.18"
          />
        </svg>

        {/* 顶栏：品牌 + 英文标识 */}
        <div className={cn("relative flex items-center justify-between", RISE)} style={delay(0)}>
          <div className="flex items-center gap-2.5">
            <Logo className="h-9 w-9" />
            <span className="text-sm font-semibold tracking-tight">精益厨房</span>
          </div>
          <span className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
            Lean Kitchen
          </span>
        </div>

        {/* 主视觉：大字 + 产品语 */}
        <div className="relative">
          <h1 className={cn("text-6xl font-bold tracking-tight xl:text-7xl", RISE)} style={delay(80)}>
            精益厨房
          </h1>
          <span className={cn("mt-8 block h-px w-10 bg-primary", RISE)} style={delay(160)} />
          <p className={cn("mt-6 text-sm text-muted-foreground", RISE)} style={delay(220)}>
            让数千万厨房日常的生产变得更简单
          </p>
        </div>

        {/* 底栏 */}
        <div className={cn("relative font-mono text-[11px] text-muted-foreground", RISE)} style={delay(280)}>
          v3.0 · © 2026 精益厨房
        </div>
      </aside>

      {/* ── 表单区 ── */}
      <main className="flex min-h-screen flex-1 flex-col border-foreground/[0.08] lg:border-l">
        {/* 移动端品牌头 */}
        <header className={cn("flex items-center gap-2.5 p-6 lg:hidden", RISE)} style={delay(0)}>
          <Logo className="h-8 w-8" />
          <span className="text-sm font-semibold tracking-tight">精益厨房</span>
        </header>

        <div className="flex flex-1 items-center justify-center px-6 pb-16 lg:px-4 lg:pb-0">
          <div className="w-full max-w-sm">
            <h2 className={cn("text-2xl font-bold tracking-tight", RISE)} style={delay(120)}>
              精益厨房KMES管理系统
            </h2>
            <p className={cn("mt-2 text-sm text-muted-foreground", RISE)} style={delay(180)}>
              登录以进入系统
            </p>

            <form
              onSubmit={handleSubmit}
              className={cn("mt-10 space-y-4", RISE)}
              style={delay(240)}
              aria-describedby={errors.general ? "login-general-error" : undefined}
            >
              <Input
                aria-label="用户名"
                placeholder="用户名"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  if (errors.username) setErrors((prev) => ({ ...prev, username: undefined }));
                }}
                autoComplete="username"
                autoFocus
                className={cn(
                  "h-12 rounded-xl border-foreground/15 px-4",
                  errors.username && "border-destructive"
                )}
              />
              <Input
                aria-label="密码"
                type="password"
                placeholder="密码"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
                }}
                autoComplete="current-password"
                className={cn(
                  "h-12 rounded-xl border-foreground/15 px-4",
                  errors.password && "border-destructive"
                )}
              />

              {(errors.general || errors.username || errors.password) && (
                <p
                  id="login-general-error"
                  role="alert"
                  className="flex items-center justify-center gap-1.5 text-sm text-destructive"
                >
                  <CircleAlert className="h-4 w-4" />
                  {errors.general || errors.username || errors.password}
                </p>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="h-12 w-full rounded-xl text-[15px] font-semibold transition-all duration-200 hover:-translate-y-px hover:shadow-lg hover:shadow-primary/25"
              >
                <span aria-live="polite" className="inline-flex items-center justify-center gap-2">
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {loading ? "登录中..." : "登录"}
                </span>
              </Button>
            </form>

            {/* 移动端底栏 */}
            <p className={cn("mt-10 text-center font-mono text-[11px] text-muted-foreground lg:hidden", RISE)} style={delay(300)}>
              v3.0 · © 2026 精益厨房
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
