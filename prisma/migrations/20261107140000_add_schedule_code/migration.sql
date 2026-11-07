ALTER TABLE schedules ADD COLUMN code VARCHAR(191) NULL;
CREATE UNIQUE INDEX schedules_code_key ON schedules(code);
