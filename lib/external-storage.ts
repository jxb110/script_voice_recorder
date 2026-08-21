import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";

export const SHARED_STORAGE_URI = "file:///storage/emulated/0/";
export const RECORDINGS_RELATIVE_DIR = "record_jxb/wave";
export const RECORDINGS_DIRECTORY_URI = `${SHARED_STORAGE_URI}${RECORDINGS_RELATIVE_DIR}/`;

type AllFilesPermission = { checkAndGrantPermission: () => Promise<boolean> };

export type SharedStorageEntry = {
  name: string;
  relativePath: string;
  isDirectory: boolean;
  size: number;
  modifiedAt?: number;
};

function getPermissionModule() {
  if (Platform.OS === "web") throw new Error("全目录文件管理仅支持重新构建后的 Android 应用。");
  const module = require("react-native-external-storage-permission") as { default?: AllFilesPermission; PermissionFile?: AllFilesPermission };
  return module.default ?? module.PermissionFile;
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

export function sharedUri(relativePath = "", isDirectory = false) {
  const relative = normalizeRelativePath(relativePath);
  return `${SHARED_STORAGE_URI}${relative}${isDirectory && relative ? "/" : ""}`;
}

export function relativePathFromUri(uri: string) {
  if (!uri.startsWith(SHARED_STORAGE_URI)) throw new Error("不允许访问共享存储以外的位置。");
  return normalizeRelativePath(uri.slice(SHARED_STORAGE_URI.length));
}

export async function requestAllFilesAccess() {
  const permission = getPermissionModule();
  if (!permission?.checkAndGrantPermission) throw new Error("未找到全文件权限模块。请重新构建并安装 APK。 ");
  const granted = await permission.checkAndGrantPermission();
  if (!granted) throw new Error("需要在系统设置中允许“管理所有文件”后才能开启文件快传。");
  await FileSystem.makeDirectoryAsync(RECORDINGS_DIRECTORY_URI, { intermediates: true });
  return true;
}

export async function listSharedDirectory(relativePath = "") {
  const normalized = normalizeRelativePath(relativePath);
  const directoryUri = sharedUri(normalized, true);
  const names = await FileSystem.readDirectoryAsync(directoryUri);
  const entries = await Promise.all(names.map(async (name) => {
    const relative = normalized ? `${normalized}/${name}` : name;
    const info = await FileSystem.getInfoAsync(sharedUri(relative));
    const size = info.exists ? info.size ?? 0 : 0;
    const modifiedAt = info.exists ? info.modificationTime : undefined;
    return {
      name,
      relativePath: relative,
      isDirectory: Boolean(info.exists && info.isDirectory),
      size,
      modifiedAt,
    } satisfies SharedStorageEntry;
  }));
  return entries.sort((left, right) => Number(right.isDirectory) - Number(left.isDirectory) || left.name.localeCompare(right.name, "zh-Hans-CN"));
}

export async function createSharedDirectory(parentPath: string, name: string) {
  const parent = normalizeRelativePath(parentPath);
  const relative = parent ? `${parent}/${childName(name)}` : childName(name);
  await FileSystem.makeDirectoryAsync(sharedUri(relative, true), { intermediates: false });
  return relative;
}

export async function saveSharedFile(parentPath: string, name: string, base64: string) {
  const parent = normalizeRelativePath(parentPath);
  const relative = parent ? `${parent}/${childName(name)}` : childName(name);
  await FileSystem.writeAsStringAsync(sharedUri(relative), base64, { encoding: FileSystem.EncodingType.Base64 });
  return relative;
}

export async function saveSharedText(parentPath: string, name: string, content: string) {
  const parent = normalizeRelativePath(parentPath);
  const relative = parent ? `${parent}/${childName(name)}` : childName(name);
  await FileSystem.writeAsStringAsync(sharedUri(relative), content, { encoding: FileSystem.EncodingType.UTF8 });
  return relative;
}

export async function deleteSharedEntry(relativePath: string) {
  const relative = normalizeRelativePath(relativePath);
  if (!relative) throw new Error("不能删除共享存储根目录。");
  await FileSystem.deleteAsync(sharedUri(relative), { idempotent: false });
}

export async function readSharedFileBase64(relativePath: string) {
  const relative = normalizeRelativePath(relativePath);
  const info = await FileSystem.getInfoAsync(sharedUri(relative));
  if (!info.exists || info.isDirectory) throw new Error("文件不存在或不是可下载的文件。");
  return { base64: await FileSystem.readAsStringAsync(sharedUri(relative), { encoding: FileSystem.EncodingType.Base64 }), size: info.size ?? 0 };
}
