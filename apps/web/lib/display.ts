export function statusLabel(status: string): string {
  return (
    {
      idle: "空闲",
      starting: "启动中",
      running: "运行中",
      waiting_for_user: "等待人工",
      stopping: "停止中",
      stopped: "已停止",
      failed: "报错",
      completed: "已完成",
      unavailable: "不可用"
    }[status] ?? status
  );
}

export function fileChangeLabel(changeType: string): string {
  return (
    {
      added: "新增",
      modified: "修改",
      deleted: "删除",
      renamed: "重命名"
    }[changeType] ?? changeType
  );
}

export function notificationStatusLabel(status: string): string {
  return (
    {
      pending: "待处理",
      delivered: "已读",
      failed: "失败",
      muted: "已静默"
    }[status] ?? status
  );
}

export function logStreamLabel(stream: string): string {
  return (
    {
      stdout: "标准输出",
      stderr: "标准错误",
      agent: "Agent 日志",
      system: "系统"
    }[stream] ?? stream
  );
}

export function agentLabel(name: string): string {
  return (
    {
      "No-op Agent": "空跑智能体",
      "Codex CLI": "Codex 命令行"
    }[name] ?? name
  );
}

export function sessionTitleLabel(title: string | null | undefined): string | null {
  if (!title) {
    return title ?? null;
  }
  return title.replaceAll("No-op Agent session", "空跑智能体会话").replaceAll("Codex CLI session", "Codex 命令行会话");
}

export function authTokenLabel(name: string | null | undefined, fallback: string): string {
  if (!name) {
    return fallback;
  }
  return (
    {
      Login: "登录",
      "Phone access": "手机访问"
    }[name] ?? name
  );
}
