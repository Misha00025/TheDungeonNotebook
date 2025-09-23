CREATE TABLE IF NOT EXISTS `group` (
  `group_id` int NOT NULL AUTO_INCREMENT,
  `name` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `photo_link` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  PRIMARY KEY (`group_id`)
) ENGINE=InnoDB AUTO_INCREMENT=0 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `charlist_template` (
  `template_id` int NOT NULL AUTO_INCREMENT,
  `group_id` int NOT NULL,
  `uuid` text NOT NULL,
  PRIMARY KEY (`template_id`),
  KEY `charlist_template_group_FK` (`group_id`),
  CONSTRAINT `charlist_template_group_FK` FOREIGN KEY (`group_id`) REFERENCES `group` (`group_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=0 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `character` (
  `character_id` int NOT NULL AUTO_INCREMENT,
  `group_id` int NOT NULL,
  `template_id` int NOT NULL,
  `owner_id` int DEFAULT NULL,
  `uuid` text NOT NULL,
  PRIMARY KEY (`character_id`),
  KEY `IX_character_group_id` (`group_id`),
  KEY `character_charlist_template_FK` (`template_id`),
  CONSTRAINT `character_charlist_template_FK` FOREIGN KEY (`template_id`) REFERENCES `charlist_template` (`template_id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `FK_character_group_group_id` FOREIGN KEY (`group_id`) REFERENCES `group` (`group_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=0 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `item` (
  `item_id` int NOT NULL AUTO_INCREMENT,
  `group_id` int NOT NULL,
  `uuid` text NOT NULL,
  PRIMARY KEY (`item_id`),
  KEY `IX_item_group_id` (`group_id`),
  CONSTRAINT `FK_item_group_group_id` FOREIGN KEY (`group_id`) REFERENCES `group` (`group_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=0 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `skill` (
  `skill_id` int NOT NULL AUTO_INCREMENT,
  `group_id` int NOT NULL,
  `uuid` text NOT NULL,
  PRIMARY KEY (`skill_id`),
  KEY `IX_skill_group_id` (`group_id`),
  CONSTRAINT `FK_skill_group_group_id` FOREIGN KEY (`group_id`) REFERENCES `group` (`group_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=0 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `character_skill` (
  `skill_id` int NOT NULL,
  `character_id` int NOT NULL,
  PRIMARY KEY (`character_id`, `skill_id`),
  FOREIGN KEY (`character_id`) REFERENCES `character`(`character_id`) ON DELETE CASCADE,
  FOREIGN KEY (`skill_id`) REFERENCES `skill`(`skill_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=0 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;