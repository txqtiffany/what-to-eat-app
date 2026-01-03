
import React, { useState, useRef } from 'react';
import { Category, Dish, DishType, UserPreferences } from '../types';
import DishCard from '../components/DishCard';
import { storageService } from '../services/storageService';

interface CollectionViewProps {
  dishes: Dish[];
  pendingDishes: {id: string, name: string, status: string}[];
  recentlyViewedDishes: Dish[];
  onGenerateInBackground: (name: string) => void;
  onDeleteDish: (id: string) => void;
  onViewRecipe: (id: string) => void;
  onBulkUpdate: (dishes: Dish[]) => void;
  onRefreshImage?: (id: string) => void;
  preferences: UserPreferences;
  onUpdatePreferences: (prefs: UserPreferences) => void;
  onShowToast: (msg: string, type?: 'success' | 'error') => void;
}

const FLAVORS = ['辣', '甜', '咸', '淡', '酸', '苦', '麻', '鲜', '脆', '香'];

const CollectionView: React.FC<CollectionViewProps> = ({ 
  dishes, 
  pendingDishes,
  recentlyViewedDishes,
  onGenerateInBackground, 
  onDeleteDish, 
  onViewRecipe, 
  onBulkUpdate,
  onRefreshImage,
  preferences,
  onUpdatePreferences,
  onShowToast
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchByIngredients, setSearchByIngredients] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('全部');
  const [selectedDishType, setSelectedDishType] = useState<string>('全部');
  const [newDishName, setNewDishName] = useState('');
  const [customPrefInput, setCustomPrefInput] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [isRecentOpen, setIsRecentOpen] = useState(false);
  const [isPrefsOpen, setIsPrefsOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const categories = ['全部', ...Object.values(Category)];
  const dishTypes = ['全部', ...Object.values(DishType)];

  const filteredDishes = dishes.filter(dish => {
    const searchLower = searchTerm.toLowerCase();
    const matchesName = dish.name.toLowerCase().includes(searchLower);
    const matchesIngredients = searchByIngredients && dish.ingredients?.some(ing => 
      ing.name.toLowerCase().includes(searchLower)
    );
    
    const matchesSearch = matchesName || matchesIngredients;
    const matchesCategory = selectedCategory === '全部' || dish.category === selectedCategory;
    const matchesType = selectedDishType === '全部' || dish.dishType === selectedDishType;
    return matchesSearch && matchesCategory && matchesType;
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newDishName.trim();
    if (!name) return;

    onGenerateInBackground(name);
    setNewDishName('');
    setIsAdding(false);
  };

  const toggleFlavor = (flavor: string) => {
    const newFlavors = preferences.flavors.includes(flavor)
      ? preferences.flavors.filter(f => f !== flavor)
      : [...preferences.flavors, flavor];
    onUpdatePreferences({ ...preferences, flavors: newFlavors });
  };

  const handleAddCustomPref = (e: React.FormEvent) => {
    e.preventDefault();
    const val = customPrefInput.trim();
    if (val && !preferences.flavors.includes(val)) {
      onUpdatePreferences({ ...preferences, flavors: [...preferences.flavors, val] });
      setCustomPrefInput('');
    }
  };

  const handleExport = async () => {
    try {
      const data = await storageService.exportData();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `WhatToEat备份_${new Date().toLocaleDateString()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onShowToast("菜谱备份已导出", 'success');
    } catch (e) {
      onShowToast("导出失败", 'error');
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = event.target?.result as string;
        const updatedDishes = await storageService.importData(json);
        onBulkUpdate(updatedDishes);
        onShowToast("导入成功！已同步您的菜谱库。", 'success');
      } catch (err) {
        onShowToast(err instanceof Error ? err.message : "导入失败", 'error');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 relative">
      
      {/* 悬浮最近查看入口 */}
      {recentlyViewedDishes.length > 0 && (
        <div className="fixed left-6 bottom-8 z-40 flex flex-col items-start">
          {isRecentOpen && (
            <div className="mb-4 bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl border border-gray-100 p-4 w-64 animate-in slide-in-from-bottom duration-300">
               <div className="flex justify-between items-center mb-4 px-2">
                 <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                    最近查看
                 </h3>
                 <button onClick={() => setIsRecentOpen(false)} className="text-gray-400 hover:text-orange-500">
                   <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
                 </button>
               </div>
               <div className="space-y-2 max-h-80 overflow-y-auto scrollbar-hide">
                 {recentlyViewedDishes.map(dish => (
                   <div key={dish.id} onClick={() => { onViewRecipe(dish.id); setIsRecentOpen(false); }} className="flex items-center gap-3 p-2 hover:bg-orange-50 rounded-xl transition cursor-pointer group">
                     <div className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                        {dish.imageUrl ? <img src={dish.imageUrl} className="w-full h-full object-cover group-hover:scale-110 transition duration-300" alt="" /> : <div className="w-full h-full flex items-center justify-center text-lg bg-orange-50">🍲</div>}
                     </div>
                     <div className="flex-1 min-w-0">
                       <p className="text-xs font-bold text-gray-800 truncate">{dish.name}</p>
                       <p className="text-[10px] text-gray-400">{dish.category}</p>
                     </div>
                   </div>
                 ))}
               </div>
            </div>
          )}
          <button onClick={() => setIsRecentOpen(!isRecentOpen)} className={`w-14 h-14 rounded-full shadow-2xl flex items-center justify-center text-2xl transition-all transform hover:scale-110 active:scale-95 border-4 ${isRecentOpen ? 'bg-orange-500 text-white border-orange-100' : 'bg-white text-orange-500 border-orange-50'}`}>
            {isRecentOpen ? <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg> : <span className="relative">🕒</span>}
          </button>
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800 border-l-4 border-orange-500 pl-3">我的菜谱库</h2>
        <div className="flex gap-2">
          <button onClick={() => setIsPrefsOpen(!isPrefsOpen)} className={`w-10 h-10 rounded-full font-bold transition flex items-center justify-center border shadow-sm ${isPrefsOpen ? 'bg-indigo-500 text-white border-indigo-200 shadow-lg' : 'bg-white text-indigo-600 border-indigo-100 hover:bg-indigo-50'}`} title="偏好设置"><span>⚙️</span></button>
          <div className="flex bg-gray-100 p-1 rounded-full border border-gray-200 shadow-sm">
             <button onClick={handleExport} title="导出备份" className="p-2 hover:bg-white rounded-full transition text-gray-600 hover:text-orange-500"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg></button>
             <button onClick={() => fileInputRef.current?.click()} title="导入备份" className="p-2 hover:bg-white rounded-full transition text-gray-600 hover:text-orange-500"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg></button>
             <input type="file" ref={fileInputRef} onChange={handleImport} accept=".json" className="hidden" />
          </div>
          <button onClick={() => setIsAdding(true)} className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-full font-bold transition flex items-center gap-2 shadow-lg shadow-orange-100"><span>➕</span> 添加新菜肴</button>
        </div>
      </div>

      {isPrefsOpen && (
        <div className="bg-indigo-50 rounded-3xl p-6 border border-indigo-100 animate-in slide-in-from-top duration-300 space-y-4">
           <div>
              <h3 className="text-sm font-black text-indigo-900 mb-3 flex items-center gap-2">常用口味</h3>
              <div className="flex flex-wrap gap-2">
                {FLAVORS.map(flavor => (
                  <button key={flavor} onClick={() => toggleFlavor(flavor)} className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${preferences.flavors.includes(flavor) ? 'bg-indigo-600 text-white border-indigo-400' : 'bg-white text-indigo-400 border-indigo-100'}`}>
                    {flavor}
                  </button>
                ))}
              </div>
           </div>

           <div>
              <h3 className="text-sm font-black text-indigo-900 mb-3 flex items-center gap-2">自定义偏好 / 忌口</h3>
              <div className="flex flex-wrap gap-2 mb-3">
                {preferences.flavors.filter(f => !FLAVORS.includes(f)).map(custom => (
                  <span key={custom} className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white text-indigo-600 border border-indigo-200 flex items-center gap-2 shadow-sm">
                    {custom}
                    <button onClick={() => toggleFlavor(custom)} className="hover:text-red-500 transition-colors">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                  </span>
                ))}
              </div>
              <form onSubmit={handleAddCustomPref} className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="例如：忌口洋葱、少油、低脂..." 
                  className="flex-1 px-4 py-2 rounded-xl border border-indigo-100 outline-none focus:ring-2 focus:ring-indigo-400 text-sm bg-white/50"
                  value={customPrefInput}
                  onChange={(e) => setCustomPrefInput(e.target.value)}
                />
                <button type="submit" disabled={!customPrefInput.trim()} className="px-4 py-2 bg-indigo-500 text-white text-sm font-bold rounded-xl hover:bg-indigo-600 disabled:opacity-50 transition-colors">
                  添加
                </button>
              </form>
           </div>
        </div>
      )}

      <div className="space-y-4">
        {/* 搜索栏 */}
        <div className="relative">
          <input type="text" placeholder={searchByIngredients ? "输入食材名进行搜索..." : "输入菜名进行搜索..."} className="w-full pl-10 pr-4 py-3 rounded-2xl border border-gray-200 focus:ring-2 focus:ring-orange-400 outline-none transition shadow-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          <svg className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        </div>

        {/* 筛选标签栏 */}
        <div className="space-y-3">
          <div className="flex overflow-x-auto scrollbar-hide gap-2 pb-1">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${selectedCategory === cat ? 'bg-orange-500 text-white border-orange-400' : 'bg-white text-gray-500 border-gray-100 hover:border-orange-200'}`}
              >
                {cat}
              </button>
            ))}
          </div>
          <div className="flex overflow-x-auto scrollbar-hide gap-2 pb-1">
            {dishTypes.map(type => (
              <button
                key={type}
                onClick={() => setSelectedDishType(type)}
                className={`flex-shrink-0 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all border ${selectedDishType === type ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-white text-gray-400 border-gray-100 hover:border-emerald-200'}`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4 px-1">
          <label className="flex items-center gap-2 cursor-pointer group">
            <input type="checkbox" className="hidden peer" checked={searchByIngredients} onChange={() => setSearchByIngredients(!searchByIngredients)} />
            <div className="w-4 h-4 rounded border-2 border-gray-300 peer-checked:bg-orange-500 peer-checked:border-orange-500 transition-all flex items-center justify-center"><svg className="w-3 h-3 text-white opacity-0 peer-checked:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg></div>
            <span className="text-xs font-bold text-gray-500 group-hover:text-orange-500 transition-colors">🥕 同时搜索食材</span>
          </label>
        </div>
      </div>

      {isAdding && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl animate-in zoom-in duration-300">
            <h3 className="text-2xl font-bold mb-6 text-gray-800">告诉我你想吃的菜</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <input autoFocus type="text" placeholder="例如：红烧肉、麻辣香锅..." className="w-full px-4 py-4 rounded-xl border border-gray-200 text-lg outline-none focus:ring-2 focus:ring-orange-400" value={newDishName} onChange={(e) => setNewDishName(e.target.value)} />
              <p className="text-sm text-gray-500">点击添加后，AI 将在后台为您制定配方。</p>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setIsAdding(false)} className="flex-1 py-3 text-gray-600 font-bold hover:bg-gray-100 rounded-xl transition">取消</button>
                <button type="submit" disabled={!newDishName.trim()} className="flex-1 py-3 bg-orange-500 text-white font-bold rounded-xl hover:bg-orange-600 transition shadow-lg disabled:opacity-50">立即添加</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {pendingDishes.map(pending => (
          <div key={pending.id} className="bg-white border-2 border-dashed border-orange-100 rounded-3xl p-6 flex flex-col justify-between h-[210px] animate-pulse-soft">
             <div>
               <div className="flex justify-between items-start mb-4">
                 <div className="w-16 h-6 skeleton rounded-lg"></div>
                 <div className="w-5 h-5 rounded-full border-2 border-orange-400 border-t-transparent animate-spin"></div>
               </div>
               <h3 className="text-xl font-black text-gray-300 mb-2 truncate">{pending.name}</h3>
               <p className="text-orange-400 text-xs font-bold italic">{pending.status}</p>
             </div>
             <div className="w-full h-11 skeleton rounded-2xl opacity-40"></div>
          </div>
        ))}

        {filteredDishes.length > 0 ? (
          filteredDishes.map(dish => <DishCard key={dish.id} dish={dish} onView={onViewRecipe} onDelete={onDeleteDish} onRefreshImage={onRefreshImage} />)
        ) : pendingDishes.length === 0 ? (
          <div className="col-span-full text-center py-20 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
            <p className="text-gray-400 text-lg">暂无匹配的菜谱</p>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default CollectionView;
