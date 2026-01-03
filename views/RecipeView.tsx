
import React, { useState, useRef, useEffect } from 'react';
import { Dish, InstructionStep, DishType, Category, Nutrition } from '../types';
import { geminiService } from '../services/geminiService';

interface RecipeViewProps {
  dish: Dish;
  onBack: () => void;
  onUpdateDish: (updatedDish: Dish) => void;
}

const RecipeView: React.FC<RecipeViewProps> = ({ dish, onBack, onUpdateDish }) => {
  const [isModifying, setIsModifying] = useState(false);
  const [instruction, setInstruction] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');
  
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(dish.name);

  const [isEditingType, setIsEditingType] = useState(false);
  const [isEditingCategory, setIsEditingCategory] = useState(false);

  useEffect(() => {
    setTempName(dish.name);
  }, [dish.name]);

  const handleSaveName = () => {
    const trimmed = tempName.trim();
    if (trimmed && trimmed !== dish.name) {
      onUpdateDish({ ...dish, name: trimmed });
    } else {
      setTempName(dish.name);
    }
    setIsEditingName(false);
  };

  const handleModify = async (customInstruction?: string) => {
    const finalInstruction = customInstruction || instruction;
    if (!finalInstruction.trim()) return;

    setLoading(true);
    setLoadingStatus('正在重构菜谱细节与营养分析...');
    try {
      const updatedDetails = await geminiService.modifyRecipe(dish, finalInstruction);
      
      const updatedDish: Dish = {
        ...dish,
        ...updatedDetails,
        instructions: updatedDetails.instructions.map((newStep, idx) => {
          const oldStep = dish.instructions[idx];
          return {
            ...newStep,
            imageUrl: oldStep && oldStep.text === newStep.text ? oldStep.imageUrl : undefined
          };
        })
      };
      onUpdateDish(updatedDish);
      setIsModifying(false);
      setInstruction('');
    } catch (err) {
      alert("调整失败，请重试。");
    } finally {
      setLoading(false);
      setLoadingStatus('');
    }
  };

  const generateStepImage = async (index: number) => {
    const step = dish.instructions[index];
    setLoading(true);
    setLoadingStatus(`正在绘制步骤 ${index + 1} 的配图...`);
    try {
      const imageUrl = await geminiService.generateStepImage(step.text, dish.name);
      const newInstructions = [...dish.instructions];
      newInstructions[index] = { ...step, imageUrl };
      onUpdateDish({ ...dish, instructions: newInstructions });
    } catch (err) {
      alert("生成图片失败，请稍后重试。");
    } finally {
      setLoading(false);
      setLoadingStatus('');
    }
  };

  const instructions = Array.isArray(dish.instructions) ? dish.instructions : [];
  const totalTime = instructions.reduce((acc, step) => {
    if (typeof step === 'string') return acc + 5;
    return acc + (step.timeMinutes || 0);
  }, 0);

  return (
    <div className="max-w-3xl mx-auto animate-in fade-in duration-500 pb-20 relative">
      <div className="flex justify-between items-center mb-6">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-gray-500 hover:text-orange-500 font-medium transition"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
          返回收藏夹
        </button>

        <div className="flex gap-2">
          <button 
            onClick={() => setIsModifying(!isModifying)}
            className={`px-4 py-2 rounded-full font-bold transition flex items-center gap-2 shadow-sm text-sm ${isModifying ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-600 border border-indigo-100 hover:bg-indigo-50'}`}
          >
            <span>✨</span> {isModifying ? '取消调整' : '调整菜谱'}
          </button>
        </div>
      </div>

      {isModifying && (
        <div className="mb-8 bg-indigo-50 rounded-3xl p-6 border border-indigo-100 animate-in slide-in-from-top duration-300">
          <h4 className="text-indigo-900 font-bold mb-3 flex items-center gap-2 text-sm">
            你想如何调整这道菜？
          </h4>
          <div className="flex flex-wrap gap-2 mb-4 text-xs">
            {["精简食材", "低卡健康", "少油少盐", "让口味更辣", "增加蛋白质"].map((suggest) => (
              <button
                key={suggest}
                onClick={() => handleModify(suggest)}
                className="px-3 py-1.5 bg-white border border-indigo-200 text-indigo-600 font-bold rounded-full hover:bg-indigo-600 hover:text-white transition-colors"
              >
                {suggest}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder="输入您的修改想法..."
              className="flex-1 px-4 py-3 rounded-xl border border-indigo-200 outline-none focus:ring-2 focus:ring-indigo-400 text-sm"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              disabled={loading}
            />
            <button 
              onClick={() => handleModify()}
              disabled={loading || !instruction.trim()}
              className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition disabled:opacity-50 min-w-[80px] text-sm"
            >
              {loading ? '...' : '确认'}
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100">
        <div className="aspect-video w-full bg-orange-100 relative flex items-center justify-center overflow-hidden">
           {dish.imageUrl ? (
             <img 
               src={dish.imageUrl} 
               alt={dish.name} 
               className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 hover:scale-110"
             />
           ) : (
             <span className="text-8xl filter drop-shadow-lg select-none">🍲</span>
           )}
           <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
           <div className="absolute bottom-6 left-8 text-white pr-8 right-8">
             <div className="flex flex-wrap gap-2 mb-2">
               {isEditingCategory ? (
                 <select 
                   autoFocus
                   className="px-3 py-1 bg-orange-500 rounded-full text-[10px] font-bold shadow-lg uppercase outline-none cursor-pointer"
                   value={dish.category}
                   onBlur={() => setIsEditingCategory(false)}
                   onChange={(e) => {
                     onUpdateDish({ ...dish, category: e.target.value as Category });
                     setIsEditingCategory(false);
                   }}
                 >
                   {Object.values(Category).map(cat => (
                     <option key={cat} value={cat}>{cat}</option>
                   ))}
                 </select>
               ) : (
                 <span 
                   onClick={() => setIsEditingCategory(true)}
                   className="px-3 py-1 bg-orange-500 rounded-full text-[10px] font-bold shadow-lg uppercase cursor-pointer hover:bg-orange-600 transition-colors"
                 >
                   {dish.category}
                 </span>
               )}

               {isEditingType ? (
                 <select 
                   autoFocus
                   className="px-3 py-1 bg-emerald-600 rounded-full text-[10px] font-bold shadow-lg uppercase outline-none cursor-pointer"
                   value={dish.dishType || ''}
                   onBlur={() => setIsEditingType(false)}
                   onChange={(e) => {
                     onUpdateDish({ ...dish, dishType: e.target.value as DishType });
                     setIsEditingType(false);
                   }}
                 >
                   <option value="" disabled>选择类型</option>
                   {Object.values(DishType).map(type => (
                     <option key={type} value={type}>{type}</option>
                   ))}
                 </select>
               ) : (
                 <span 
                   onClick={() => setIsEditingType(true)}
                   className="px-3 py-1 bg-emerald-600 rounded-full text-[10px] font-bold shadow-lg uppercase flex items-center gap-1 cursor-pointer hover:bg-emerald-700 transition-colors"
                 >
                   {dish.dishType || '未知类型'}
                   <span className="opacity-60">✎</span>
                 </span>
               )}

               <span className="px-3 py-1 bg-gray-800/80 rounded-full text-[10px] font-bold shadow-lg flex items-center gap-1">
                 🕒 约 {totalTime} 分钟
               </span>
             </div>
             
             {isEditingName ? (
               <input 
                 autoFocus
                 type="text"
                 className="bg-white/20 border-b-2 border-white text-4xl font-black outline-none w-full px-2 py-1 rounded transition-all focus:bg-white/30"
                 value={tempName}
                 onChange={(e) => setTempName(e.target.value)}
                 onBlur={handleSaveName}
                 onKeyDown={(e) => {
                   if (e.key === 'Enter') handleSaveName();
                   if (e.key === 'Escape') { setIsEditingName(false); setTempName(dish.name); }
                 }}
               />
             ) : (
               <h2 
                 className="text-4xl font-black drop-shadow-md cursor-pointer hover:underline decoration-white/30 underline-offset-8 flex items-center gap-3 group"
                 onClick={() => setIsEditingName(true)}
               >
                 {dish.name}
                 <span className="text-xl opacity-0 group-hover:opacity-60 transition-opacity">✎</span>
               </h2>
             )}
           </div>
        </div>

        <div className="p-8">
          <div className="mb-10">
            <h3 className="text-xl font-bold text-gray-800 border-l-4 border-orange-500 pl-3 mb-4">菜肴简介</h3>
            <p className="text-gray-600 leading-relaxed text-lg italic">
              “{dish.description || '暂无简介'}”
            </p>
          </div>

          {/* 营养概览区 */}
          {dish.nutrition && (
            <div className="mb-10">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-800 border-l-4 border-emerald-500 pl-3">营养概览</h3>
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider bg-gray-50 px-2 py-1 rounded-md">AI 估算值</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-orange-50/50 p-4 rounded-2xl border border-orange-100 flex flex-col items-center">
                   <span className="text-lg mb-1">🔥</span>
                   <span className="text-lg font-black text-gray-800">{dish.nutrition.calories}</span>
                   <span className="text-[10px] text-gray-400 font-black uppercase">卡路里 (kcal)</span>
                </div>
                <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100 flex flex-col items-center">
                   <span className="text-lg mb-1">🥚</span>
                   <span className="text-lg font-black text-gray-800">{dish.nutrition.protein}g</span>
                   <span className="text-[10px] text-gray-400 font-black uppercase">蛋白质</span>
                </div>
                <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100 flex flex-col items-center">
                   <span className="text-lg mb-1">🥑</span>
                   <span className="text-lg font-black text-gray-800">{dish.nutrition.fat}g</span>
                   <span className="text-[10px] text-gray-400 font-black uppercase">脂肪</span>
                </div>
                <div className="bg-yellow-50/50 p-4 rounded-2xl border border-yellow-100 flex flex-col items-center">
                   <span className="text-lg mb-1">🍞</span>
                   <span className="text-lg font-black text-gray-800">{dish.nutrition.carbs}g</span>
                   <span className="text-[10px] text-gray-400 font-black uppercase">碳水</span>
                </div>
              </div>
            </div>
          )}

          <div className="mb-10">
            <h3 className="text-xl font-bold text-gray-800 border-l-4 border-orange-500 pl-3 mb-4">所需食材</h3>
            <div className="grid grid-cols-2 gap-4">
              {dish.ingredients?.map((ing, i) => (
                <div key={i} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <span className="font-medium text-gray-700 text-sm">{ing.name}</span>
                  <span className="text-orange-600 text-xs font-bold">{ing.amount}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-xl font-bold text-gray-800 border-l-4 border-orange-500 pl-3 mb-8">烹饪步骤</h3>
            <div className="space-y-12">
              {instructions.map((step, i) => (
                <div key={i} className="group">
                  <div className="flex gap-4 mb-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold shadow-md shadow-orange-100">
                      {i + 1}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start gap-4">
                        <p className="text-gray-700 leading-relaxed text-lg flex-1">
                          {typeof step === 'string' ? step : step.text}
                        </p>
                        {typeof step === 'object' && step.timeMinutes > 0 && (
                          <span className="px-2 py-1 bg-orange-50 text-orange-600 text-[10px] font-bold rounded flex items-center gap-1 whitespace-nowrap">
                            ⏱️ {step.timeMinutes}min
                          </span>
                        )}
                      </div>
                      
                      {!step.imageUrl && (
                        <button 
                          onClick={() => generateStepImage(i)}
                          disabled={loading}
                          className="mt-3 text-xs text-orange-400 hover:text-orange-600 flex items-center gap-1 font-bold disabled:opacity-50"
                        >
                          📸 点击生成步骤配图
                        </button>
                      )}
                    </div>
                  </div>
                  {step.imageUrl && (
                    <div className="ml-12 rounded-2xl overflow-hidden border border-gray-100 shadow-sm transition-all hover:shadow-md max-w-lg">
                      <img 
                        src={step.imageUrl} 
                        alt={`步骤 ${i+1}`} 
                        className="w-full h-auto object-cover"
                        loading="lazy"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {loadingStatus && (
        <div className="fixed bottom-24 right-8 z-50 bg-white/90 backdrop-blur-md px-4 py-3 rounded-2xl border border-orange-100 shadow-xl flex items-center gap-3 animate-in slide-in-from-bottom duration-300">
           <div className="animate-spin h-4 w-4 border-2 border-orange-500 border-t-transparent rounded-full"></div>
           <span className="text-orange-600 text-sm font-bold">{loadingStatus}</span>
        </div>
      )}
    </div>
  );
};

export default RecipeView;
