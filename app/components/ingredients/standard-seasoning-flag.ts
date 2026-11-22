/**
 * 调料转标准规格（standard_seasonings）功能开关。
 *
 * 2026-11 起暂时下线：调料在菜品 BOM 里回到「直接选调料 + 填克数」口径，
 * 不再经过标准规格档案（该口径与实际业务不符）。
 *
 * 需要恢复时把本常量置为 true，并回滚菜品 BOM / 成本口径里的规格化分支
 * （见 memory-bank/progress.md 对应记录）。表、API 与组件文件均保留未删。
 */
export const STANDARD_SEASONING_ENABLED = false;