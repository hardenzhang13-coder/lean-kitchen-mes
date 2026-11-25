import {
  FolderTree,
  Package,
  Ruler,
  Scale,
  Store,
  Tags,
  Truck,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";
import { PageShell } from "@/app/components/ui/page-shell";
import { PageHeader } from "@/app/components/ui/page-header";
import { EntryCard } from "@/app/components/ui/entry-card";
import { getCurrentUser } from "@/lib/server/session";
import { isAdmin } from "@/lib/shared/roles";

type SettingsItem = {
  href: string;
  label: string;
  desc: string;
  icon: LucideIcon;
  /** iOS 风格磁贴：渐变底 + 彩色柔影（静置 / hover 增强） */
  tileClass: string;
  /** 仅管理员可见 */
  adminOnly?: boolean;
};

type SettingsGroup = {
  key: string;
  title: string;
  items: SettingsItem[];
};

/**
 * 设置模块信息架构：三大分类，数据驱动渲染。
 * 新增设置项时只需在对应分组的 items 中追加，路由与子页面不受影响。
 */
const SETTING_GROUPS: SettingsGroup[] = [
  {
    key: "dictionary",
    title: "数据字典",
    items: [
      {
        href: "/settings/classes",
        label: "食材分类",
        desc: "食材两级分类体系",
        icon: FolderTree,
        tileClass:
          "bg-[linear-gradient(180deg,#5BBE6E_0%,#2E9E52_100%)] shadow-[0_2px_5px_rgba(46,158,82,0.40),0_5px_14px_rgba(15,23,42,0.10)] group-hover:shadow-[0_4px_10px_rgba(46,158,82,0.48),0_9px_24px_rgba(15,23,42,0.12)]",
      },
      {
        href: "/settings/portions",
        label: "份量",
        desc: "场景份量与计算倍率",
        icon: Scale,
        tileClass:
          "bg-[linear-gradient(180deg,#FFAA33_0%,#F07C1F_100%)] shadow-[0_2px_5px_rgba(240,124,31,0.40),0_5px_14px_rgba(15,23,42,0.10)] group-hover:shadow-[0_4px_10px_rgba(240,124,31,0.48),0_9px_24px_rgba(15,23,42,0.12)]",
      },
      {
        href: "/settings/categories",
        label: "菜品类别",
        desc: "菜品分类字典",
        icon: Tags,
        tileClass:
          "bg-[linear-gradient(180deg,#FF7D92_0%,#E84A64_100%)] shadow-[0_2px_5px_rgba(232,74,100,0.40),0_5px_14px_rgba(15,23,42,0.10)] group-hover:shadow-[0_4px_10px_rgba(232,74,100,0.48),0_9px_24px_rgba(15,23,42,0.12)]",
      },
      {
        href: "/settings/net-packagings",
        label: "净菜包装",
        desc: "净料封装规格",
        icon: Package,
        tileClass:
          "bg-[linear-gradient(180deg,#45BFE3_0%,#1F97C4_100%)] shadow-[0_2px_5px_rgba(31,151,196,0.40),0_5px_14px_rgba(15,23,42,0.10)] group-hover:shadow-[0_4px_10px_rgba(31,151,196,0.48),0_9px_24px_rgba(15,23,42,0.12)]",
      },
      {
        href: "/settings/units",
        label: "单位",
        desc: "计量单位与换算",
        icon: Ruler,
        tileClass:
          "bg-[linear-gradient(180deg,#5B9FFF_0%,#2F6FE0_100%)] shadow-[0_2px_5px_rgba(47,111,224,0.40),0_5px_14px_rgba(15,23,42,0.10)] group-hover:shadow-[0_4px_10px_rgba(47,111,224,0.48),0_9px_24px_rgba(15,23,42,0.12)]",
      },
    ],
  },
  {
    key: "org",
    title: "组织与协作",
    items: [
      {
        href: "/settings/stores",
        label: "门店管理",
        desc: "门店档案与生产场景",
        icon: Store,
        tileClass:
          "bg-[linear-gradient(180deg,#9F8CFF_0%,#6E54E8_100%)] shadow-[0_2px_5px_rgba(110,84,232,0.40),0_5px_14px_rgba(15,23,42,0.10)] group-hover:shadow-[0_4px_10px_rgba(110,84,232,0.48),0_9px_24px_rgba(15,23,42,0.12)]",
      },
      {
        href: "/settings/suppliers",
        label: "供应商",
        desc: "采购供应商档案",
        icon: Truck,
        tileClass:
          "bg-[linear-gradient(180deg,#FFBE4D_0%,#E8992B_100%)] shadow-[0_2px_5px_rgba(232,153,43,0.40),0_5px_14px_rgba(15,23,42,0.10)] group-hover:shadow-[0_4px_10px_rgba(232,153,43,0.48),0_9px_24px_rgba(15,23,42,0.12)]",
      },
    ],
  },
  {
    key: "account",
    title: "账号与权限",
    items: [
      {
        href: "/settings/users",
        label: "用户管理",
        desc: "账号与角色权限",
        icon: Users,
        tileClass:
          "bg-[linear-gradient(180deg,#8E9BFF_0%,#5B6BE8_100%)] shadow-[0_2px_5px_rgba(91,107,232,0.40),0_5px_14px_rgba(15,23,42,0.10)] group-hover:shadow-[0_4px_10px_rgba(91,107,232,0.48),0_9px_24px_rgba(15,23,42,0.12)]",
        adminOnly: true,
      },
      {
        href: "/settings/profile",
        label: "个人资料",
        desc: "个人信息与登录密码",
        icon: UserCog,
        tileClass:
          "bg-[linear-gradient(180deg,#8FA3B8_0%,#5C738C_100%)] shadow-[0_2px_5px_rgba(92,115,140,0.40),0_5px_14px_rgba(15,23,42,0.10)] group-hover:shadow-[0_4px_10px_rgba(92,115,140,0.48),0_9px_24px_rgba(15,23,42,0.12)]",
      },
    ],
  },
];

export default async function SettingsPage() {
  const user = await getCurrentUser();
  const admin = isAdmin(user?.role);

  const groups = SETTING_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.adminOnly || admin),
  })).filter((group) => group.items.length > 0);

  return (
    <PageShell
      variant="panel"
      header={<PageHeader variant="topbar" title="设置" />}
    >
      <div className="min-h-0 flex-1 overflow-y-auto skeu-scroll">
        <div className="mx-auto flex w-full max-w-[1520px] flex-col gap-16 pb-10">
          {groups.map((group) => (
            <section key={group.key} className="flex flex-col gap-3.5">
              <h2 className="text-[15px] font-semibold">{group.title}</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
                {group.items.map((item) => (
                  <EntryCard
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    desc={item.desc}
                    icon={item.icon}
                    tileClass={item.tileClass}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </PageShell>
  );
}
