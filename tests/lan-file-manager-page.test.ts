import { describe, expect, it } from "vitest";

import { fileManagerHtmlPage } from "@/lib/lan-file-manager-page";

describe("局域网文件管理页面", () => {
  it("初始化默认录音目录，避免目录读取与上传时引用未定义状态", () => {
    const page = fileManagerHtmlPage();

    expect(page).toContain("var current='record_jxb/wave'");
    expect(page).toContain("/api/fs/list?path=");
    expect(page).toContain("/api/fs/upload");
  });

  it("提供页面错误反馈，便于电脑端定位浏览器脚本问题", () => {
    expect(fileManagerHtmlPage()).toContain("window.onerror=function");
  });

  it("生成的浏览器脚本具备有效语法", () => {
    const script = fileManagerHtmlPage().match(/<script>([\s\S]*)<\/script>/)?.[1];

    expect(script).toBeTruthy();
    expect(() => new Function(script!)).not.toThrow();
  });
});
