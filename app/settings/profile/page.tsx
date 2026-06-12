"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/app/components/page-header";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    username: "",
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((json) => {
        if (json.user) {
          setForm((f) => ({
            ...f,
            name: json.user.name || "",
            username: json.user.username || "",
          }));
        }
      })
      .catch(() => toast.error("获取用户信息失败"))
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("姓名不能为空");
      return;
    }
    if (!form.oldPassword.trim()) {
      toast.error("请输入旧密码");
      return;
    }
    if (form.newPassword && form.newPassword !== form.confirmPassword) {
      toast.error("两次输入的新密码不一致");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/users/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          username: form.username.trim(),
          oldPassword: form.oldPassword,
          newPassword: form.newPassword || undefined,
          confirmPassword: form.confirmPassword || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "保存失败");
        return;
      }

      toast.success("保存成功");
      setForm((f) => ({ ...f, oldPassword: "", newPassword: "", confirmPassword: "" }));

      if (json.needRelogin) {
        toast.info("账号已变更，请重新登录");
        router.push("/login");
      } else {
        router.refresh();
      }
    } catch {
      toast.error("保存失败");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-6 p-8">
        <PageHeader showBack title="个人设置" description="修改个人账号信息" />
        <div className="h-32 rounded-lg border bg-card animate-pulse" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-8">
      <PageHeader showBack title="个人设置" description="修改个人账号信息" />

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="text-lg">基本信息</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-5">
            <div className="grid gap-2.5">
              <Label htmlFor="name" className="text-base">姓名</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="你的姓名"
                className="h-11 text-base px-4"
              />
            </div>
            <div className="grid gap-2.5">
              <Label htmlFor="username" className="text-base">账号</Label>
              <Input
                id="username"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="登录账号"
                className="h-11 text-base px-4"
              />
            </div>
            <div className="grid gap-2.5">
              <Label htmlFor="oldPassword" className="text-base">旧密码</Label>
              <Input
                id="oldPassword"
                type="password"
                value={form.oldPassword}
                onChange={(e) => setForm({ ...form, oldPassword: e.target.value })}
                placeholder="修改信息需验证旧密码"
                className="h-11 text-base px-4"
              />
            </div>
            <div className="grid gap-2.5">
              <Label htmlFor="newPassword" className="text-base">新密码（可选）</Label>
              <Input
                id="newPassword"
                type="password"
                value={form.newPassword}
                onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
                placeholder="不修改则留空"
                className="h-11 text-base px-4"
              />
            </div>
            <div className="grid gap-2.5">
              <Label htmlFor="confirmPassword" className="text-base">确认新密码</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={form.confirmPassword}
                onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                placeholder="不修改则留空"
                className="h-11 text-base px-4"
              />
            </div>
            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={saving} className="h-11 px-6">
                {saving ? "保存中..." : "保存"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
