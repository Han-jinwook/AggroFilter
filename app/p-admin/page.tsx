"use client"

import { useState, useEffect } from 'react';
import { AppHeader } from '@/components/c-app-header';

const YOUTUBE_CATEGORIES = [
  { id: 1, name: '영화/애니메이션' },
  { id: 2, name: '자동차/교통' },
  { id: 10, name: '음악' },
  { id: 15, name: '애완동물/동물' },
  { id: 17, name: '스포츠' },
  { id: 19, name: '여행/이벤트' },
  { id: 20, name: '게임' },
  { id: 22, name: '인물/블로그' },
  { id: 23, name: '코미디' },
  { id: 24, name: '엔터테인먼트' },
  { id: 25, name: '뉴스/정치' },
  { id: 26, name: '노하우/스타일' },
  { id: 27, name: '교육' },
  { id: 28, name: '과학/기술' },
  { id: 29, name: '비영리/사회운동' },
];

const DataCollector = () => {
  const [budget, setBudget] = useState('1.00');
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
  const [isCollecting, setIsCollecting] = useState(false);
  const [logs, setLogs] = useState<{ date: string; count: number; cost: number }[]>([]);

  const handleCategoryChange = (categoryId: number) => {
    setSelectedCategories(prev =>
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

    const handleManualCollect = async () => {
    if (selectedCategories.length === 0) {
      alert('하나 이상의 카테고리를 선택해주세요.');
      return;
    }
    setIsCollecting(true);
    try {
      const response = await fetch('/api/admin/collect-manual', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ budget: parseFloat(budget), categoryIds: selectedCategories }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '수동 수집에 실패했습니다.');
      }

      alert(data.message);
      // TODO: After collection, refresh logs from the database.
    } catch (error) {
      const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
      alert(`오류: ${message}`);
    }
    setIsCollecting(false);
  };

  useEffect(() => {
    // TODO: Fetch initial logs from DB
    setLogs([
      { date: '2026-02-02', count: 48, cost: 0.09 },
      { date: '2026-02-01', count: 52, cost: 0.11 },
    ]);
  }, []);

  return (
    <div className="bg-white p-6 rounded-2xl shadow-lg border-2 border-gray-100">
      <h2 className="text-2xl font-bold mb-1 text-gray-800">📌 Data Collector</h2>
      <p className="text-sm text-gray-500 mb-6">유튜브 트렌드 영상을 자동 수집하는 스케줄러를 관리합니다.</p>

      <div className="space-y-6">
        <div>
          <label htmlFor="budget" className="text-sm font-bold text-gray-600 block mb-2">일일 수집 예산 설정 ($)</label>
          <input 
            type="number" 
            id="budget" 
            value={budget} 
            onChange={(e) => setBudget(e.target.value)} 
            className="w-full md:w-1/3 p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition" 
            placeholder="예: 1.00"
          />
        </div>

        <div>
          <label className="text-sm font-bold text-gray-600 block mb-2">수집 카테고리 선택</label>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 p-4 bg-gray-50 rounded-lg border">
            {YOUTUBE_CATEGORIES.map(cat => (
              <label key={cat.id} className="flex items-center space-x-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={selectedCategories.includes(cat.id)}
                  onChange={() => handleCategoryChange(cat.id)}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-700">{cat.name}</span>
              </label>
            ))}
          </div>
        </div>

        <button 
          onClick={handleManualCollect}
          disabled={isCollecting}
          className="w-full md:w-auto bg-indigo-600 text-white font-bold py-2 px-6 rounded-md hover:bg-indigo-700 transition-all duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
        >
          {isCollecting ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
              <span>수집 및 분석 중...</span>
            </>
          ) : '🚀 수동 수집 실행 (50개)'}
        </button>

        <div>
          <h3 className="text-lg font-bold text-gray-700 mb-2">수집 로그</h3>
          <div className="overflow-x-auto border rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">날짜</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">수집 영상 수</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">소모 비용</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {logs.map(log => (
                  <tr key={log.date}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{log.date}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{log.count} 개</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${log.cost.toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

const InsightMiner = ({ onSelectMaterial }: { onSelectMaterial: (material: any) => void }) => {
  const [miningCondition, setMiningCondition] = useState('aggro_top');
  const [period, setPeriod] = useState('today');
  const [isMining, setIsMining] = useState(false);
  const [materials, setMaterials] = useState<any[]>([]);

    const handleMine = async () => {
    setIsMining(true);
    setMaterials([]);
    try {
      const response = await fetch('/api/admin/mine-materials', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ miningCondition, period }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '소재 발굴에 실패했습니다.');
      }

      setMaterials(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
      alert(`오류: ${message}`);
    }
    setIsMining(false);
  };

  useEffect(() => {
    // Load initial materials
    handleMine();
  }, []);

  return (
    <div className="bg-white p-6 rounded-2xl shadow-lg border-2 border-gray-100">
      <h2 className="text-2xl font-bold mb-1 text-gray-800">⛏️ Insight Miner</h2>
      <p className="text-sm text-gray-500 mb-6">수집된 DB(t_analysis_history)에서 '콘텐츠 감'이 되는 데이터를 필터링합니다.</p>

      <div className="flex flex-wrap items-center gap-4 mb-6 p-4 bg-gray-50 rounded-lg border">
        <div className="flex-1 min-w-[200px]">
          <label htmlFor="mining-condition" className="text-sm font-bold text-gray-600 block mb-1">마이닝 조건</label>
          <select 
            id="mining-condition"
            value={miningCondition}
            onChange={(e) => setMiningCondition(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
          >
            <option value="aggro_top">어그로 점수 80점 이상</option>
            <option value="clean_unexpected">의외의 청정 채널</option>
            <option value="score_drop">점수 급락 채널</option>
          </select>
        </div>
        <div className="flex-1 min-w-[150px]">
          <label htmlFor="period" className="text-sm font-bold text-gray-600 block mb-1">기간</label>
          <select 
            id="period"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
          >
            <option value="today">오늘</option>
            <option value="this_week">이번 주</option>
          </select>
        </div>
        <div className="self-end">
          <button 
            onClick={handleMine}
            disabled={isMining}
            className="w-full bg-indigo-600 text-white font-bold py-2 px-6 rounded-md hover:bg-indigo-700 transition-all duration-200 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
          >
             {isMining ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                <span>탐색 중...</span>
              </>
            ) : '💎 소재 추출 실행'}
          </button>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-bold text-gray-700 mb-4">발굴된 소재 리스트 ({materials.length}개)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {materials.map(material => (
            <div key={material.id} className="bg-white border rounded-lg shadow-md overflow-hidden transition-transform hover:scale-105">
              <img src={material.thumbnail_url} alt={material.title} className="w-full h-40 object-cover" />
              <div className="p-4">
                <p className="text-sm font-bold text-gray-800 truncate" title={material.title}>{material.title}</p>
                <div className="flex justify-between items-center mt-2">
                  <span className={`text-xl font-bold ${material.score > 80 ? 'text-red-500' : 'text-green-500'}`}>{material.score}점</span>
                  <span className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded-full">{material.reason}</span>
                </div>
                                <button 
                  onClick={() => onSelectMaterial(material)}
                  className="mt-4 w-full bg-gray-800 text-white font-semibold py-2 rounded-md hover:bg-black transition-colors"
                >
                  콘텐츠 생성하기
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const ContentCrafter = ({ material }: { material: any | null }) => {
  const [contentType, setContentType] = useState('press-release');
    // const [dataSource, setDataSource] = useState('category-gap'); // No longer needed
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
        body: JSON.stringify({ contentType, materialId: material?.id }),
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
            <h2 className="text-2xl font-bold mb-1 text-gray-800">✍️ Content Crafter</h2>
      <p className="text-sm text-gray-500 mb-6">선택된 소재를 바탕으로 실제 마케팅 원고를 생성합니다.</p>

      {!material ? (
        <div className="text-center py-12 text-gray-500">
          <p>Insight Miner 탭에서 생성할 콘텐츠 소재를 먼저 선택해주세요.</p>
        </div>
      ) : (

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
            <label className="text-sm font-bold text-gray-600 block mb-2">2. 선택된 소재</label>
            <div className="p-3 border rounded-md bg-gray-50">
              <p className="text-sm font-semibold text-gray-800 truncate">{material.title}</p>
              <p className="text-xs text-gray-500">어그로 점수: {material.score}</p>
            </div>
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
  const [activeTab, setActiveTab] = useState('collector');
  const [selectedMaterial, setSelectedMaterial] = useState<any | null>(null);

  const handleSelectMaterial = (material: any) => {
    setSelectedMaterial(material);
    setActiveTab('crafter');
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'collector':
        return <DataCollector />;
      case 'miner':
        return <InsightMiner onSelectMaterial={handleSelectMaterial} />;
      case 'crafter':
        return <ContentCrafter material={selectedMaterial} />;
      default:
        return null;
    }
  };

  const TabButton = ({ tabName, label }: { tabName: string; label: string }) => (
    <button 
      onClick={() => setActiveTab(tabName)}
      className={`px-4 py-2 text-sm font-medium transition-colors ${
        activeTab === tabName 
          ? 'border-b-2 border-indigo-600 text-indigo-600'
          : 'text-gray-500 hover:text-gray-700'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-gray-100">
      <AppHeader />
      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">🤖 Auto Marketer</h1>
          <p className="text-sm text-gray-500 mt-1">마케팅 콘텐츠 자동 생성 파이프라인</p>
        </div>

        <div className="flex border-b border-gray-200 mb-6">
          <TabButton tabName="collector" label="📌 Data Collector" />
          <TabButton tabName="miner" label="⛏️ Insight Miner" />
          <TabButton tabName="crafter" label="✍️ Content Crafter" />
        </div>

        <div>
          {renderContent()}
        </div>
      </main>
    </div>
  );
}