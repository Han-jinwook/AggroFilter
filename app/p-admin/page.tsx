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
  const [selectedLogIds, setSelectedLogIds] = useState<Set<string>>(new Set());
  const [paymentLogs, setPaymentLogs] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/auth/me', { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((data) => {
        const email = data?.user?.email;
        if (email) {
          localStorage.setItem('userEmail', email);
          setIsAllowed(isAllowedAdminEmail(email));
        } else {
          // fallback: localStorage 이메일로 체크
          const localEmail = localStorage.getItem('userEmail');
          setIsAllowed(isAllowedAdminEmail(localEmail));
        }
      })
      .catch(() => {
        // fallback: localStorage 이메일로 체크
        const localEmail = localStorage.getItem('userEmail');
        setIsAllowed(isAllowedAdminEmail(localEmail));
      });
  }, []);

  const adminHeaders = useCallback(() => {
    const email = localStorage.getItem('userEmail') || '';
    return { 'x-admin-email': email };
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/stats', { headers: adminHeaders() });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (e) { console.error(e); }
  }, [adminHeaders]);

  const fetchAnalysisLogs = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/analysis-logs', { headers: adminHeaders() });
      if (res.ok) {
        const data = await res.json();
        setAnalysisLogs(data.logs);
      }
    } catch (e) { console.error(e); }
  }, [adminHeaders]);

  const fetchPaymentLogs = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/payment-logs', { headers: adminHeaders() });
      if (res.ok) {
        const data = await res.json();
        setPaymentLogs(data.logs);
      }
    } catch (e) { console.error(e); }
  }, [adminHeaders]);

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
      const res = await fetch(`/api/admin/credits?email=${encodeURIComponent(searchEmail)}`, { headers: adminHeaders() });
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
        headers: { 'Content-Type': 'application/json', ...adminHeaders() },
        body: JSON.stringify({ email: foundUser.f_email, amount })
      });
      if (res.ok) {
        const data = await res.json();
        setFoundUser({ ...foundUser, credits: data.newCredits });
        alert(`${amount > 0 ? '지급' : '차감'} 완료`);
      }
    } catch (e) { console.error(e); }
  };

  const handleDeleteLogs = async () => {
    if (selectedLogIds.size === 0) return;
    if (!confirm(`선택한 ${selectedLogIds.size}건의 분석 기록을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return;
    try {
      const res = await fetch('/api/admin/analysis-logs', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...adminHeaders() },
        body: JSON.stringify({ ids: Array.from(selectedLogIds) })
      });
      if (res.ok) {
        const data = await res.json();
        alert(`${data.deleted}건 삭제 완료`);
        setSelectedLogIds(new Set());
        fetchAnalysisLogs();
        fetchStats();
      }
    } catch (e) { console.error(e); }
  };

  const toggleLogSelection = (id: string) => {
    setSelectedLogIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAllLogs = () => {
    if (selectedLogIds.size === analysisLogs.length) {
      setSelectedLogIds(new Set());
    } else {
      setSelectedLogIds(new Set(analysisLogs.map(l => l.id)));
    }
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
      <main className="container mx-auto max-w-[var(--app-max-width)] px-3 sm:px-4 py-4 sm:py-6 md:px-6">
        {/* Tab Navigation */}
        <div className="mb-4 flex gap-2 p-1 bg-white rounded-2xl border border-gray-200 shadow-sm">
          <button
            onClick={() => setActiveTab('stats')}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${activeTab === 'stats' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            <BarChart3 className="w-4 h-4" /> 통계
          </button>
          <button
            onClick={() => setActiveTab('credits')}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${activeTab === 'credits' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            <CreditCard className="w-4 h-4" /> 크레딧
          </button>
          <button
            onClick={() => setActiveTab('analysis')}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${activeTab === 'analysis' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            <History className="w-4 h-4" /> 분석
          </button>
          <button
            onClick={() => setActiveTab('payments')}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${activeTab === 'payments' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            <Activity className="w-4 h-4" /> 결제
          </button>
        </div>

        <div>
          {/* === STATS TAB === */}
          {activeTab === 'stats' && stats && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                  <div className="flex items-center gap-3 text-gray-500 mb-2">
                    <Users className="w-4 h-4" /> <span className="text-xs font-bold">전체 유저</span>
                  </div>
                  <div className="text-3xl font-black text-gray-900">{stats.summary.total_users}</div>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                  <div className="flex items-center gap-3 text-indigo-500 mb-2">
                    <Activity className="w-4 h-4" /> <span className="text-xs font-bold">분석 사용자</span>
                  </div>
                  <div className="text-3xl font-black text-indigo-600">{stats.summary.unique_analysts}</div>
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
                <h3 className="text-sm font-bold text-gray-700 mb-4">일별 분석 추이 (최근 30일)</h3>
                <div className="space-y-2">
                  {stats.daily.map((day: any) => (
                    <div key={day.date} className="flex items-center gap-3">
                      <div className="text-xs text-gray-500 w-24">{new Date(day.date).toLocaleDateString()}</div>
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500" style={{ width: `${Math.min(100, (day.count / (Math.max(...stats.daily.map((d: any) => d.count)) || 1)) * 100)}%` }} />
                      </div>
                      <div className="text-xs font-bold text-gray-700 w-8">{day.count}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* === CREDITS TAB === */}
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
                <div className="p-6 bg-indigo-50 rounded-2xl border border-indigo-100">
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

          {/* === ANALYSIS TAB === */}
          {activeTab === 'analysis' && (
            <div className="space-y-3">
              {selectedLogIds.size > 0 && (
                <div className="flex items-center gap-3 p-3 bg-rose-50 border border-rose-200 rounded-xl">
                  <span className="text-xs font-bold text-rose-700">{selectedLogIds.size}건 선택됨</span>
                  <button
                    onClick={handleDeleteLogs}
                    className="px-4 py-1.5 bg-rose-500 text-white text-xs font-bold rounded-lg hover:bg-rose-600 transition-all"
                  >
                    선택 삭제
                  </button>
                  <button
                    onClick={() => setSelectedLogIds(new Set())}
                    className="px-4 py-1.5 bg-white text-gray-600 text-xs font-bold rounded-lg border border-gray-200 hover:bg-gray-50 transition-all"
                  >
                    선택 해제
                  </button>
                </div>
              )}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="pl-4 pr-2 py-4 w-8">
                        <input type="checkbox" checked={analysisLogs.length > 0 && selectedLogIds.size === analysisLogs.length} onChange={toggleAllLogs} className="rounded" />
                      </th>
                      <th className="px-3 py-4 text-xs font-bold text-gray-500">일시</th>
                      <th className="px-3 py-4 text-xs font-bold text-gray-500">사용자</th>
                      <th className="px-3 py-4 text-xs font-bold text-gray-500">채널</th>
                      <th className="px-3 py-4 text-xs font-bold text-gray-500">영상 제목</th>
                      <th className="px-3 py-4 text-xs font-bold text-gray-500">점수</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {analysisLogs.map((log) => (
                      <tr key={log.id} className={`hover:bg-gray-50 transition-colors ${selectedLogIds.has(log.id) ? 'bg-indigo-50' : ''}`}>
                        <td className="pl-4 pr-2 py-3">
                          <input type="checkbox" checked={selectedLogIds.has(log.id)} onChange={() => toggleLogSelection(log.id)} className="rounded" />
                        </td>
                        <td className="px-3 py-3 text-xs text-gray-500 whitespace-nowrap">{new Date(log.created_at).toLocaleString()}</td>
                        <td className="px-3 py-3 text-xs font-medium">
                          {log.user_email ? (
                            <span className="text-gray-900">{log.user_email}</span>
                          ) : (
                            <span className="text-orange-500 italic">비로그인</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-xs text-gray-600 max-w-[120px] truncate">{log.channel_name}</td>
                        <td className="px-3 py-3 text-xs text-gray-900 max-w-[200px] truncate">{log.title}</td>
                        <td className="px-3 py-3">
                          <span className={`px-2 py-1 rounded text-[10px] font-bold ${log.score >= 70 ? 'bg-emerald-50 text-emerald-600' : log.score >= 50 ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-600'}`}>
                            {log.score}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {analysisLogs.length === 0 && (
                  <div className="p-12 text-center text-gray-400 text-sm">분석 로그가 없습니다.</div>
                )}
              </div>
            </div>
          )}

          {/* === PAYMENTS TAB === */}
          {activeTab === 'payments' && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {paymentLogs.length === 0 ? (
                <div className="p-12 text-center text-gray-400 text-sm">결제 로그가 없습니다.</div>
              ) : (
                <table className="w-full text-left">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500">일시</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500">사용자</th>
                      <th className="px-6 py-4 text-xs font-bold text-gray-500">금액</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {paymentLogs.map((log: any) => (
                      <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 text-xs text-gray-500">{new Date(log.created_at).toLocaleString()}</td>
                        <td className="px-6 py-4 text-xs text-gray-900 font-medium">{log.user_email}</td>
                        <td className="px-6 py-4 text-xs font-bold text-gray-900">{log.amount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}