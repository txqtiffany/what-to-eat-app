
import React, { useState, useRef, useEffect } from 'react';
import { geminiService } from '../services/geminiService';
import { Dish, UserPreferences } from '../types';

interface GlobalChatBotProps {
  currentDish?: Dish;
  preferences: UserPreferences;
}

const GlobalChatBot: React.FC<GlobalChatBotProps> = ({ currentDish, preferences }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [history, setHistory] = useState<{ role: 'user' | 'ai', content: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [history, isOpen]);

  // Handle auto-clearing unread when opening
  useEffect(() => {
    if (isOpen && hasUnread) {
      setHasUnread(false);
    }
  }, [isOpen, hasUnread]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || loading) return;

    const userMessage = message.trim();
    setHistory(prev => [...prev, { role: 'user', content: userMessage }]);
    setMessage('');
    setLoading(true);

    try {
      const response = await geminiService.proChat(userMessage, history, currentDish, preferences);
      setHistory(prev => [...prev, { role: 'ai', content: response }]);
      
      // If window is closed when response arrives, show red dot
      if (!isOpen) {
        setHasUnread(true);
      }
    } catch (err) {
      setHistory(prev => [...prev, { role: 'ai', content: '哎呀，后厨有点忙乱，请稍等一下再问我吧。' }]);
      if (!isOpen) setHasUnread(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`fixed bottom-8 right-8 z-[100] flex flex-col items-end transition-all ${isOpen ? 'w-[90vw] md:w-80 h-[70vh] md:h-[500px]' : 'w-14 h-14'}`}>
      {isOpen && (
        <div className="bg-white/95 backdrop-blur-md w-full flex-1 mb-4 rounded-3xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden animate-in zoom-in duration-200 origin-bottom-right">
          <div className="bg-orange-500 p-4 text-white font-bold flex justify-between items-center shadow-lg">
            <div className="flex items-center gap-2">
              <span className="text-xl">👨‍🍳</span>
              <div className="flex flex-col">
                <span className="text-sm leading-tight">Pro 厨师助手</span>
                {currentDish && <span className="text-[10px] font-medium opacity-80">对话中：{currentDish.name}</span>}
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="hover:rotate-90 transition p-1">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide bg-gray-50/50">
            {history.length === 0 && (
              <div className="bg-white p-3 rounded-2xl rounded-tl-none text-xs text-gray-700 shadow-sm border border-gray-100 leading-relaxed">
                你好！我是你的智能 Pro 厨师助手。
                您可以问我：
                <ul className="mt-2 space-y-1 list-disc list-inside text-orange-600 font-medium">
                  <li>“这道菜里的洋葱可以换成什么？”</li>
                  <li>“如何把牛排煎得更嫩？”</li>
                  <li>“给我推荐一个适合健身的午餐。”</li>
                </ul>
              </div>
            )}
            
            {history.map((chat, i) => (
              <div key={i} className={`flex ${chat.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-3 rounded-2xl text-xs leading-relaxed shadow-sm ${
                  chat.role === 'user' 
                    ? 'bg-orange-500 text-white rounded-tr-none' 
                    : 'bg-white text-gray-700 rounded-tl-none border border-gray-100'
                }`}>
                  {chat.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-white p-3 rounded-2xl rounded-tl-none shadow-sm border border-gray-100 flex gap-1 items-center">
                  <span className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce"></span>
                  <span className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce delay-100"></span>
                  <span className="w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce delay-200"></span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <form onSubmit={handleSubmit} className="p-3 bg-white border-t border-gray-100 flex gap-2">
            <input
              autoFocus
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="向大厨提问..."
              className="flex-1 bg-gray-50 px-4 py-3 rounded-xl outline-none text-xs focus:ring-1 focus:ring-orange-400 transition-all"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !message.trim()}
              className="bg-orange-500 text-white p-3 rounded-xl disabled:opacity-50 hover:bg-orange-600 shadow-md transition-all active:scale-95"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          </form>
        </div>
      )}

      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-14 h-14 rounded-full shadow-2xl flex items-center justify-center text-2xl transition-all transform hover:scale-110 active:scale-95 border-2 ${
          isOpen ? 'bg-gray-800 text-white border-gray-700' : 'bg-orange-500 text-white border-white'
        }`}
      >
        {isOpen ? (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <span className="relative">
            💬
            {hasUnread && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>
            )}
          </span>
        )}
      </button>
    </div>
  );
};

export default GlobalChatBot;
