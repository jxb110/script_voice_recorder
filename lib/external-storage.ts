import { Platform } from "react-native";

export const RECORDINGS_RELATIVE_DIR = "record_jxb/wave";
export const SHARED_STORAGE_DISPLAY_ROOT = "/storage/emulated/0";

type AllFilesPermission = { checkAndGrantPermission: () => Promise<boolean> };
type NativeFileSystem = {
  ExternalStorageDirectoryPath: string;
  copyFile: (from: string, to: string) => Promise<void>;
  exists: (path: string) => Promise<boolean>;
  mkdir: (path: string) => Promise<void>;
  readDir: (path: string) => Promise<Array<{ name: string; path: string; size: number; mtime?: Date; isDirectory: () => boolean }>>;
  readFile: (path: string, encoding: "base64") => Promise<string>;
  stat: (path: string) => Promise<{ isDirectory: () => boolean; size: number }>;
  unlink: (path: string) => Promise<void>;
  writeFile: (path: string, content: string, encoding: "base64" | "utf8") => Promise<void>;
};

export type SharedStorageEntry = {
  name: string;
  relativePath: string;
  isDirectory: boolean;
  size: number;
  modifiedAt?: number;
};

export type SharedStorageArchiveFile = {
  archivePath: string;
  base64: string;
  size: number;
};

function getPermissionModule() {
  if (Platform.OS === "web") throw new Error("全目录文件管理仅支持重新构建后的 Android 应用。");
  const module = require("react-native-external-storage-permission") as { default?: AllFilesPermission; PermissionFile?: AllFilesPermission };
  return module.default ?? module.PermissionFile;
}

function getNativeFileSystem(): NativeFileSystem {
  if (Platform.OS === "web") throw new Error("共享存储文件管理仅支持重新构建后的 Android 应用。");
  const module = require("@dr.pogodin/react-native-fs") as { default?: NativeFileSystem } & NativeFileSystem;
  return module.default ?? module;
}

function normalizeRelativePath(value?: string) {
  const parts = decodeURIComponent(value ?? "")
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean);
  if (parts.some((part) => part === "." || part === "..")) throw new Error("目录路径无效。");
  return parts.join("/");
}

function childName(value: string) {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "." || trimmed === ".." || /[\\/\0]/.test(trimmed)) throw new Error("文件或目录名称无效。");
  return trimmed;
}

