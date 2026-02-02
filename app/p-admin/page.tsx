"use client"

import { useState } from 'react';
import { AppHeader } from '@/components/c-app-header';

const AutoMarketer = () => {
  const [contentType, setContentType] = useState('press-release');
  const [dataSource, setDataSource] = useState('category-gap');
  const [generatedContent, setGeneratedContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleGenerate = async () => {
    setIsLoading(true);
    setGeneratedContent('');
    try {
      const response = await fetch('/api/admin/generate-content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ contentType, dataSource }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '콘텐츠 생성에 실패했습니다.');
      }

      setGeneratedContent(data.content);
    } catch (error) {
      const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
      alert(`오류: ${message}`);
      setGeneratedContent(''); // Clear content on error
    }
    setIsLoading(false);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedContent);
    alert('콘텐츠가 클립보드에 복사되었습니다.');
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-lg border-2 border-gray-100">
      <h2 className="text-2xl font-bold mb-1 text-gray-800">🚀 데이터 콘텐츠 공장</h2>
      <p className="text-sm text-gray-500 mb-6">클릭 한 번으로 바이럴 콘텐츠를 자동 생성합니다.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: Settings */}
        <div className="space-y-4">
          <div>
            <label className="text-sm font-bold text-gray-600 block mb-2">1. 콘텐츠 유형 선택</label>
            <div className="flex space-x-2 rounded-lg bg-gray-100 p-1">
              <button onClick={() => setContentType('press-release')} className={`w-full px-3 py-2 text-sm font-bold rounded-md transition-colors ${contentType === 'press-release' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:bg-gray-200'}`}>📰 보도자료/칼럼</button>
              <button onClick={() => setContentType('short-form')} className={`w-full px-3 py-2 text-sm font-bold rounded-md transition-colors ${contentType === 'short-form' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:bg-gray-200'}`}>📱 숏폼 대본</button>
            </div>
          </div>

          <div>
            <label htmlFor="data-source" className="text-sm font-bold text-gray-600 block mb-2">2. 데이터 소스 선택</label>
            <select 
              id="data-source"
              value={dataSource}
              onChange={(e) => setDataSource(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
            >
              <option value="category-gap">카테고리별 신뢰도 격차</option>
              <option value="channel-rank">채널별 등급 분포</option>
              <option value="keyword-trend">주간 낚시 키워드 트렌드</option>
            </select>
          </div>

          <button 
            onClick={handleGenerate}
            disabled={isLoading}
            className="w-full bg-indigo-600 text-white font-bold py-3 px-4 rounded-md hover:bg-indigo-700 transition-all duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                <span>콘텐츠 생성 중...</span>
              </>
            ) : '✨ 콘텐츠 자동 생성'}
          </button>
        </div>

        {/* Right: Output */}
        <div className="relative">
           <label className="text-sm font-bold text-gray-600 block mb-2">3. 생성 결과</label>
          <textarea 
            value={generatedContent}
            readOnly
            placeholder="이곳에 생성된 콘텐츠가 표시됩니다..."
            className="w-full h-64 p-3 border border-gray-300 rounded-md bg-gray-50 resize-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
          />
          {generatedContent && (
            <button 
              onClick={copyToClipboard}
              className="absolute top-10 right-2 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-bold py-1 px-2 rounded"
            >
              복사
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

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
