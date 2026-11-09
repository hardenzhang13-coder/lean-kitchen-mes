-- 存量排程编号回填（迁移 20261107140000_add_schedule_code 之后执行一次）
-- 规则：SCH-生产日期-当日序号（按 id 排序），仅回填 code 为空的行
UPDATE schedules s
JOIN (
  SELECT id,
         DATE_FORMAT(schedule_date, '%Y%m%d') AS ymd,
         ROW_NUMBER() OVER (PARTITION BY DATE(schedule_date) ORDER BY id) AS rn
  FROM schedules
  WHERE code IS NULL
) t ON s.id = t.id
SET s.code = CONCAT('SCH-', t.ymd, '-', LPAD(t.rn, 3, '0'));