function nativePath(uriOrPath: string) {
  return uriOrPath.replace(/^file:\/\//, "");
}

export function sharedPath(relativePath = "", isDirectory = false) {
  const relative = normalizeRelativePath(relativePath);
  const root = getNativeFileSystem().ExternalStorageDirectoryPath || SHARED_STORAGE_DISPLAY_ROOT;
  const result = relative ? `${root}/${relative}` : root;
  return `${result}${isDirectory && relative ? "/" : ""}`;
}

export function sharedUri(relativePath = "", isDirectory = false) {
  return `file://${sharedPath(relativePath, isDirectory)}`;
}

export async function requestAllFilesAccess() {
  const permission = getPermissionModule();
  if (!permission?.checkAndGrantPermission) throw new Error("未找到全文件权限模块。请重新构建并安装 APK。 ");
  const granted = await permission.checkAndGrantPermission();
  if (!granted) throw new Error("需要在系统设置中允许“管理所有文件”后才能开启文件快传。 ");
  await getNativeFileSystem().mkdir(sharedPath(RECORDINGS_RELATIVE_DIR, true));
  return true;
}

export async function listSharedDirectory(relativePath = "") {
  const normalized = normalizeRelativePath(relativePath);
  const nativeFs = getNativeFileSystem();
  const rootPath = sharedPath();
  const items = await nativeFs.readDir(sharedPath(normalized, true));
  const entries = items.map((item) => ({
    name: item.name,
    relativePath: normalizeRelativePath(item.path.slice(rootPath.length)),
    isDirectory: item.isDirectory(),
    size: item.size,
    modifiedAt: item.mtime?.getTime(),
  } satisfies SharedStorageEntry));
  return entries.sort((left, right) => Number(right.isDirectory) - Number(left.isDirectory) || left.name.localeCompare(right.name, "zh-Hans-CN"));
}

export async function createSharedDirectory(parentPath: string, name: string) {
  const parent = normalizeRelativePath(parentPath);
  const relative = parent ? `${parent}/${childName(name)}` : childName(name);
  await getNativeFileSystem().mkdir(sharedPath(relative, true));
  return relative;
}

export async function saveSharedFile(parentPath: string, name: string, base64: string) {
  const parent = normalizeRelativePath(parentPath);
  const relative = parent ? `${parent}/${childName(name)}` : childName(name);
  const nativeFs = getNativeFileSystem();
  await nativeFs.mkdir(sharedPath(parent, true));
  await nativeFs.writeFile(sharedPath(relative), base64, "base64");
  return relative;
}

export async function saveSharedText(parentPath: string, name: string, content: string) {
  const parent = normalizeRelativePath(parentPath);
  const relative = parent ? `${parent}/${childName(name)}` : childName(name);
  const nativeFs = getNativeFileSystem();
  await nativeFs.mkdir(sharedPath(parent, true));
  await nativeFs.writeFile(sharedPath(relative), content, "utf8");
  return relative;
}

export async function deleteSharedEntry(relativePath: string) {
  const relative = normalizeRelativePath(relativePath);
  if (!relative) throw new Error("不能删除共享存储根目录。");
  const nativeFs = getNativeFileSystem();
  const target = sharedPath(relative);
  if (!(await nativeFs.exists(target))) throw new Error("目标文件或目录不存在。");
  await nativeFs.unlink(target);
}

export async function readSharedFileBase64(relativePath: string) {
  const relative = normalizeRelativePath(relativePath);
  const nativeFs = getNativeFileSystem();
  const target = sharedPath(relative);
  if (!(await nativeFs.exists(target))) throw new Error("文件不存在或不是可下载的文件。");
  const info = await nativeFs.stat(target);
  if (info.isDirectory()) throw new Error("文件不存在或不是可下载的文件。");
  return { base64: await nativeFs.readFile(target, "base64"), size: info.size };
}

export async function readSharedDirectoryArchive(relativePath: string, maximumBytes: number) {
  const directory = normalizeRelativePath(relativePath);
  if (!directory) throw new Error("请选择需要下载的目录。");
  const nativeFs = getNativeFileSystem();
  const info = await nativeFs.stat(sharedPath(directory, true));
  if (!info.isDirectory()) throw new Error("目标不是目录。");
  const archiveRoot = directory.split("/").pop() ?? "folder";
  const files: SharedStorageArchiveFile[] = [];
  let totalBytes = 0;

  const visit = async (current: string, archivePrefix: string): Promise<void> => {
    const children = await nativeFs.readDir(sharedPath(current, true));
    for (const child of children) {
      const childRelative = normalizeRelativePath(child.path.slice(sharedPath().length));
      const archivePath = `${archivePrefix}/${child.name}`;
      if (child.isDirectory()) {
        await visit(childRelative, archivePath);
        continue;
      }
      totalBytes += child.size;
      if (totalBytes > maximumBytes) throw new Error(`文件夹内容超过 ${Math.floor(maximumBytes / 1024 / 1024)} MB，无法一次打包下载。请进入子目录分别下载。`);
      files.push({ archivePath, base64: await nativeFs.readFile(child.path, "base64"), size: child.size });
    }
  };

  await visit(directory, archiveRoot);
  return { files, totalBytes, archiveRoot };
}

export async function copyPrivateFileToSharedStorage(sourceUri: string, relativePath: string) {
  const relative = normalizeRelativePath(relativePath);
  const parent = relative.includes("/") ? relative.slice(0, relative.lastIndexOf("/")) : "";
  const nativeFs = getNativeFileSystem();
  await nativeFs.mkdir(sharedPath(parent, true));
  await nativeFs.copyFile(nativePath(sourceUri), sharedPath(relative));
  return sharedUri(relative);
}
