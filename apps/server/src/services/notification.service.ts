import type { Notification } from "@aic/core";
import type { ConsoleRepository } from "@aic/db";

export class NotificationService {
  constructor(private readonly repo: ConsoleRepository) {}

  listForUser(userId: string): Notification[] {
    return this.repo.listNotifications(userId);
  }

  createTestNotification(userId: string): Notification {
    return this.repo.createNotification({
      userId,
      sessionId: null,
      type: "system",
      title: "测试通知",
      body: "通知链路已经接入 SQLite 和 API。",
      status: "pending"
    });
  }

  markDelivered(notificationId: string): Notification {
    const notification = this.repo.markNotificationDelivered(notificationId);
    if (!notification) {
      throw new Error(`Notification does not exist: ${notificationId}`);
    }
    return notification;
  }
}
