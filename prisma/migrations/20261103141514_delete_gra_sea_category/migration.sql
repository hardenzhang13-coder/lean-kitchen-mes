-- 清理历史遗留分类 GRA-SEA（米面粮油-调味品）：调料体系统一归属 SEA（调味品）一级分类
-- 引用保护：存在引用时不删除（当前无任何数据引用）
DELETE FROM ingredient_categories_l2
WHERE code = 'GRA-SEA'
  AND NOT EXISTS (SELECT 1 FROM ingredients WHERE l2_code = 'GRA-SEA');
