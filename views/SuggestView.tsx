
import React, { useState, useEffect } from 'react';
import { geminiService } from '../services/geminiService';
import { Dish, SuggestedDish, UserPreferences } from '../types';

interface SuggestViewProps {
  onAddDish: (dish: Dish) => void;
  preferences: UserPreferences;
  onShowToast: (msg: string, type?: 'success' | 'error') => void;
}

const STORAGE_KEY = 'delicious-secrets-last-ingredients';
const STAPLES_KEY = 'delicious-secrets-staples';
const CUSTOM_STAPLES_KEY = 'delicious-secrets-custom-staples';

const DEFAULT_STAPLES = [
  '盐', '糖', '胡椒粉', '生抽', '老抽', '醋', '料酒', '蚝油', 
  '油', '淀粉', '葱', '姜', '蒜', '花椒', '八角', '辣椒粉'
];

const SuggestView: React.FC<SuggestViewProps> = ({ onAddDish, preferences, onShowToast }) => {
  const [inputValue, setInputValue] = useState('');
  const [newStapleInput, setNewStapleInput] = useState('');
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [staples, setStaples] = useState<string[]>([]);
  const [customStaples, setCustomStaples] = useState<string[]>([]);
  const [showPantry, setShowPantry] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestedDish[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingDish, setSavingDish] = useState<string | null>(null);

  useEffect(() => {
    const savedIngs = localStorage.getItem(STORAGE_KEY);
    if (savedIngs) { try { const parsed = JSON.parse(savedIngs); if (Array.isArray(parsed)) setIngredients(parsed); } catch (e) {} }
    const savedCustom = localStorage.getItem(CUSTOM_STAPLES_KEY);
    if (savedCustom) { try { const parsed = JSON.parse(savedCustom); if (Array.isArray(parsed)) setCustomStaples(parsed); } catch (e) {} }
    const savedStaples = localStorage.getItem(STAPLES_KEY);
    if (savedStaples) { try { const parsed = JSON.parse(savedStaples); if (Array.isArray(parsed)) setStaples(parsed); } catch (e) {} } else { setStaples(DEFAULT_STAPLES); }
  }, []);

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(ingredients)); }, [ingredients]);
  useEffect(() => { localStorage.setItem(STAPLES_KEY, JSON.stringify(staples)); }, [staples]);
  useEffect(() => { localStorage.setItem(CUSTOM_STAPLES_KEY, JSON.stringify(customStaples)); }, [customStaples]);

  const toggleStaple = (item: string) => { setStaples(prev => prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]); };
  const handleAddCustomStaple = (e: React.FormEvent) => { e.preventDefault(); const val = newStapleInput.trim(); if (val && !DEFAULT_STAPLES.includes(val) && !customStaples.includes(val)) { setCustomStaples([...customStaples, val]); setStaples([...staples, val]); setNewStapleInput(''); } };
  const removeCustomStaple = (val: string) => { setCustomStaples(prev => prev.filter(i => i !== val)); setStaples(prev => prev.filter(i => i !== val)); };
  const handleAddIngredient = (e: React.FormEvent) => { e.preventDefault(); if (inputValue.trim() && !ingredients.includes(inputValue.trim())) { setIngredients([...ingredients, inputValue.trim()]); setInputValue(''); } };

  const fetchSuggestions = async () => {
    if (ingredients.length === 0) return;
    setLoading(true);
    try {
      const res = await geminiService.suggestDishes(ingredients, staples, preferences);
      setSuggestions(res);
    } catch (err) {
      onShowToast("推荐失败，请重试。", 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveToCollection = async (suggested: SuggestedDish) => {
    setSavingDish(suggested.name);
    try {
      const details = await geminiService.getRecipeDetails(suggested.name, preferences);
      let imageUrl = '';
      try { imageUrl = await geminiService.generateDishImage(suggested.name); } catch (e) {}
      const newDish: Dish = { id: Date.now().toString(), name: suggested.name, ...details, instructions: details.instructions.map(s => ({ ...s, imageUrl: undefined })), imageUrl, createdAt: Date.now() };
      onAddDish(newDish);
    } catch (err) {
      onShowToast("保存失败", 'error');
    } finally {
      setSavingDish(null);
    }
  };

  return (
    <div className="max-w-3xl mx-auto animate-in slide-in-from-bottom duration-500 pb-12">
      <div className="bg-gradient-to-br from-orange-400 to-red-500 rounded-[2rem] sm:rounded-[2.5rem] p-6 sm:p-8 text-white mb-6 shadow-2xl relative overflow-hidden">
        <h2 className="text-2xl sm:text-3xl font-black mb-3 sm:mb-4">今天做什么？</h2>
        <p className="opacity-90 mb-6 sm:mb-8 text-sm md:text-base">告诉我你手头的关键食材，AI 将为您量身定制大餐。</p>
        <form onSubmit={handleAddIngredient} className="relative mb-6 sm:mb-8">
          <input 
            type="text" 
            placeholder="输入主要食材（如：鸡蛋、牛肉）" 
            className="w-full px-4 sm:px-6 py-4 sm:py-5 rounded-2xl text-gray-800 outline-none pr-24 text-base sm:text-lg shadow-inner" 
            value={inputValue} 
            onChange={(e) => setInputValue(e.target.value)} 
          />
          <button type="submit" className="absolute right-2 top-2 bottom-2 px-4 sm:px-6 bg-orange-600 hover:bg-orange-700 rounded-xl font-bold transition-all shadow-md active:scale-95 text-sm sm:text-base">添加</button>
        </form>
        <div className="flex flex-wrap gap-2 items-center min-h-[40px]">
          {ingredients.map(ing => (
            <span key={ing} className="bg-white/20 backdrop-blur-md px-3 sm:px-4 py-2 rounded-full flex items-center gap-2 border border-white/30 text-xs font-bold transition-all hover:bg-white/40 group">
              {ing}
              <button onClick={() => setIngredients(ingredients.filter(i => i !== ing))} className="hover:text-red-200 opacity-50 group-hover:opacity-100">✕</button>
            </span>
          ))}
        </div>
      </div>

      <div className="mb-8 sm:mb-10 bg-white border border-gray-100 rounded-3xl p-5 sm:p-6 shadow-sm">
        <button onClick={() => setShowPantry(!showPantry)} className="w-full flex justify-between items-center text-gray-700 hover:text-orange-500 transition-colors">
          <div className="flex items-center gap-3">🧂<span className="font-black text-sm uppercase tracking-widest">我的厨房常备库</span></div>
          <svg className={`w-5 h-5 transition-transform ${showPantry ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
        </button>
        {showPantry && (
          <div className="mt-6 animate-in slide-in-from-top duration-300">
            <div className="flex flex-wrap gap-2 mb-6">
              {DEFAULT_STAPLES.concat(customStaples).map(item => (
                <button key={item} onClick={() => toggleStaple(item)} className={`px-3 py-2 rounded-xl text-[11px] font-bold transition-all border ${staples.includes(item) ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-gray-50 border-gray-100 text-gray-400'}`}>{item}</button>
              ))}
            </div>
            <form onSubmit={handleAddCustomStaple} className="flex gap-2 max-w-sm">
              <input type="text" placeholder="添加自定义食材..." className="flex-1 bg-gray-50 border border-gray-100 px-4 py-2 rounded-xl text-[11px] outline-none w-full" value={newStapleInput} onChange={(e) => setNewStapleInput(e.target.value)} />
              <button type="submit" disabled={!newStapleInput.trim()} className="bg-indigo-500 text-white px-4 py-2 rounded-xl text-[11px] font-bold whitespace-nowrap">添加</button>
            </form>
          </div>
        )}
      </div>

      <div className="text-center mb-10 sm:mb-12">
        <button onClick={fetchSuggestions} disabled={ingredients.length === 0 || loading} className="w-full sm:w-auto bg-orange-600 hover:bg-orange-700 text-white text-lg sm:text-xl font-black px-8 sm:px-12 py-4 sm:py-5 rounded-2xl shadow-xl transition transform hover:scale-105 active:scale-95 disabled:opacity-50">
          {loading ? '构思中...' : '💡 看看能做什么？'}
        </button>
      </div>

      {suggestions.length > 0 && (
        <div className="space-y-6 animate-in fade-in duration-500">
          <div className="flex items-center gap-3 mb-6"><h3 className="text-xl font-black text-gray-800">推荐方案</h3><div className="h-px flex-1 bg-gray-100"></div></div>
          {suggestions.map((s, idx) => (
            <div key={idx} className="bg-white border border-gray-100 rounded-[2rem] p-6 sm:p-8 shadow-sm hover:shadow-xl transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-6 group">
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-3"><h4 className="text-2xl font-black text-gray-800 group-hover:text-orange-600">{s.name}</h4><span className="px-3 py-1 bg-orange-50 text-orange-600 text-[10px] rounded-lg font-black">{s.category}</span></div>
                <p className="text-gray-500 italic text-sm mb-4">"{s.reason}"</p>
              </div>
              <button onClick={() => handleSaveToCollection(s)} disabled={savingDish === s.name} className="w-full md:w-auto whitespace-nowrap bg-gray-50 text-orange-600 font-black px-6 sm:px-8 py-3 sm:py-4 rounded-2xl hover:bg-orange-500 hover:text-white transition-all shadow-sm">
                {savingDish === s.name ? '正在收藏...' : '⭐ 立即收藏'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SuggestView;
