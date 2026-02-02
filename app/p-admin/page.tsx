"use client"

import { useState } from 'react';
import { AppHeader } from '@/components/c-app-header';

// Placeholder for the AutoMarketer component
const AutoMarketer = () => (
  <div className="bg-white p-6 rounded-lg shadow-md">
    <h2 className="text-2xl font-bold mb-4 text-gray-800">🚀 AUTO마케터</h2>
    <p className="text-gray-600">데이터 기반 콘텐츠 자동 생성 및 마케팅 자동화가 이곳에서 실행됩니다.</p>
    {/* TODO: Add marketer features here */}
  </div>
);

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState('marketer');

  return (
    <div className="min-h-screen bg-gray-100">
      <AppHeader />
      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-900">어드민 대시보드</h1>
        </div>

        <div className="flex border-b border-gray-200 mb-6">
          <button 
            onClick={() => setActiveTab('marketer')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'marketer' 
                ? 'border-b-2 border-indigo-600 text-indigo-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            AUTO마케터
          </button>
          {/* TODO: Add other admin tabs here */}
        </div>

        <div>
          {activeTab === 'marketer' && <AutoMarketer />}
        </div>
      </main>
    </div>
  );
}
