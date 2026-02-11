"use client"

import { useState, useEffect, useCallback } from 'react';
import { AppHeader } from '@/components/c-app-header';
import { 
  Users, 
  BarChart3, 
  History, 
  CreditCard, 
  Search, 
  Plus, 
  Minus,
  TrendingUp,
  Video,
  Activity
} from 'lucide-react';

function isAllowedAdminEmail(email: string | null | undefined) {
  const localPart = String(email || '').split('@')[0]?.trim().toLowerCase();
  return localPart === 'chiu3';
}

type TabType = 'credits' | 'analysis' | 'stats' | 'payments';

export default function AdminPage() {
  const [isAllowed, setIsAllowed] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('stats');
  
  // Stats state
  const [stats, setStats] = useState<any>(null);
  
  // Credits state
  const [searchEmail, setSearchEmail] = useState('');
  const [foundUser, setFoundUser] = useState<any>(null);
  const [creditAmount, setCreditAmount] = useState(10);
  
  // Logs state
  const [analysisLogs, setAnalysisLogs] = useState<any[]>([]);
  const [paymentLogs, setPaymentLogs] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/auth/me', { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((data) => {
        const email = data?.user?.email;
        setIsAllowed(isAllowedAdminEmail(email));
        if (email) {
          localStorage.setItem('userEmail', email);
        }
      })
      .catch(() => {
        setIsAllowed(false);
      });
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (e) { console.error(e); }
  }, []);

  const fetchAnalysisLogs = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/analysis-logs');
      if (res.ok) {
        const data = await res.json();
        setAnalysisLogs(data.logs);
      }
    } catch (e) { console.error(e); }
  }, []);

  const fetchPaymentLogs = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/payment-logs');
      if (res.ok) {
        const data = await res.json();
        setPaymentLogs(data.logs);
      }
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    if (isAllowed) {
      if (activeTab === 'stats') fetchStats();
      if (activeTab === 'analysis') fetchAnalysisLogs();
      if (activeTab === 'payments') fetchPaymentLogs();
    }
  }, [isAllowed, activeTab, fetchStats, fetchAnalysisLogs, fetchPaymentLogs]);

  const handleUserSearch = async () => {
    if (!searchEmail.trim()) return;
    try {
      const res = await fetch(`/api/admin/credits?email=${encodeURIComponent(searchEmail)}`);
      if (res.ok) {
        const data = await res.json();
        setFoundUser(data.user);
      } else {
        alert('사용자를 찾을 수 없습니다.');
        setFoundUser(null);
      }
    } catch (e) { console.error(e); }
  };

  const handleUpdateCredits = async (amount: number) => {
    if (!foundUser) return;
    try {
      const res = await fetch('/api/admin/credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: foundUser.f_email, amount })
      });
      if (res.ok) {
        const data = await res.json();
        setFoundUser({ ...foundUser, credits: data.newCredits });
        alert(`${amount > 0 ? '지급' : '차감'} 완료`);
      }
    } catch (e) { console.error(e); }
  };

  if (isAllowed === null) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AppHeader />
        <main className="mx-auto max-w-7xl px-4 py-16 flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </main>
      </div>
    );
  }

  if (!isAllowed) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AppHeader />
        <main className="mx-auto max-w-3xl px-4 py-16">
          <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm text-center">
            <h1 className="text-2xl font-bold text-gray-900">Access Denied</h1>
            <p className="mt-2 text-sm text-gray-600">관리자 전용 페이지입니다.</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />
      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Sidebar */}
          <aside className="w-full md:w-64 space-y-2">
            <button 
              onClick={() => setActiveTab('stats')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'stats' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100' : 'bg-white text-gray-600 hover:bg-gray-100'}`}
            >
              <BarChart3 className="w-4 h-4" /> 현황 통계
            </button>
            <button 
              onClick={() => setActiveTab('credits')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'credits' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100' : 'bg-white text-gray-600 hover:bg-gray-100'}`}
            >
              <CreditCard className="w-4 h-4" /> 크레딧 관리
            </button>
            <button 
              onClick={() => setActiveTab('analysis')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'analysis' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100' : 'bg-white text-gray-600 hover:bg-gray-100'}`}
            >
              <History className="w-4 h-4" /> 분석 로그
            </button>
            <button 
              onClick={() => setActiveTab('payments')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'payments' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100' : 'bg-white text-gray-600 hover:bg-gray-100'}`}
            >
              <Activity className="w-4 h-4" /> 결제 로그
            </button>
          </aside>

          {/* Content */}
          <div className="flex-1">
            {activeTab === 'stats' && stats && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-3 text-gray-500 mb-2">
                      <Users className="w-4 h-4" /> <span className="text-xs font-bold">전체 유저</span>
                    </div>
                    <div className="text-3xl font-black text-gray-900">{stats.summary.total_users}</div>
                  </div>
                  <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-3 text-gray-500 mb-2">
                      <Video className="w-4 h-4" /> <span className="text-xs font-bold">전체 분석</span>
                    </div>
                    <div className="text-3xl font-black text-gray-900">{stats.summary.total_analyses}</div>
                  </div>
                  <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-3 text-gray-500 mb-2">
                      <TrendingUp className="w-4 h-4" /> <span className="text-xs font-bold">전체 채널</span>
                    </div>
                    <div className="text-3xl font-black text-gray-900">{stats.summary.total_channels}</div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                  <h3 className="text-sm font-bold text-gray-900 mb-4">최근 30일 분석 추이</h3>
                  <div className="space-y-2">
                    {stats.daily.map((day: any) => (
                      <div key={day.date} className="flex items-center gap-4">
                        <div className="text-xs text-gray-500 w-24">{new Date(day.date).toLocaleDateString()}</div>
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-indigo-500" 
                            style={{ width: `${Math.min(100, (day.count / (Math.max(...stats.daily.map((d:any)=>d.count)) || 1)) * 100)}%` }}
                          />
                        </div>
                        <div className="text-xs font-bold text-gray-700 w-8">{day.count}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'credits' && (
              <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm space-y-8">
                <div className="max-w-md space-y-4">
                  <h3 className="text-lg font-bold text-gray-900">사용자 크레딧 조정</h3>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input 
                        type="email" 
                        placeholder="사용자 이메일 입력" 
                        value={searchEmail}
                        onChange={(e) => setSearchEmail(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                      />
                    </div>
                    <button 
                      onClick={handleUserSearch}
                      className="px-6 py-2 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800 transition-all"
                    >
                      검색
                    </button>
                  </div>
                </div>

                {foundUser && (
                  <div className="p-6 bg-indigo-50 rounded-2xl border border-indigo-100 animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <div className="text-sm font-bold text-indigo-900">{foundUser.f_nickname}</div>
                        <div className="text-xs text-indigo-600">{foundUser.f_email}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-indigo-600 font-bold uppercase mb-1">현재 크레딧</div>
                        <div className="text-2xl font-black text-indigo-900">{foundUser.credits}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <input 
                        type="number" 
                        value={creditAmount}
                        onChange={(e) => setCreditAmount(Number(e.target.value))}
                        className="w-24 px-4 py-2 bg-white border border-indigo-200 rounded-xl outline-none"
                      />
                      <button 
                        onClick={() => handleUpdateCredits(creditAmount)}
                        className="flex-1 flex items-center justify-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all"
                      >
                        <Plus className="w-4 h-4" /> 지급하기
                      </button>
                      <button 
                        onClick={() => handleUpdateCredits(-creditAmount)}
                        className="flex-1 flex items-center justify-center gap-2 px-6 py-2 bg-rose-500 text-white rounded-xl font-bold hover:bg-rose-600 transition-all"
                      >
                        <Minus className="w-4 h-4" /> 차감하기
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'analysis' && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500">일시</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500">사용자</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500">영상 제목</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500">점수</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {analysisLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 text-xs text-gray-500">{new Date(log.created_at).toLocaleString()}</td>
                        <td className="px-6 py-4 text-xs text-gray-900 font-medium">{log.user_email}</td>
                        <td className="px-6 py-4 text-xs text-gray-900 max-w-xs truncate">{log.title}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded text-[10px] font-bold ${log.score >= 70 ? 'bg-emerald-50 text-emerald-600' : log.score >= 40 ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-600'}`}>
                            {log.score}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'payments' && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {paymentLogs.length === 0 ? (
                  <div className="p-12 text-center text-gray-400 text-sm">결제 로그가 없습니다.</div>
                ) : (
                  <table className="w-full text-left">
                    {/* ... payment table UI ... */}
                  </table>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}