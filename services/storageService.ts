import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
  writeBatch
} from 'firebase/firestore';
import {
  ref as storageRef,
  uploadString,
  getDownloadURL,
  deleteObject
} from 'firebase/storage';
import type { User } from 'firebase/auth';
import { db, storage } from './firebase';
import { Dish, Folder, UserPreferences, AppUser } from '../types';

const RECENTLY_VIEWED_KEY = 'recently-viewed-ids';
const MAX_RECENT = 5;
const LEGACY_DB_NAMES = ['WhatToEatDB', 'DeliciousSecretsDB'];
const LEGACY_STORE_NAME = 'dishes';
const LEGACY_PREFS_KEY = 'user-preferences';
// Global to the device, not per-user: whoever signs in first claims the local
// IndexedDB data. Prevents re-importing the first user's recipes into a second
// user's cloud account on a shared device.
const MIGRATION_DONE_KEY = 'cloud-migration-claimed';

const isDataUrl = (url: string | undefined): url is string =>
  !!url && url.startsWith('data:');

const inferContentType = (dataUrl: string): string => {
  const match = /^data:([^;]+);/.exec(dataUrl);
  return match?.[1] ?? 'image/jpeg';
};

class StorageService {
  private currentUser: User | null = null;
  private cachedAppUser: AppUser | null = null;
  private cachedPrefs: UserPreferences | null = null;

  setCurrentUser(user: User | null) {
    if (this.currentUser?.uid !== user?.uid) {
      this.cachedAppUser = null;
      this.cachedPrefs = null;
    }
    this.currentUser = user;
  }

  private requireUser(): User {
    if (!this.currentUser) {
      throw new Error('未登录，无法访问云端菜谱。请先用 Google 登录。');
    }
    return this.currentUser;
  }

  /**
   * Initialize for the signed-in user: ensure their `users/{uid}` doc and
   * default "My Recipes" folder exist, then run the one-time IndexedDB
   * migration if it hasn't been done for this account on this device.
   */
  async init(): Promise<void> {
    const user = this.requireUser();
    await this.ensureUserAndDefaultFolder(user);
    if (!localStorage.getItem(MIGRATION_DONE_KEY)) {
      try {
        await this.migrateLegacyIndexedDB();
      } catch (e) {
        console.warn('迁移本地数据失败，已跳过：', e);
      }
      localStorage.setItem(MIGRATION_DONE_KEY, '1');
    }
  }

  private async ensureUserAndDefaultFolder(user: User): Promise<AppUser> {
    if (this.cachedAppUser && this.cachedAppUser.uid === user.uid) {
      return this.cachedAppUser;
    }
    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      this.cachedAppUser = userSnap.data() as AppUser;
      return this.cachedAppUser;
    }

