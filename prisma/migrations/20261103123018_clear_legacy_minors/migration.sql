-- 小料模块升级：清空存量「直接录入」小料（无来源原料、10g 计价的旧数据）
-- 小料重建为「原料转化」模式，与净料完全同口径（来源原料 + 出成率 + 封装规格 + 加工费，元/斤计价）
-- 注意删除顺序：dish_minor_details 对 net_ingredients 有外键且无级联，先删子表

DELETE d FROM dish_minor_details d
  JOIN net_ingredients n ON d.net_ing_id = n.id
  JOIN ingredient_categories_l2 c ON n.l2_code = c.code
  WHERE c.parent_code = 'MIN';

DELETE n FROM net_ingredients n
  JOIN ingredient_categories_l2 c ON n.l2_code = c.code
  WHERE c.parent_code = 'MIN';
