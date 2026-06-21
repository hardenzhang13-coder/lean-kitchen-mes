"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { FormField } from "@/app/components/form-field";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface FormErrors {
  username?: string;
  password?: string;
  general?: string;
}

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
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
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-sm rounded-xl border bg-card p-8 shadow-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-lg font-bold text-primary-foreground">
            精
          </div>
          <h1 className="text-xl font-semibold tracking-tight">精益厨房 V3</h1>
          <p className="mt-1 text-sm text-muted-foreground">请登录以继续</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" aria-describedby={errors.general ? "login-general-error" : undefined}>
          <FormField
            id="username"
            label="用户名"
            required
            error={errors.username}
          >
            <Input
              placeholder="请输入用户名"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                if (errors.username) setErrors((prev) => ({ ...prev, username: undefined }));
              }}
              autoComplete="username"
            />
          </FormField>
          <FormField
            id="password"
            label="密码"
            required
            error={errors.password}
          >
            <Input
              type="password"
              placeholder="请输入密码"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
              }}
              autoComplete="current-password"
            />
          </FormField>

          {errors.general && (
            <p id="login-general-error" className="text-sm text-destructive text-center" role="alert">
              {errors.general}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            <span aria-live="polite" className="inline-flex items-center justify-center gap-2">
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? "登录中..." : "登录"}
            </span>
          </Button>
        </form>
      </div>
    </div>
  );
}
