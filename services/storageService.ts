
import { Dish, UserPreferences } from "../types";

const DB_NAME = "WhatToEatDB";
const OLD_DB_NAME = "DeliciousSecretsDB";
const STORE_NAME = "dishes";
const DB_VERSION = 1;
const RECENTLY_VIEWED_KEY = "recently-viewed-ids";
const PREFERENCES_KEY = "user-preferences";
const MAX_RECENT = 5;

export class StorageService {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  /**
   * 初始化数据库 - 采用单例 Promise 模式，防止并发冲突
   */
  async init(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      // 尝试静默迁移旧数据（不阻塞主逻辑）
      try {
        await this.tryMigrateFromOldDB();
      } catch (e) {
        console.warn("旧数据库迁移失败，跳过...", e);
      }

      return new Promise((resolve, reject) => {
        if (!window.indexedDB) {
          return reject("您的浏览器不支持本地数据库，请更换现代浏览器。");
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = (event) => {
          console.error("IndexedDB 开启失败:", event);
          this.initPromise = null; // 允许下次重试
          reject("无法打开本地存储。如果是无痕模式，请尝试正常模式访问。");
        };

        request.onsuccess = (event) => {
          this.db = (event.target as IDBOpenDBRequest).result;
          
          this.db.onversionchange = () => {
            this.db?.close();
            window.location.reload();
          };
          
          resolve();
        };

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: "id" });
          }
        };
      });
    })();

    return this.initPromise;
  }

  private async tryMigrateFromOldDB(): Promise<void> {
    return new Promise((resolve) => {
      // 仅仅是尝试开启，如果不成功或不存在则直接 resolve
      const request = indexedDB.open(OLD_DB_NAME);
      request.onsuccess = (event) => {
        const oldDb = (event.target as IDBOpenDBRequest).result;
        if (oldDb.objectStoreNames.contains(STORE_NAME)) {
          const transaction = oldDb.transaction([STORE_NAME], "readonly");
          const store = transaction.objectStore(STORE_NAME);
          const allDataRequest = store.getAll();
          
          allDataRequest.onsuccess = () => {
            // 这里只是检测，真正的迁移目前在 initApp 逻辑中处理
            oldDb.close();
            resolve();
          };
          allDataRequest.onerror = () => {
            oldDb.close();
            resolve();
          };
        } else {
          oldDb.close();
          resolve();
        }
      };
      request.onerror = () => resolve();
    });
  }

  async getAllDishes(): Promise<Dish[]> {
    await this.init();
    return new Promise((resolve, reject) => {
      if (!this.db) return reject("数据库未就绪");
      try {
        const transaction = this.db.transaction([STORE_NAME], "readonly");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject("读取数据失败");
      } catch (e) {
        reject(e);
      }
    });
  }

  async saveDish(dish: Dish): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      if (!this.db) return reject("数据库未就绪");
      try {
        const transaction = this.db.transaction([STORE_NAME], "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(dish);

        request.onsuccess = () => resolve();
        request.onerror = (event) => {
          const error = (event.target as any).error;
          if (error && error.name === 'QuotaExceededError') {
            reject("存储空间已满。请删除一些不需要的菜谱或清理浏览器缓存。");
          } else {
            reject("保存失败，请稍后重试。");
          }
        };
      } catch (e) {
        reject(e);
      }
    });
  }

  async deleteDish(id: string): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      if (!this.db) return reject("数据库未就绪");
      try {
        const transaction = this.db.transaction([STORE_NAME], "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);

        request.onsuccess = () => {
          const recentlyViewed = this.getRecentlyViewedIds();
          const updated = recentlyViewed.filter(viewedId => viewedId !== id);
          localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(updated));
          resolve();
        };
        request.onerror = () => reject("删除数据失败");
      } catch (e) {
        reject(e);
      }
    });
  }

  async exportData(): Promise<string> {
    const dishes = await this.getAllDishes();
    return JSON.stringify(dishes, null, 2);
  }

  async importData(json: string): Promise<Dish[]> {
    try {
      const dishes = JSON.parse(json);
      if (!Array.isArray(dishes)) throw new Error("数据格式无效。");
      
      for (const dish of dishes) {
        if (dish.id && dish.name) {
          await this.saveDish(dish);
        }
      }
      return await this.getAllDishes();
    } catch (e) {
      throw e;
    }
  }

  getRecentlyViewedIds(): string[] {
    try {
      const saved = localStorage.getItem(RECENTLY_VIEWED_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  }

  recordView(id: string): string[] {
    let ids = this.getRecentlyViewedIds();
    ids = ids.filter(viewedId => viewedId !== id);
    ids.unshift(id);
    ids = ids.slice(0, MAX_RECENT);
    try {
      localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(ids));
    } catch (e) {}
    return ids;
  }

  async migrateFromLocalStorage(): Promise<void> {
    const saved = localStorage.getItem("my-dishes") || localStorage.getItem("delicious-secrets-dishes");
    if (!saved) return;

    try {
      const dishes = JSON.parse(saved);
      if (Array.isArray(dishes)) {
        for (const dish of dishes) {
          await this.saveDish(dish);
        }
        localStorage.removeItem("my-dishes");
        localStorage.removeItem("delicious-secrets-dishes");
      }
    } catch (e) {
      console.error("LocalStorage 迁移失败", e);
    }
  }

  getUserPreferences(): UserPreferences {
    try {
      const saved = localStorage.getItem(PREFERENCES_KEY);
      return saved ? JSON.parse(saved) : { flavors: [] };
    } catch (e) {
      return { flavors: [] };
    }
  }

  saveUserPreferences(prefs: UserPreferences): void {
    try {
      localStorage.setItem(PREFERENCES_KEY, JSON.stringify(prefs));
    } catch (e) {}
  }
}

export const storageService = new StorageService();
