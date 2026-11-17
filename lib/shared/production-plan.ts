export interface ProductionPlanSourceSnapshotItem {
  id: number;
  dishId: number;
  dishCode: string;
  dishName: string;
  portion: string;
  meatType: string | null;
  quantity: number;
}

export interface ProductionPlanSourceSnapshotSchedule {
  scheduleId: number;
  code: string | null;
  title: string;
  scheduleDate: string;
  items: ProductionPlanSourceSnapshotItem[];
}

export interface ProductionPlanSourceSnapshotStore {
  storeId: number;
  storeName: string;
  schedules: ProductionPlanSourceSnapshotSchedule[];
}

/** v1：仅门店排程来源（历史计划单）。 */
export interface ProductionPlanSourceSnapshotV1 {
  version: 1;
  stores: ProductionPlanSourceSnapshotStore[];
}

export interface ProductionPlanSourceSnapshotSelfOrderItem {
  sourceType: "net" | "minor";
  sourceId: number;
  itemCode: string;
  itemName: string;
  packageSpec: number;
  unit: string;
  portions: number;
  requiredQty: number;
  grossNeedJin: number;
}

export interface ProductionPlanSourceSnapshotSelfOrder {
  orderId: number;
  code: string | null;
  title: string;
  produceDate: string;
  remark: string | null;
  items: ProductionPlanSourceSnapshotSelfOrderItem[];
}

/** v2：门店排程 + 内部生产单来源。 */
export interface ProductionPlanSourceSnapshotV2 {
  version: 2;
  stores: ProductionPlanSourceSnapshotStore[];
  selfProduction: ProductionPlanSourceSnapshotSelfOrder[];
}

export type ProductionPlanSourceSnapshot =
  | ProductionPlanSourceSnapshotV1
  | ProductionPlanSourceSnapshotV2;

export interface SourceScheduleSnapshotInput {
  id: number;
  code: string | null;
  title: string;
  scheduleDate: Date;
  store: { id: number; name: string };
  items: Array<{
    id: number;
    quantity: number;
    dish: {
      id: number;
      code: string;
      name: string;
      portion: string;
      meatType: string | null;
    };
  }>;
}

export interface SelfProductionSnapshotInput {
  id: number;
  code: string | null;
  title: string;
  produceDate: Date;
  remark: string | null;
  items: ProductionPlanSourceSnapshotSelfOrderItem[];
}

/** 将来源排程按门店分组，生成生产计划单的门店菜单快照。 */
export function buildSourceScheduleSnapshot(
  schedules: SourceScheduleSnapshotInput[]
): ProductionPlanSourceSnapshotV1 {
  const stores = new Map<number, ProductionPlanSourceSnapshotStore>();

  for (const schedule of schedules) {
    const store = stores.get(schedule.store.id) ?? {
      storeId: schedule.store.id,
      storeName: schedule.store.name,
      schedules: [],
    };
    store.schedules.push({
      scheduleId: schedule.id,
      code: schedule.code,
      title: schedule.title,
      scheduleDate: schedule.scheduleDate.toISOString(),
      items: schedule.items.map((item) => ({
        id: item.id,
        dishId: item.dish.id,
        dishCode: item.dish.code,
        dishName: item.dish.name,
        portion: item.dish.portion,
        meatType: item.dish.meatType,
        quantity: item.quantity,
      })),
    });
    stores.set(schedule.store.id, store);
  }

  const sortedStores = [...stores.values()]
    .sort((a, b) => a.storeName.localeCompare(b.storeName, "zh"))
    .map((store) => ({
      ...store,
      schedules: [...store.schedules].sort(
        (a, b) =>
          a.scheduleDate.localeCompare(b.scheduleDate) ||
          (a.code ?? "").localeCompare(b.code ?? "", "zh")
      ),
    }));

  return { version: 1, stores: sortedStores };
}

/** 生产计划单来源快照 v2：门店排程分组 + 内部生产单。 */
export function buildProductionPlanSourceSnapshot(
  schedules: SourceScheduleSnapshotInput[],
  selfOrders: SelfProductionSnapshotInput[]
): ProductionPlanSourceSnapshotV2 {
  const stores = buildSourceScheduleSnapshot(schedules).stores;
  const selfProduction = [...selfOrders]
    .sort(
      (a, b) =>
        a.produceDate.getTime() - b.produceDate.getTime() ||
        (a.code ?? "").localeCompare(b.code ?? "", "zh")
    )
    .map((order) => ({
      orderId: order.id,
      code: order.code,
      title: order.title,
      produceDate: order.produceDate.toISOString(),
      remark: order.remark,
      items: order.items.map((item) => ({ ...item })),
    }));

  return { version: 2, stores, selfProduction };
}
