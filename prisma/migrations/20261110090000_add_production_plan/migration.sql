-- CreateTable
CREATE TABLE `production_plans` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `plan_date` DATE NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT '待生效',
    `operator` VARCHAR(191) NULL,
    `cutting_json` JSON NULL,
    `purchase_json` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `production_plans_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `production_plan_schedules` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `plan_id` INTEGER NOT NULL,
    `schedule_id` INTEGER NOT NULL,

    UNIQUE INDEX `production_plan_schedules_plan_id_schedule_id_key`(`plan_id`, `schedule_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `production_plan_schedules` ADD CONSTRAINT `production_plan_schedules_plan_id_fkey` FOREIGN KEY (`plan_id`) REFERENCES `production_plans`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `production_plan_schedules` ADD CONSTRAINT `production_plan_schedules_schedule_id_fkey` FOREIGN KEY (`schedule_id`) REFERENCES `schedules`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;