
import React, { useState, useEffect } from 'react';
import { Dish, UserPreferences, InstructionStep, SuggestedDish } from './types';
import CollectionView from './views/CollectionView';
import SuggestView from './views/SuggestView';
import RecipeView from './views/RecipeView';
import DiscoveryView from './views/DiscoveryView';
import GlobalChatBot from './components/GlobalChatBot';
import { storageService } from './services/storageService';
import { geminiService } from './services/geminiService';

interface PendingDish {
  id: string;
  name: string;
  status: string;
}

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<'collection' | 'suggest' | 'recipe' | 'discovery'>('collection');
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [pendingDishes, setPendingDishes] = useState<PendingDish[]>([]);
  const [recentlyViewedIds, setRecentlyViewedIds] = useState<string[]>([]);
  const [selectedDishId, setSelectedDishId] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [syncStatus, setSyncStatus] = useState<'syncing' | 'saved' | 'error'>('saved');
  const [preferences, setPreferences] = useState<UserPreferences>({ flavors: [] });
  
  const [discoveryCache, setDiscoveryCache] = useState<SuggestedDish[]>([]);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
  };

  useEffect(() => {
    const initApp = async () => {
      try {
        setSyncStatus('syncing');
        await storageService.init();
        await storageService.migrateFromLocalStorage();
        const loadedDishes = await storageService.getAllDishes();
        const recentIds = storageService.getRecentlyViewedIds();
        const savedPrefs = storageService.getUserPreferences();
        
        setDishes(loadedDishes.sort((a, b) => b.createdAt - a.createdAt));
        setRecentlyViewedIds(recentIds);
        setPreferences(savedPrefs);
        setSyncStatus('saved');
      } catch (e) {
        console.error("初始化失败", e);
        setSyncStatus('error');
      } finally {
        setTimeout(() => setIsInitializing(false), 800);
      }
    };

    initApp();
  }, []);

  const addDish = async (dish: Dish) => {
    try {
      setSyncStatus('syncing');
      await storageService.saveDish(dish);
      setDishes(prev => [dish, ...prev]);
      setSyncStatus('saved');
      showToast(`已成功收藏 ${dish.name}！`, 'success');
    } catch (e) {
      setSyncStatus('error');
      const errorMsg = typeof e === 'string' ? e : "保存失败，请检查浏览器存储设置。";
      showToast(errorMsg, 'error');
    }
  };

  const regenerateDishImage = async (id: string) => {
    const dish = dishes.find(d => d.id === id);
    if (!dish) return;

    try {
      setSyncStatus('syncing');
      const newUrl = await geminiService.generateDishImage(dish.name);
      const updatedDish = { ...dish, imageUrl: newUrl };
      await storageService.saveDish(updatedDish);
      setDishes(prev => prev.map(d => d.id === id ? updatedDish : d));
      setSyncStatus('saved');
      showToast("封面图已重新生成", 'success');
    } catch (err) {
      setSyncStatus('error');
      showToast("生成封面失败，请重试", 'error');
    }
  };

  const startBackgroundGeneration = async (dishName: string) => {
    const tempId = Date.now().toString();
    setPendingDishes(prev => [...prev, { id: tempId, name: dishName, status: '构思中...' }]);

    try {
      const details = await geminiService.getRecipeDetails(dishName, preferences);
      setPendingDishes(prev => prev.map(p => p.id === tempId ? { ...p, status: '绘图中...' } : p));
      
      let coverUrl: string | undefined = undefined;
      try {
        coverUrl = await geminiService.generateDishImage(dishName);
      } catch (imgErr) {
        console.warn("Cover image failed", imgErr);
      }

      const finalSteps: InstructionStep[] = details.instructions.map(step => ({
        ...step,
        imageUrl: undefined
      }));

      const newDish: Dish = {
        id: tempId,
        name: dishName,
        ...details,
        instructions: finalSteps,
        imageUrl: coverUrl,
        createdAt: Date.now()
      };
      
      await addDish(newDish);
    } catch (err) {
      console.error(err);
      showToast(`${dishName} 生成失败，请重试。`, 'error');
    } finally {
      setPendingDishes(prev => prev.filter(p => p.id !== tempId));
    }
  };

  const updateDish = async (updatedDish: Dish) => {
    try {
      setSyncStatus('syncing');
      await storageService.saveDish(updatedDish);
      setDishes(prev => prev.map(d => d.id === updatedDish.id ? updatedDish : d));
      setSyncStatus('saved');
      showToast("菜谱已更新", 'success');
    } catch (e) {
      setSyncStatus('error');
      const errorMsg = typeof e === 'string' ? e : "更新失败，存储空间可能已满。";
      showToast(errorMsg, 'error');
    }
  };

  const bulkUpdateDishes = (newDishes: Dish[]) => {
    setDishes(newDishes.sort((a, b) => b.createdAt - a.createdAt));
    setSyncStatus('saved');
  };

  const removeDish = async (id: string) => {
    if (window.confirm("确定要删除这道菜谱吗？")) {
      try {
        setSyncStatus('syncing');
        await storageService.deleteDish(id);
        setDishes(prev => prev.filter(d => d.id !== id));
        setRecentlyViewedIds(prev => prev.filter(rid => rid !== id));
        setSyncStatus('saved');
        showToast("菜谱已删除", 'success');
      } catch (e) {
        setSyncStatus('error');
        showToast("删除失败", 'error');
      }
    }
  };

  const updatePreferences = (newPrefs: UserPreferences) => {
    setPreferences(newPrefs);
    storageService.saveUserPreferences(newPrefs);
  };

  const viewRecipe = (id: string) => {
    const updatedRecentIds = storageService.recordView(id);
    setRecentlyViewedIds(updatedRecentIds);
    setSelectedDishId(id);
    setCurrentView('recipe');
  };

  const renderView = () => {
    if (isInitializing) {
      return (
        <div className="flex flex-col items-center justify-center py-40 animate-in fade-in duration-700">
          <div className="relative w-20 h-20">
            <div className="loader-ring"></div>
            <div className="loader-ring"></div>
            <div className="loader-ring"></div>
            <div className="absolute inset-0 flex items-center justify-center text-2xl">🍲</div>
          </div>
          <div className="mt-12 flex flex-col items-center">
            <p className="text-gray-400 font-black tracking-[0.2em] uppercase text-[10px] animate-pulse">Initializing Kitchen</p>
            <p className="mt-2 text-orange-500 font-bold text-sm">正在加载您的私人菜谱库...</p>
          </div>
        </div>
      );
    }

    switch (currentView) {
      case 'collection':
        const recentlyViewedDishes = recentlyViewedIds
          .map(id => dishes.find(d => d.id === id))
          .filter((d): d is Dish => !!d);

        return (
          <CollectionView 
            dishes={dishes} 
            pendingDishes={pendingDishes}
            recentlyViewedDishes={recentlyViewedDishes}
            onGenerateInBackground={startBackgroundGeneration}
            onDeleteDish={removeDish} 
            onViewRecipe={viewRecipe} 
            onBulkUpdate={bulkUpdateDishes}
            onRefreshImage={regenerateDishImage}
            preferences={preferences}
            onUpdatePreferences={updatePreferences}
            onShowToast={showToast}
          />
        );
      case 'suggest':
        return <SuggestView onAddDish={addDish} preferences={preferences} onShowToast={showToast} />;
      case 'discovery':
        return (
          <DiscoveryView 
            onAddDish={addDish} 
            onViewRecipe={viewRecipe} 
            preferences={preferences} 
            cache={discoveryCache}
            onUpdateCache={setDiscoveryCache}
          />
        );
      case 'recipe':
        const dish = dishes.find(d => d.id === selectedDishId);
        return dish ? (
          <RecipeView 
            dish={dish} 
            onBack={() => setCurrentView('collection')} 
            onUpdateDish={updateDish}
          />
        ) : (
          <CollectionView 
            dishes={dishes} 
            pendingDishes={pendingDishes}
            recentlyViewedDishes={[]}
            onGenerateInBackground={startBackgroundGeneration}
            onDeleteDish={removeDish} 
            onViewRecipe={viewRecipe} 
            onBulkUpdate={bulkUpdateDishes}
            onRefreshImage={regenerateDishImage}
            preferences={preferences}
            onUpdatePreferences={updatePreferences}
            onShowToast={showToast}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex flex-col max-w-4xl mx-auto bg-white shadow-xl relative">
      <header className="bg-orange-500 text-white p-6 sticky top-0 z-10 flex flex-col md:flex-row gap-4 justify-between items-center shadow-md">
        <h1 className="text-2xl font-bold flex items-center gap-2 cursor-pointer" onClick={() => setCurrentView('collection')}>
          <span className="text-3xl">🍴</span>
          WhatToEat｜吃了么
        </h1>
        <div className="flex gap-2 overflow-x-auto max-w-full scrollbar-hide">
          <button 
            onClick={() => setCurrentView('collection')}
            className={`px-4 py-2 rounded-full transition whitespace-nowrap text-sm ${currentView === 'collection' ? 'bg-white text-orange-600 font-bold' : 'hover:bg-orange-600'}`}
          >
            我的菜谱
          </button>
          <button 
            onClick={() => setCurrentView('discovery')}
            className={`px-4 py-2 rounded-full transition whitespace-nowrap text-sm ${currentView === 'discovery' ? 'bg-white text-orange-600 font-bold' : 'hover:bg-orange-600'}`}
          >
            发现灵感
          </button>
          <button 
            onClick={() => setCurrentView('suggest')}
            className={`px-4 py-2 rounded-full transition whitespace-nowrap text-sm ${currentView === 'suggest' ? 'bg-white text-orange-600 font-bold' : 'hover:bg-orange-600'}`}
          >
            今天做什么？
          </button>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-8 pb-24">
        {renderView()}
      </main>

      {/* Global Toast */}
      {toast && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[60] animate-bounce-in">
           <div className={`px-6 py-3 rounded-2xl shadow-xl flex items-center gap-3 border ${toast.type === 'success' ? 'toast-success' : 'bg-red-600 border-red-500 text-white'}`}>
              <span className="text-lg">{toast.type === 'success' ? '✨' : '❌'}</span>
              <span className="font-bold text-sm whitespace-nowrap">{toast.message}</span>
           </div>
        </div>
      )}

      <footer className="p-6 text-center text-gray-500 text-sm border-t border-gray-100 bg-gray-50 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-medium">
          {syncStatus === 'syncing' && (
            <span className="flex items-center gap-1 text-orange-500">
              <span className="w-2 h-2 bg-orange-500 rounded-full animate-ping"></span>
              同步中...
            </span>
          )}
          {syncStatus === 'saved' && (
            <span className="flex items-center gap-1 text-green-600">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>
              已保存到本地
            </span>
          )}
        </div>
        <div>© {new Date().getFullYear()} WhatToEat｜吃了么</div>
      </footer>

      <GlobalChatBot currentDish={currentView === 'recipe' ? dishes.find(d => d.id === selectedDishId) : undefined} preferences={preferences} />
    </div>
  );
};

export default App;
