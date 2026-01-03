
import React, { useState, useEffect } from 'react';
import { geminiService } from '../services/geminiService';
import { Dish, SuggestedDish, InstructionStep, UserPreferences } from '../types';

interface DiscoveryViewProps {
  onAddDish: (dish: Dish) => void;
  onViewRecipe: (id: string) => void;
  preferences: UserPreferences;
  cache: SuggestedDish[];
  onUpdateCache: (cache: SuggestedDish[]) => void;
}

const DiscoveryView: React.FC<DiscoveryViewProps> = ({ onAddDish, onViewRecipe, preferences, cache, onUpdateCache }) => {
  const [loading, setLoading] = useState(false);
  const [savingDish, setSavingDish] = useState<string | null>(null);

  const fetchDiscovery = async (force: boolean = false) => {
    // 如果缓存已有且非强制刷新，则不请求
    if (cache.length > 0 && !force) return;

    setLoading(true);
    try {
      const res = await geminiService.getDiscoveryRecommendations(preferences);
      onUpdateCache(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiscovery();
  }, []);

  const handleSaveToCollection = async (suggested: SuggestedDish) => {
    setSavingDish(suggested.name);
    try {
      const details = await geminiService.getRecipeDetails(suggested.name, preferences);
      let imageUrl = '';
      try { imageUrl = await geminiService.generateDishImage(suggested.name); } catch (imgErr) {}
      const newDish: Dish = { id: Date.now().toString(), name: suggested.name, ...details, instructions: details.instructions.map(step => ({ ...step, imageUrl: undefined })), imageUrl, createdAt: Date.now() };
      onAddDish(newDish);
    } catch (err) {} finally { setSavingDish(null); }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-end border-b border-orange-100 pb-4">
        <div>
          <h2 className="text-3xl font-black text-gray-800">发现灵感</h2>
          <p className="text-gray-500 mt-2 italic">看看今天 AI 为您推荐了哪些美味？</p>
        </div>
        <button onClick={() => fetchDiscovery(true)} disabled={loading} className="flex items-center gap-2 text-orange-600 hover:text-orange-700 font-bold transition-all disabled:opacity-50">
          <svg className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          换一批
        </button>
      </div>

      {loading && cache.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="bg-white rounded-[2rem] h-[340px] border border-gray-100 p-8 flex flex-col">
               <div className="flex gap-2 mb-6">
                 <div className="w-16 h-6 skeleton rounded-lg"></div>
                 <div className="w-16 h-6 skeleton rounded-lg"></div>
               </div>
               <div className="w-3/4 h-10 skeleton rounded-xl mb-6"></div>
               <div className="space-y-3 mb-10">
                 <div className="w-full h-4 skeleton rounded-lg"></div>
                 <div className="w-full h-4 skeleton rounded-lg"></div>
                 <div className="w-2/3 h-4 skeleton rounded-lg"></div>
               </div>
               <div className="mt-auto w-full h-14 skeleton rounded-2xl"></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cache.map((item, idx) => (
            <div key={idx} className="bg-white border border-gray-100 rounded-[2rem] shadow-sm hover:shadow-xl transition-all p-8 flex flex-col justify-between group h-full">
              <div>
                <div className="flex gap-2 mb-4">
                  <span className="px-2 py-1 bg-orange-100 text-orange-700 text-[10px] font-black rounded uppercase tracking-tighter">{item.category}</span>
                  <span className="px-2 py-1 bg-green-100 text-green-700 text-[10px] font-black rounded uppercase tracking-tighter">{item.dishType}</span>
                </div>
                <h3 className="text-2xl font-black text-gray-800 mb-3 group-hover:text-orange-600 transition-colors">{item.name}</h3>
                <p className="text-gray-500 text-sm leading-relaxed mb-8 italic line-clamp-3">"{item.reason}"</p>
              </div>
              <button onClick={() => handleSaveToCollection(item)} disabled={savingDish === item.name} className="w-full py-4 bg-orange-500 text-white font-black rounded-2xl hover:bg-orange-600 transition shadow-lg shadow-orange-100 flex items-center justify-center gap-2 disabled:opacity-50">
                {savingDish === item.name ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>正在构思...</> : <>✨ 立即收藏</>}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DiscoveryView;
