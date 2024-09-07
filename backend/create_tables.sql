CREATE TABLE IF NOT EXISTS `vk_group` (
  `vk_group_id` varchar(20) NOT NULL,
  `group_name` varchar(50) DEFAULT NULL,
  `privileges` json DEFAULT NULL,
  PRIMARY KEY (`vk_group_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;

CREATE TABLE IF NOT EXISTS `vk_user` (
  `vk_user_id` varchar(20) NOT NULL,
  `first_name` varchar(30) DEFAULT NULL,
  `last_name` varchar(30) DEFAULT NULL,
  `photo_link` varchar(300) DEFAULT NULL,
  PRIMARY KEY (`vk_user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;

CREATE TABLE IF NOT EXISTS `note` (
  `group_id` varchar(20) NOT NULL,
  `owner_id` varchar(20) NOT NULL,
  `note_id` int NOT NULL AUTO_INCREMENT,
  `header` varchar(100) NOT NULL,
  `description` text NOT NULL,
  `addition_date` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `modified_date` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`note_id`,`group_id`,`owner_id`) USING BTREE,
  UNIQUE KEY `note_id` (`note_id`),
  KEY `grope_id` (`group_id`),
  KEY `owner_id` (`owner_id`),
  CONSTRAINT `note_ibfk_1` FOREIGN KEY (`group_id`) REFERENCES `vk_group` (`vk_group_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `note_ibfk_2` FOREIGN KEY (`owner_id`) REFERENCES `vk_user` (`vk_user_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=69 DEFAULT CHARSET=utf8mb3;

CREATE TABLE IF NOT EXISTS `user_group` (
  `vk_user_id` varchar(20) NOT NULL,
  `vk_group_id` varchar(20) NOT NULL,
  `is_admin` tinyint(1) NOT NULL,
  UNIQUE KEY `vk_user_id` (`vk_user_id`,`vk_group_id`) USING BTREE,
  KEY `groupe_key` (`vk_group_id`),
  CONSTRAINT `groupe_key` FOREIGN KEY (`vk_group_id`) REFERENCES `vk_group` (`vk_group_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `vk_user_key` FOREIGN KEY (`vk_user_id`) REFERENCES `vk_user` (`vk_user_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;

CREATE TABLE IF NOT EXISTS `vk_user_token` (
  `vk_user_id` varchar(20) NOT NULL,
  `token` varchar(150) NOT NULL,
  `last_date` datetime NOT NULL,
  PRIMARY KEY (`token`),
  KEY `user_key` (`vk_user_id`),
  CONSTRAINT `user_key` FOREIGN KEY (`vk_user_id`) REFERENCES `vk_user` (`vk_user_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;

CREATE TABLE IF NOT EXISTS `group_bot_token` (
  `group_id` varchar(20) NOT NULL,
  `service_token` varchar(100) NOT NULL,
  `privileges` json DEFAULT NULL,
  PRIMARY KEY (`service_token`),
  KEY `group_bot_token_vk_group_FK` (`group_id`),
  CONSTRAINT `group_bot_token_vk_group_FK` FOREIGN KEY (`group_id`) REFERENCES `vk_group` (`vk_group_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;

CREATE TABLE IF NOT EXISTS `inventory` (
  `inventory_id` int NOT NULL AUTO_INCREMENT,
  `owner_id` varchar(20) NOT NULL,
  `group_id` varchar(20) NOT NULL,
  PRIMARY KEY (`inventory_id`),
  UNIQUE KEY `inventory_unique` (`owner_id`,`group_id`),
  KEY `inventory_vk_group_FK` (`group_id`),
  CONSTRAINT `inventory_vk_group_FK` FOREIGN KEY (`group_id`) REFERENCES `vk_group` (`vk_group_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `inventory_vk_user_FK` FOREIGN KEY (`owner_id`) REFERENCES `vk_user` (`vk_user_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb3;

CREATE TABLE IF NOT EXISTS `item` (
  `item_id` int NOT NULL AUTO_INCREMENT,
  `group_id` varchar(20) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci NOT NULL,
  `name` varchar(100) DEFAULT NULL,
  `description` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`item_id`),
  UNIQUE KEY `item_unique` (`group_id`,`name`),
  CONSTRAINT `item_vk_group_FK` FOREIGN KEY (`group_id`) REFERENCES `vk_group` (`vk_group_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=66 DEFAULT CHARSET=utf8mb3;

CREATE TABLE IF NOT EXISTS `inventory_item` (
  `inventory_id` int NOT NULL,
  `item_id` int NOT NULL,
  `amount` int NOT NULL,
  KEY `inventory_item_inventory_FK` (`inventory_id`),
  KEY `inventory_item_item_FK` (`item_id`),
  CONSTRAINT `inventory_item_inventory_FK` FOREIGN KEY (`inventory_id`) REFERENCES `inventory` (`inventory_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `inventory_item_item_FK` FOREIGN KEY (`item_id`) REFERENCES `item` (`item_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;
