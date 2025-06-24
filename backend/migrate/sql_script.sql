DROP TABLE IF EXISTS `item`;
DROP TABLE IF EXISTS `character`;
DROP TABLE IF EXISTS `charlist_template`;
DROP TABLE IF EXISTS `user_group`;
DROP TABLE IF EXISTS `group_bot_token`;
DROP TABLE IF EXISTS `group`;
DROP TABLE IF EXISTS `user_token`;
DROP TABLE IF EXISTS `user`;

CREATE TABLE `user` (
  `user_id` int NOT NULL AUTO_INCREMENT,
  `first_name` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `last_name` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `photo_link` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
  PRIMARY KEY (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=0 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `user_token` (
  `token` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `user_id` int NOT NULL,
  `last_date` datetime(6) NOT NULL,
  PRIMARY KEY (`token`),
  KEY `IX_user_token_user_id` (`user_id`),
  CONSTRAINT `FK_user_token_user_user_id` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `group` (
  `group_id` int NOT NULL AUTO_INCREMENT,
  `name` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `photo_link` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  PRIMARY KEY (`group_id`)
) ENGINE=InnoDB AUTO_INCREMENT=0 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `group_bot_token` (
  `service_token` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `group_id` int NOT NULL,
  PRIMARY KEY (`service_token`),
  KEY `IX_group_bot_token_group_id` (`group_id`),
  CONSTRAINT `FK_group_bot_token_group_group_id` FOREIGN KEY (`group_id`) REFERENCES `group` (`group_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `user_group` (
  `user_id` int NOT NULL,
  `group_id` int NOT NULL,
  `privileges` int NOT NULL,
  PRIMARY KEY (`user_id`,`group_id`),
  KEY `IX_user_group_group_id` (`group_id`),
  CONSTRAINT `FK_user_group_group_group_id` FOREIGN KEY (`group_id`) REFERENCES `group` (`group_id`) ON DELETE CASCADE,
  CONSTRAINT `FK_user_group_user_user_id` FOREIGN KEY (`user_id`) REFERENCES `user` (`user_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `charlist_template` (
  `template_id` int NOT NULL AUTO_INCREMENT,
  `group_id` int NOT NULL,
  `uuid` text NOT NULL,
  PRIMARY KEY (`template_id`),
  KEY `charlist_template_group_FK` (`group_id`),
  CONSTRAINT `charlist_template_group_FK` FOREIGN KEY (`group_id`) REFERENCES `group` (`group_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=0 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `character` (
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

CREATE TABLE `item` (
  `item_id` int NOT NULL AUTO_INCREMENT,
  `group_id` int NOT NULL,
  `uuid` text NOT NULL,
  PRIMARY KEY (`item_id`),
  KEY `IX_item_group_id` (`group_id`),
  CONSTRAINT `FK_item_group_group_id` FOREIGN KEY (`group_id`) REFERENCES `group` (`group_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=0 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
