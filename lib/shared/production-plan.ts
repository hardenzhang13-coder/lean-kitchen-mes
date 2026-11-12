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

export interface ProductionPlanSourceSnapshot {
  version: 1;
  stores: ProductionPlanSourceSnapshotStore[];
}

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

/** 将来源排程按门店分组，生成生产计划单的门店菜单快照。 */
export function buildSourceScheduleSnapshot(
  schedules: SourceScheduleSnapshotInput[]
): ProductionPlanSourceSnapshot {
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
