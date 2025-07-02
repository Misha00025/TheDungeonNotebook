CREATE TABLE IF NOT EXISTS `user` (
    `user_id` INT PRIMARY KEY,
    `nickname` VARCHAR(255) NOT NULL UNIQUE,
    `visible_name` VARCHAR(255),
    `image_link` TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `linked_services` (
    `user_id` INT,
    `platform` ENUM('VK', 'Telegram', 'Instagram') NOT NULL,
    `platform_id` VARCHAR(255) NOT NULL,
    
    PRIMARY KEY (`user_id`, `platform`),
    FOREIGN KEY (`user_id`) REFERENCES `user`(`user_id`)
) ENGINE=InnoDB CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;