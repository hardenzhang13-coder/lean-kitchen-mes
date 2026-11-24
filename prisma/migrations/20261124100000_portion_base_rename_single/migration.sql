-- 份量统一第二阶段：基本单元标签「小碗菜」→「单人份」+ 存量数据迁移（2026-11-24）
--
-- M1 份量档案：isBase 行 API 锁定不可改，只能 SQL 直改标签
--    范围：portion_profiles WHERE portion='小碗菜' AND is_base=1（盘点 1 行）
--    回滚：UPDATE `portion_profiles` SET `portion`='小碗菜' WHERE `portion`='单人份' AND `is_base`=1
UPDATE `portion_profiles` SET `portion` = '单人份' WHERE `portion` = '小碗菜' AND `is_base` = 1;

-- M2 菜品档案存量值迁移（2026-11-24 只读盘点 2 行；不含默认值回填，仅改存量标签）
--    回滚：UPDATE `dishes` SET `portion`='小碗菜' WHERE `portion`='单人份'
UPDATE `dishes` SET `portion` = '单人份' WHERE `portion` = '小碗菜';

-- M3 净料/小料档案存量值迁移（2026-11-24 只读盘点 2 行；portion IS NULL 的 15 行不动）
--    回滚：UPDATE `net_ingredients` SET `portion`='小碗菜' WHERE `portion`='单人份'
UPDATE `net_ingredients` SET `portion` = '单人份' WHERE `portion` = '小碗菜';

-- M4 新建菜品默认份量随基本单元改名（schema @default 同步为「单人份」，不影响存量行）
ALTER TABLE `dishes` MODIFY `portion` VARCHAR(191) NOT NULL DEFAULT '单人份';
