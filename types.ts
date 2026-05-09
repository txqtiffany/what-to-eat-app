
export enum Category {
  SICHUAN = '川菜',
  CANTONESE = '粤菜',
  SHANDONG = '鲁菜',
  HUAIYANG = '淮扬菜',
  INTERNATIONAL = '全球',
  NOODLES = '面食/主食',
  DESSERT = '甜点/点心',
  HOME_COOKING = '家常菜',
  OTHER = '其他'
}

export enum DishType {
  MEAT = '荤菜',
  VEGGIES = '素菜',
  SOUP = '汤羹',
  SEAFOOD = '海鲜',
  COLD = '凉菜',
  STAPLE = '主食',
  SNACK = '小吃'
}

export interface Ingredient {
  name: string;
  amount: string;
}

export interface InstructionStep {
  text: string;
  timeMinutes: number;
  imageUrl?: string;
}

export interface Nutrition {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
}

export interface Dish {
  id: string;
  name: string;
  category: Category;
  dishType?: DishType;
  ingredients: Ingredient[];
  instructions: InstructionStep[];
  description: string;
  tips?: string[];
  nutrition?: Nutrition; // 新增：营养信息
  imageUrl?: string;
  createdAt: number;
  // Cloud-sync metadata (added in Phase 1; older local dishes may not have these
  // until they are migrated to Firestore).
  ownerUid?: string;
  folderId?: string;
  originalDishId?: string;     // set if this dish was saved-from another user's dish
  originalOwnerUid?: string;   // attribution for save-copies
}

export type FolderVisibility = 'private' | 'invite-only' | 'public-link';

export interface Folder {
  id: string;
  name: string;
  creatorUid: string;
  memberUids: string[];
  visibility: FolderVisibility;
  shareToken?: string;
  createdAt: number;
}

export interface AppUser {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
  defaultFolderId: string;
  createdAt: number;
}

export interface SuggestedDish {
  name: string;
  category: Category;
  dishType: DishType;
  reason: string;
  missingIngredients?: string[];
}

export interface UserPreferences {
  flavors: string[];
}
