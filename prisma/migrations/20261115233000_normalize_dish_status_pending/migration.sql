-- 菜品状态机收敛：历史 pending 归一到 draft。
-- 逐值显式映射，不使用模糊条件；执行前已只读盘点 status 取值。
UPDATE `dishes` SET `status` = 'draft' WHERE `status` = 'pending';
