import {
  FolderTree,
  Package,
  Ruler,
  Store,
  Tags,
  Truck,
  Users,
} from "lucide-react";
import { EntryCard } from "@/app/components/ui/entry-card";
import { PageHeader } from "@/app/components/ui/page-header";
import { PageShell } from "@/app/components/ui/page-shell";
import { getCurrentUser } from "@/lib/server/session";
import { isAdmin } from "@/lib/shared/roles";

type SettingGroup = "basic" | "account";

const settingsItems: {
  href: string;
  label: string;
  desc: string;
  icon: typeof FolderTree;
  group: SettingGroup;
  adminOnly?: boolean;
}[] = [
  {
    href: "/settings/classes",
    label: "食材分类",
    desc: "管理食材一级和二级分类体系",
    icon: FolderTree,
    group: "basic",
  },
  {
    href: "/settings/categories",
    label: "菜品类别",
    desc: "管理菜品分类，如猪肉类、牛肉类、蔬菜类等",
    icon: Tags,
    group: "basic",
  },
  {
    href: "/settings/net-packagings",
    label: "净菜包装",
    desc: "管理净料封装使用的包装名称与尺寸",
    icon: Package,
    group: "basic",
  },
  {
    href: "/settings/units",
    label: "单位",
    desc: "管理重量、体积、计数等单位",
    icon: Ruler,
    group: "basic",
  },
  {
    href: "/settings/stores",
    label: "门店管理",
    desc: "管理门店信息，排程按门店组织生产",
    icon: Store,
    group: "basic",
  },
  {
    href: "/settings/suppliers",
    label: "供应商",
    desc: "管理采购供应商信息",
    icon: Truck,
    group: "basic",
  },
  {
    href: "/settings/users",
    label: "用户管理",
    desc: "管理系统用户账号与角色权限",
    icon: Users,
    group: "account",
    adminOnly: true,
  },
];

const groups: { key: SettingGroup; title: string; description: string }[] = [
  {
    key: "basic",
    title: "基础数据",
    description: "食材、菜品与经营主体的基础档案",
  },
  {
    key: "account",
    title: "账号与权限",
    description: "系统用户与角色权限",
  },
];

export default async function SettingsPage() {
  const user = await getCurrentUser();
  const items = settingsItems.filter(
    (item) => !item.adminOnly || isAdmin(user?.role)
  );

  return (
    <PageShell
      variant="panel"
      header={
        <PageHeader
          variant="topbar"
          title="设置"
          description="管理系统基础数据与用户账号"
        />
      }
    >
      <div className="skeu-desk min-h-0 flex-1 overflow-auto p-4 sm:p-6">
        <div className="mx-auto flex w-full max-w-[1080px] flex-col gap-8">
          {groups.map((group) => {
            const groupItems = items.filter((item) => item.group === group.key);
            if (groupItems.length === 0) return null;

            return (
              <section key={group.key}>
                <div className="mb-3 flex items-end justify-between gap-4">
                  <div>
                    <h2 className="text-[15px] font-semibold text-foreground">
                      {group.title}
                    </h2>
                    <p className="mt-0.5 text-[13px] text-muted-foreground">
                      {group.description}
                    </p>
                  </div>
                  <span className="shrink-0 text-[12px] text-muted-foreground/60">
                    {groupItems.length} 项
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {groupItems.map((item) => (
                    <EntryCard
                      key={item.href}
                      href={item.href}
                      label={item.label}
                      description={item.desc}
                      icon={item.icon}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </PageShell>
  );
}
