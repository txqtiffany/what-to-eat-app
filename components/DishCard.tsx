
import React, { useState } from 'react';
import { Dish } from '../types';

interface DishCardProps {
  dish: Dish;
  onView: (id: string) => void;
  onDelete: (id: string) => void;
  onRefreshImage?: (id: string) => void;
}

const COMMON_INGREDIENTS = [
  '盐', '油', '醋', '糖', '酱油', '生抽', '老抽', '料酒', '葱', '姜', '蒜', '水', 
  '淀粉', '味精', '鸡精', '胡椒粉', '八角', '桂皮', '花椒', '芝麻油', '蚝油'
];

const DishCard: React.FC<DishCardProps> = ({ dish, onView, onDelete, onRefreshImage }) => {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onRefreshImage || isRefreshing) return;
    setIsRefreshing(true);
    await onRefreshImage(dish.id);
    setIsRefreshing(false);
  };

  const mainIngredientTags = dish.ingredients
    ? dish.ingredients
        .filter(ing => !COMMON_INGREDIENTS.some(common => ing.name.includes(common)))
        .slice(0, 3)
    : [];

  const calculateTotalTime = () => {
    if (!Array.isArray(dish.instructions)) return 0;
    return dish.instructions.reduce((acc, step) => {
      if (typeof step === 'object' && step !== null && 'timeMinutes' in step) {
        return acc + (Number(step.timeMinutes) || 0);
      }
      if (typeof step === 'string') {
        return acc + 3;
      }
      return acc;
    }, 0);
  };

  const totalTime = calculateTotalTime();

  return (
    <div className="bg-white border border-gray-100 rounded-3xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-500 flex flex-col group overflow-hidden relative">
      <div className="absolute top-0 left-0 w-1 group-hover:w-2 h-full bg-orange-500 opacity-70 group-hover:opacity-100 transition-all duration-500 z-10"></div>
      
      {/* 封面展示区 */}
      {dish.imageUrl && (
        <div className="relative h-40 overflow-hidden">
          <img 
            src={dish.imageUrl} 
            alt={dish.name} 
            className="w-full h-full object-cover group-hover:scale-110 transition duration-700"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
          
          {/* 刷新小图标 */}
          <button 
            onClick={handleRefresh}
            className={`absolute top-3 right-3 p-2 rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-white hover:bg-white/40 transition-all z-20 ${isRefreshing ? 'animate-spin' : ''}`}
            title="重新生成封面照"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      )}

      <div className="p-5 pl-7 flex-1 flex flex-col">
        <div className="flex justify-between items-start mb-3">
          <div className="flex flex-wrap gap-1.5">
            <span className="px-2.5 py-1 bg-orange-50 text-orange-600 text-[10px] font-black rounded-lg uppercase tracking-wider border border-orange-100">
              {dish.category}
            </span>
            {dish.dishType && (
              <span className="px-2.5 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-black rounded-lg uppercase tracking-wider border border-emerald-100">
                {dish.dishType}
              </span>
            )}
          </div>
          <button 
            onClick={(e) => { e.stopPropagation(); onDelete(dish.id); }}
            className="text-gray-300 hover:text-red-500 transition-colors p-1"
            title="删除菜谱"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        <div className="flex justify-between items-end mb-2">
          <h3 className="text-xl font-black text-gray-800 truncate pr-2 group-hover:text-orange-600 transition-colors">{dish.name}</h3>
          {totalTime > 0 && (
            <span className="flex-shrink-0 text-[11px] font-bold text-gray-400 bg-gray-50 px-2 py-1 rounded-lg border border-gray-100 flex items-center gap-1">
              <span className="text-orange-400 opacity-70">⏱</span> {totalTime}min
            </span>
          )}
        </div>
        
        <div className="flex flex-wrap gap-1.5 mb-4">
          {mainIngredientTags.map((ing, idx) => (
            <span key={idx} className="text-[10px] px-2 py-1 bg-blue-50/50 text-blue-500 rounded-md border border-blue-100 font-medium">
              {ing.name}
            </span>
          ))}
          {mainIngredientTags.length === 0 && (
             <span className="text-[10px] px-2 py-1 bg-gray-50 text-gray-400 rounded-md italic">经典风味</span>
          )}
        </div>

        <p className="text-gray-500 text-sm line-clamp-2 mb-5 leading-relaxed h-10 overflow-hidden">
          {dish.description}
        </p>

        <button 
          onClick={() => onView(dish.id)}
          className="mt-auto w-full py-3 bg-gray-50 text-orange-600 font-black rounded-2xl border border-orange-100 hover:bg-orange-500 hover:text-white hover:shadow-lg hover:shadow-orange-200 transition-all duration-300 transform active:scale-[0.98]"
        >
          查看制作秘籍
        </button>
      </div>
    </div>
  );
};

export default DishCard;
