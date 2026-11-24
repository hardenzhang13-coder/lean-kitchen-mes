"use client";

import { startTransition, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChefHat,
  CircleAlert,
  Droplet,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Route,
  User,
} from "lucide-react";
import { Input } from "@/app/components/ui/form-controls";
import { SkeuButton } from "@/app/components/ui/skeu-button";
import { Logo } from "@/app/components/ui/logo";
import { cn } from "@/lib/shared/utils";
import { toast } from "sonner";

interface FormErrors {
  username?: string;
  password?: string;
  general?: string;
}

interface LoginResponse {
  success?: boolean;
  error?: string;
  data?: {
    user?: {
      name?: string;
      username?: string;
    };
  };
}

/** 「记住我」只保存用户名，绝不保存密码。 */
const REMEMBER_KEY = "lean-kms:remembered-username";
const USERNAME_MAX_LENGTH = 50;
const PASSWORD_MAX_LENGTH = 100;

const FEATURES = [
  { icon: Droplet, label: "降低浪费损耗" },
  { icon: Route, label: "减少无效动作" },
  { icon: ChefHat, label: "回归做菜本身" },
] as const;

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    const controller = new AbortController();
    let disposed = false;

    try {
      const saved = window.localStorage.getItem(REMEMBER_KEY);
      if (saved) {
        startTransition(() => {
          setUsername(saved);
          setRemember(true);
        });
      }
    } catch {
      // 隐私模式或本地存储被禁用时，不影响手动登录。
    }

    if (new URLSearchParams(window.location.search).get("expired") === "1") {
      toast.error("登录已过期，请重新登录");
    }

    fetch("/api/auth/me", { signal: controller.signal })
      .then((res) => {
        if (res.ok) {
          router.replace("/");
        }
      })
      .catch(() => {
        // 会话探测失败时保留登录表单，由提交动作给出明确反馈。
      })
      .finally(() => {
        if (!disposed) setChecking(false);
      });

    return () => {
      disposed = true;
      controller.abort();
    };
  }, [router]);

  const clearError = (field: "username" | "password") => {
    setErrors((prev) =>
      prev[field] || prev.general
        ? { ...prev, [field]: undefined, general: undefined }
        : prev
    );
  };

  const validate = () => {
    const next: FormErrors = {};

    if (!username.trim()) {
      next.username = "请输入用户名";
    } else if (username.trim().length > USERNAME_MAX_LENGTH) {
      next.username = "用户名不能超过 " + USERNAME_MAX_LENGTH + " 个字符";
    }

    if (!password.trim()) {
      next.password = "请输入密码";
    } else if (password.length > PASSWORD_MAX_LENGTH) {
      next.password = "密码不能超过 " + PASSWORD_MAX_LENGTH + " 个字符";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrors({});

    if (!validate()) return;

    const normalizedUsername = username.trim();
    setLoading(true);
    let keepLoading = false;

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: normalizedUsername,
          password,
        }),
      });

      let data: LoginResponse = {};
      try {
        data = (await res.json()) as LoginResponse;
      } catch {
        data = {};
      }

      if (!res.ok) {
        const message = data.error || "登录失败，请稍后重试";
        setErrors({ general: message });
        toast.error(message);
        return;
      }

      try {
        if (remember) {
          window.localStorage.setItem(REMEMBER_KEY, normalizedUsername);
        } else {
          window.localStorage.removeItem(REMEMBER_KEY);
        }
      } catch {
        // 本地存储写入失败不影响本次登录。
      }

      const displayName = data.data?.user?.name || data.data?.user?.username;
      toast.success(displayName ? "欢迎，" + displayName : "登录成功");
      keepLoading = true;
      router.replace("/");
      router.refresh();
    } catch {
      const message = "网络错误，请检查连接后重试";
      setErrors({ general: message });
      toast.error(message);
    } finally {
      if (!keepLoading) setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-white">
        <Loader2 className="size-6 animate-spin text-primary" aria-hidden />
      </div>
    );
  }

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-white text-[#2d2419]">
      {/* 画布氛围：仅两团极淡暖光晕，无色块实体 */}
      <div
        aria-hidden
        className="pointer-events-none fixed -top-[180px] -right-[160px] z-0 size-[560px] rounded-full bg-[radial-gradient(circle_at_40%_40%,rgba(249,115,22,0.08),rgba(249,115,22,0)_70%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none fixed -bottom-[200px] -left-[180px] z-0 size-[480px] rounded-full bg-[radial-gradient(circle_at_60%_40%,rgba(234,88,12,0.06),rgba(234,88,12,0)_68%)]"
      />

      <div className="relative z-10 mx-auto flex w-full max-w-[1240px] flex-1 flex-col">
        {/* 顶栏：LOGO 固定左上角（位置不可动） */}
        <header className="flex items-center justify-between px-6 pt-5">
          <div className="flex items-center gap-3">
            <Logo className="h-11 w-11" />
            <div>
              <p className="text-[17px] font-bold leading-tight tracking-[0.02em]">
                精益厨房
              </p>
              <p className="mt-0.5 text-xs text-[#a08e78]">Lean Kitchen Suite</p>
            </div>
          </div>
          <span className="text-xs uppercase tracking-[0.3em] text-[#a08e78]">
            Lean Kitchen
          </span>
        </header>

        <main className="grid flex-1 grid-cols-[1.1fr_0.9fr] items-center gap-12 px-6 py-2">
          {/* 左：品牌叙事 */}
          <section>
            <h1 className="text-[clamp(32px,3.6vw,48px)] font-extrabold leading-[1.22] tracking-[-0.01em]">
              面向现代商业后厨的
              <span className="block text-[#ea580c]">生产管理平台。</span>
            </h1>
            <span
              aria-hidden
              className="mt-7 block h-0.5 w-10 rounded-full bg-[#ea580c]"
            />
            <p className="mt-5 max-w-[440px] text-[14.5px] leading-[1.75] text-[#6b5d4d]">
              让数千万中餐厨房的生产管理变得更简单。
            </p>
            <ul className="mt-12 flex flex-wrap gap-9">
              {FEATURES.map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-center gap-2.5">
                  <span className="grid size-8 flex-none place-items-center rounded-full border border-[#f97316]/20 bg-[#fff4ea] text-[#ea580c]">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <span className="text-[13.5px] font-bold text-[#6b5d4d]">
                    {label}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {/* 右：暖橙面板 + 登录卡（唯一焦点） */}
          <section className="relative flex min-h-[600px] items-center justify-center overflow-hidden rounded-3xl bg-[linear-gradient(160deg,#fefbf6_0%,#fbf3e6_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(460px_300px_at_84%_10%,rgba(251,146,60,0.09),transparent_70%),radial-gradient(300px_240px_at_8%_92%,rgba(255,243,228,0.6),transparent_72%)]"
            />
            {/* 单个静态装饰角标，不做浮动动画 */}
            <div
              aria-hidden
              className="absolute right-7 top-6 size-14 rotate-12 rounded-[18px] bg-[linear-gradient(150deg,#fb923c,#f97316)] opacity-85"
            />

            <div className="relative z-10 w-full max-w-[400px] rounded-[20px] bg-white px-8 pb-[30px] pt-9 text-center shadow-[0_16px_40px_-16px_rgba(120,72,20,0.2),0_4px_16px_-8px_rgba(120,72,20,0.1)]">
              <Logo className="mx-auto h-[52px] w-[52px]" />
              <h2 className="mt-4 text-[21px] font-extrabold tracking-[-0.01em]">
                精益厨房KMES管理系统
              </h2>

              <form onSubmit={handleSubmit} noValidate className="mt-7 text-left">
                <div>
                  <label
                    htmlFor="login-username"
                    className="mb-1.5 block text-xs font-semibold text-[#6b5d4d]"
                  >
                    用户名
                  </label>
                  <div className="relative">
                    <User
                      className="pointer-events-none absolute left-[13px] top-1/2 size-4 -translate-y-1/2 text-[#b09a7e]"
                      aria-hidden
                    />
                    <Input
                      id="login-username"
                      value={username}
                      onChange={(event) => {
                        setUsername(event.target.value);
                        clearError("username");
                      }}
                      autoComplete="username"
                      maxLength={USERNAME_MAX_LENGTH}
                      aria-invalid={!!errors.username || undefined}
                      aria-describedby={
                        errors.username ? "login-username-error" : undefined
                      }
                      className={cn(
                        "h-11 pl-10 pr-4 text-[13.5px]",
                        errors.username && "border-destructive"
                      )}
                    />
                  </div>
                  {errors.username && (
                    <p
                      id="login-username-error"
                      role="alert"
                      className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-destructive"
                    >
                      <CircleAlert className="size-3.5" aria-hidden />
                      {errors.username}
                    </p>
                  )}
                </div>

                <div className="mt-4">
                  <label
                    htmlFor="login-password"
                    className="mb-1.5 block text-xs font-semibold text-[#6b5d4d]"
                  >
                    密码
                  </label>
                  <div className="relative">
                    <Lock
                      className="pointer-events-none absolute left-[13px] top-1/2 size-4 -translate-y-1/2 text-[#b09a7e]"
                      aria-hidden
                    />
                    <Input
                      id="login-password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(event) => {
                        setPassword(event.target.value);
                        clearError("password");
                      }}
                      autoComplete="current-password"
                      maxLength={PASSWORD_MAX_LENGTH}
                      aria-invalid={!!errors.password || undefined}
                      aria-describedby={
                        errors.password ? "login-password-error" : undefined
                      }
                      className={cn(
                        "h-11 pl-10 pr-11 text-[13.5px]",
                        errors.password && "border-destructive"
                      )}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((visible) => !visible)}
                      aria-label={showPassword ? "隐藏密码" : "显示密码"}
                      className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-[9px] text-[#b09a7e] transition-colors hover:bg-[#fff4ea] hover:text-[#ea580c] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--sk-focus)]"
                    >
                      {showPassword ? (
                        <EyeOff className="size-[17px]" aria-hidden />
                      ) : (
                        <Eye className="size-[17px]" aria-hidden />
                      )}
                    </button>
                  </div>
                  {errors.password && (
                    <p
                      id="login-password-error"
                      role="alert"
                      className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-destructive"
                    >
                      <CircleAlert className="size-3.5" aria-hidden />
                      {errors.password}
                    </p>
                  )}
                </div>

                <div className="mb-5 mt-1 flex items-center justify-between">
                  <label className="flex cursor-pointer select-none items-center gap-[7px] text-[12.5px] text-[#6b5d4d]">
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={(event) => setRemember(event.target.checked)}
                      className="peer sr-only"
                    />
                    <span className="grid size-[17px] place-items-center rounded-[5px] border-[1.5px] border-[#d9c6a8] bg-white text-white transition-colors peer-checked:border-[#f97316] peer-checked:bg-[#f97316] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[color:var(--sk-focus)]">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={3.5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="size-[11px]"
                        aria-hidden
                      >
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    </span>
                    记住我
                  </label>
                  <a
                    href="#"
                    onClick={(event) => event.preventDefault()}
                    className="text-[12.5px] font-semibold text-[#ea580c] hover:underline"
                  >
                    忘记密码？
                  </a>
                </div>

                {errors.general && (
                  <p
                    id="login-general-error"
                    role="alert"
                    className="mb-4 flex items-center gap-1.5 rounded-[var(--sk-radius-xs)] border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs font-medium text-destructive"
                  >
                    <CircleAlert className="size-3.5 flex-none" aria-hidden />
                    {errors.general}
                  </p>
                )}

                <SkeuButton
                  type="submit"
                  variant="primary"
                  size="lg"
                  disabled={loading}
                  className="h-12 w-full text-[14px] tracking-[0.02em]"
                >
                  <span
                    aria-live="polite"
                    className="inline-flex items-center justify-center gap-2"
                  >
                    {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
                    {loading ? "登录中..." : "安全登录"}
                  </span>
                </SkeuButton>
              </form>

              <p className="mt-4 text-xs text-[#a08e78]">
                登录即表示同意平台的
                <a
                  href="#"
                  onClick={(event) => event.preventDefault()}
                  className="font-semibold text-[#ea580c] hover:underline"
                >
                  服务条款
                </a>
                与
                <a
                  href="#"
                  onClick={(event) => event.preventDefault()}
                  className="font-semibold text-[#ea580c] hover:underline"
                >
                  隐私政策
                </a>
              </p>
            </div>
          </section>
        </main>

        <footer className="flex items-center justify-between px-6 pb-6 pt-3 text-xs text-[#a08e78]">
          <span>v3.0 · © 2026 精益厨房 · 保留所有权利</span>
          <span>
            由 <b className="font-bold text-[#6b5d4d]">Lean Digital Services</b> 驱动
          </span>
        </footer>
      </div>
    </div>
  );
}
