CREATE TABLE IF NOT EXISTS `user_group` (
    `user_id` INT NOT NULL,
    `group_id` INT NOT NULL,
    `is_admin` TINYINT(1) NULL,
    PRIMARY KEY (`user_id`, `group_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `user_character` (
    `user_id` INT NOT NULL,
    `group_id` INT NOT NULL,
    `character_id` INT NOT NULL,
    `can_write` TINYINT(1) NULL,
    PRIMARY KEY (`user_id`, `group_id`, `character_id`),
    FOREIGN KEY (`user_id`, `group_id`) REFERENCES `user_group` (`user_id`, `group_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;