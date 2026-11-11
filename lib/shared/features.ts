/**
 * 试运行功能开关。
 *
 * 采购仍显示在导航中，但页面与 API 同时锁定；后续开放时只需把这里改为 true。
 */
export const TRIAL_FEATURES = {
  purchases: false,
} as const;
