/**
 * 菜品状态枚举与状态迁移（前后端共用纯函数，唯一真源）。
 *
 * 状态语义：
 * - draft      草稿：可编辑、可删除，不可用于新建排程
 * - published  已发布：锁定基础信息/BOM/工艺，可用于新建排程
 * - inactive   已停用：锁定，不可用于新建排程；历史排程与生产计划保留
 *
 * 落库值使用短值（draft / published / inactive），中文标签只用于展示。
 */

export const DISH_STATUS_VALUES = ["draft", "published", "inactive"] as const;

export type DishStatus = (typeof DISH_STATUS_VALUES)[number];

export type DishStatusVariant =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral";

export type DishStatusOption = {
  value: DishStatus;
  label: string;
  description: string;
  variant: DishStatusVariant;
};

export const DISH_STATUS_OPTIONS: DishStatusOption[] = [
  {
    value: "draft",
    label: "草稿",
    description: "可编辑、可删除，不可用于新建排程",
    variant: "neutral",
  },
  {
    value: "published",
    label: "已发布",
    description: "锁定编辑，可用于新建排程",
    variant: "success",
  },
  {
    value: "inactive",
    label: "已停用",
    description: "不可用于新建排程，历史排程与生产计划保留",
    variant: "warning",
  },
];

const DISH_STATUS_MAP = new Map(
  DISH_STATUS_OPTIONS.map((option) => [option.value, option])
);

/** 状态索引（对外）：value → 枚举项，避免各模块重复建 Map。 */
export const DISH_STATUS_OPTION_BY_VALUE = DISH_STATUS_MAP;

/** 取菜品状态枚举项；非枚举值返回 null。 */
export function getDishStatusOption(
  status: string | null | undefined
): DishStatusOption | null {
  if (!status) return null;
  return DISH_STATUS_MAP.get(status as DishStatus) ?? null;
}

/** 菜品状态是否为合法枚举值。 */
export function isValidDishStatus(
  status: string | null | undefined
): status is DishStatus {
  return getDishStatusOption(status) != null;
}

/** 状态动作：发布 / 下架 / 停用 / 恢复发布 */
export const DISH_STATUS_ACTIONS = [
  "publish",
  "unpublish",
  "deactivate",
  "restore",
] as const;

export type DishStatusAction = (typeof DISH_STATUS_ACTIONS)[number];

export type DishStatusTransition = {
  action: DishStatusAction;
  label: string;
  /** 允许执行该动作的源状态 */
  from: readonly DishStatus[];
  to: DishStatus;
};

export const DISH_STATUS_TRANSITIONS: Record<
  DishStatusAction,
  DishStatusTransition
> = {
  publish: {
    action: "publish",
    label: "发布",
    from: ["draft"],
    to: "published",
  },
  unpublish: {
    action: "unpublish",
    label: "下架",
    from: ["published", "inactive"],
    to: "draft",
  },
  deactivate: {
    action: "deactivate",
    label: "停用",
    from: ["published"],
    to: "inactive",
  },
  restore: {
    action: "restore",
    label: "恢复发布",
    from: ["inactive"],
    to: "published",
  },
};

/** 取状态动作定义；非法动作返回 null。 */
export function getDishStatusTransition(
  action: string | null | undefined
): DishStatusTransition | null {
  if (!action) return null;
  return (
    DISH_STATUS_TRANSITIONS[action as DishStatusAction] ?? null
  );
}

/** 当前状态是否允许执行该动作。 */
export function canTransitionDishStatus(
  from: string | null | undefined,
  action: DishStatusAction
): boolean {
  const transition = DISH_STATUS_TRANSITIONS[action];
  return transition.from.includes(from as DishStatus);
}

/** 动作是否为合法枚举值。 */
export function isDishStatusAction(
  action: string | null | undefined
): action is DishStatusAction {
  return getDishStatusTransition(action) != null;
}