    // First-time sign-in: create user doc + default "My Recipes" folder.
    const folderRef = doc(collection(db, 'folders'));
    const now = Date.now();
    const folder: Folder = {
      id: folderRef.id,
      name: '我的菜谱',
      creatorUid: user.uid,
      memberUids: [user.uid],
      visibility: 'private',
      createdAt: now
    };
    const appUser: AppUser = {
      uid: user.uid,
      displayName: user.displayName ?? '',
      email: user.email ?? '',
      photoURL: user.photoURL ?? '',
      defaultFolderId: folderRef.id,
      createdAt: now
    };
    const batch = writeBatch(db);
    batch.set(folderRef, folder);
    batch.set(userRef, appUser);
    await batch.commit();
    this.cachedAppUser = appUser;
    return appUser;
  }

  async getAppUser(): Promise<AppUser> {
    const user = this.requireUser();
    return this.ensureUserAndDefaultFolder(user);
  }

  async getDefaultFolderId(): Promise<string> {
    const appUser = await this.getAppUser();
    return appUser.defaultFolderId;
  }

  /**
   * Returns dishes the current user owns (across all folders they own).
   * In Phase 1 each user has only their own default folder, so this is the
   * "my collection" view. In Phase 2 we'll add per-folder queries.
   */
  async getAllDishes(): Promise<Dish[]> {
    const user = this.requireUser();
    const q = query(collection(db, 'dishes'), where('ownerUid', '==', user.uid));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as Dish);
  }

  async saveDish(dish: Dish): Promise<void> {
    const user = this.requireUser();
    const folderId = dish.folderId ?? (await this.getDefaultFolderId());

    // Upload cover image if it's still a data URL.
    let imageUrl = dish.imageUrl;
    if (isDataUrl(imageUrl)) {
      imageUrl = await this.uploadImage(`dishes/${dish.id}/cover`, imageUrl);
    }

    // Upload any per-step images that are still data URLs.
    const instructions = await Promise.all(
      dish.instructions.map(async (step, idx) => {
        if (isDataUrl(step.imageUrl)) {
          const stepUrl = await this.uploadImage(
            `dishes/${dish.id}/step-${idx}`,
            step.imageUrl
          );
          return { ...step, imageUrl: stepUrl };
        }
        return step;
      })
    );

    const cloudDish: Dish = {
      ...dish,
      imageUrl,
      instructions,
      ownerUid: user.uid,
      folderId
    };

    await setDoc(doc(db, 'dishes', dish.id), cloudDish);
  }

  async deleteDish(id: string): Promise<void> {
    this.requireUser();
    // Try to delete cover image; ignore if it doesn't exist.
    try {
      await deleteObject(storageRef(storage, `dishes/${id}/cover`));
    } catch {
      /* noop */
    }
    await deleteDoc(doc(db, 'dishes', id));

    const recent = this.getRecentlyViewedIds().filter(rid => rid !== id);
    localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(recent));
  }

  async exportData(): Promise<string> {
    const dishes = await this.getAllDishes();
    return JSON.stringify(dishes, null, 2);
  }

  async importData(json: string): Promise<Dish[]> {
    const dishes = JSON.parse(json);
    if (!Array.isArray(dishes)) throw new Error('数据格式无效。');
    for (const dish of dishes) {
      if (dish?.id && dish?.name) {
        await this.saveDish(dish);
      }
    }
    return this.getAllDishes();
  }

  // Recently-viewed stays in localStorage — it's a per-device UX list, not
  // shared data, so no need to round-trip through the cloud.
  getRecentlyViewedIds(): string[] {
    try {
      const saved = localStorage.getItem(RECENTLY_VIEWED_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  }

  recordView(id: string): string[] {
    let ids = this.getRecentlyViewedIds().filter(vid => vid !== id);
    ids.unshift(id);
    ids = ids.slice(0, MAX_RECENT);
    try {
      localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(ids));
    } catch {
      /* noop */
    }
    return ids;
  }

  /**
   * Preferences live in localStorage for now (per-device), and are loaded
   * synchronously on first access. They'll move to `users/{uid}.preferences`
   * in a later pass once we have UI to manage them across devices.
   */
  getUserPreferences(): UserPreferences {
    if (this.cachedPrefs) return this.cachedPrefs;
    try {
      const saved = localStorage.getItem(LEGACY_PREFS_KEY);
      this.cachedPrefs = saved ? JSON.parse(saved) : { flavors: [] };
    } catch {
      this.cachedPrefs = { flavors: [] };
    }
    return this.cachedPrefs!;
  }

  saveUserPreferences(prefs: UserPreferences): void {
    this.cachedPrefs = prefs;
    try {
      localStorage.setItem(LEGACY_PREFS_KEY, JSON.stringify(prefs));
    } catch {
      /* noop */
    }
  }

  /**
   * No-op kept for backwards-compatible call sites in App.tsx. The actual
   * legacy IndexedDB migration runs inside init() once per (user, device).
   */
  async migrateFromLocalStorage(): Promise<void> {
    return;
  }

  private async uploadImage(path: string, dataUrl: string): Promise<string> {
    const ref = storageRef(storage, path);
    const contentType = inferContentType(dataUrl);
    await uploadString(ref, dataUrl, 'data_url', { contentType });
    return getDownloadURL(ref);
  }

  /**
   * Read any dishes left in the user's IndexedDB and upload them to Firestore
   * + Storage under their default folder. Runs once per (user, device).
   */
  private async migrateLegacyIndexedDB(): Promise<void> {
    if (!('indexedDB' in window)) return;
    const folderId = await this.getDefaultFolderId();

    const localDishes: Dish[] = [];
    for (const dbName of LEGACY_DB_NAMES) {
      const fromThisDb = await this.readLegacyDishes(dbName);
      for (const d of fromThisDb) {
        if (!localDishes.find(existing => existing.id === d.id)) {
          localDishes.push(d);
        }
      }
    }
    if (localDishes.length === 0) return;

    // Skip any that already exist in the cloud (e.g. a partial earlier run).
    const existing = await this.getAllDishes();
    const existingIds = new Set(existing.map(d => d.id));

    for (const dish of localDishes) {
      if (existingIds.has(dish.id)) continue;
      try {
        await this.saveDish({ ...dish, folderId });
      } catch (e) {
        console.warn('迁移单个菜谱失败：', dish.name, e);
      }
    }
  }

  private readLegacyDishes(dbName: string): Promise<Dish[]> {
    return new Promise(resolve => {
      if (!('indexedDB' in window)) return resolve([]);
      const open = indexedDB.open(dbName);
      open.onerror = () => resolve([]);
      open.onsuccess = () => {
        const db = open.result;
        if (!db.objectStoreNames.contains(LEGACY_STORE_NAME)) {
          db.close();
          return resolve([]);
        }
        try {
          const tx = db.transaction([LEGACY_STORE_NAME], 'readonly');
          const store = tx.objectStore(LEGACY_STORE_NAME);
          const all = store.getAll();
          all.onsuccess = () => {
            db.close();
            resolve((all.result as Dish[]) ?? []);
          };
          all.onerror = () => {
            db.close();
            resolve([]);
          };
        } catch {
          db.close();
          resolve([]);
        }
      };
    });
  }
}

export const storageService = new StorageService();
