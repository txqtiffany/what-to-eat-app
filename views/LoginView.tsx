import React, { useState } from 'react';
import { authService } from '../services/authService';

interface LoginViewProps {
  onShowToast: (message: string, type?: 'success' | 'error') => void;
}

const LoginView: React.FC<LoginViewProps> = ({ onShowToast }) => {
  const [isSigningIn, setIsSigningIn] = useState(false);

  const handleSignIn = async () => {
    if (isSigningIn) return;
    setIsSigningIn(true);
    try {
      await authService.signInWithGoogle();
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code;
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        // user dismissed; stay quiet
      } else {
        console.error(e);
        onShowToast('登录失败，请稍后再试。', 'error');
      }
      setIsSigningIn(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12 animate-in fade-in duration-700">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl border border-orange-100 p-8 sm:p-10 text-center">
        <div className="text-5xl mb-4">🍴</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-1">WhatToEat</h1>
        <p className="text-orange-500 font-bold text-sm tracking-wider mb-6">吃了么</p>
        <p className="text-gray-500 text-sm leading-relaxed mb-8">
          登录以同步你的菜谱到云端，<br />
          并和家人朋友一起分享美食灵感。
        </p>
        <button
          onClick={handleSignIn}
          disabled={isSigningIn}
          className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-white border-2 border-gray-200 rounded-2xl font-bold text-gray-700 hover:border-orange-300 hover:bg-orange-50 transition disabled:opacity-60"
        >
          {isSigningIn ? (
            <>
              <span className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></span>
              <span>正在登录...</span>
            </>
          ) : (
            <>
              <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#EA4335" d="M12 11v3.2h5.5c-.2 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.5 14.6 2.5 12 2.5 6.8 2.5 2.5 6.8 2.5 12s4.3 9.5 9.5 9.5c5.5 0 9.1-3.9 9.1-9.3 0-.6-.1-1.1-.2-1.7H12z" />
              </svg>
              <span>使用 Google 账号登录</span>
            </>
          )}
        </button>
        <p className="mt-8 text-[11px] text-gray-400 leading-relaxed">
          首次登录会自动创建一个名为「我的菜谱」的私人文件夹，<br />
          你设备上已有的菜谱会同步上传。
        </p>
      </div>
      <p className="mt-6 text-xs text-gray-400">© {new Date().getFullYear()} WhatToEat｜吃了么</p>
    </div>
  );
};

export default LoginView;
