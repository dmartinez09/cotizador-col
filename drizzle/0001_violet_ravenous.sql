CREATE TABLE `clients` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` text NOT NULL,
	`zone` varchar(100) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `clients_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`description` text NOT NULL,
	`category` varchar(50) NOT NULL,
	`presentation` varchar(50) NOT NULL,
	`cost` int NOT NULL,
	`price` int NOT NULL,
	`stock` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `products_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quotationItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`quotationId` int NOT NULL,
	`productId` int NOT NULL,
	`quantity` int NOT NULL,
	`unitPrice` int NOT NULL,
	`unitCost` int NOT NULL,
	`isBonus` int NOT NULL DEFAULT 0,
	`subtotal` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `quotationItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quotations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`vendorId` int NOT NULL,
	`subtotal` int NOT NULL,
	`iva` int NOT NULL,
	`total` int NOT NULL,
	`totalCost` int NOT NULL,
	`grossProfit` int NOT NULL,
	`grossMargin` int NOT NULL,
	`status` enum('pendiente','aprobada','rechazada') NOT NULL DEFAULT 'pendiente',
	`approvedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `quotations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('vendedor','coordinador','admin') NOT NULL DEFAULT 'vendedor';