"use client"

import { useState, useEffect, useCallback, useRef } from 'react';
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

type ColDef = { key: string; label: string; width: number; fixed?: boolean };

const DEFAULT_COLUMNS: ColDef[] = [
  { key: 'checkbox',   label: '',          width: 36,  fixed: true },
  { key: 'created_at', label: '일시',       width: 110 },
  { key: 'user_email', label: '사용자',     width: 100 },
  { key: 'channel',    label: '채널',       width: 110 },
  { key: 'title',      label: '영상 제목',  width: 200 },
  { key: 'score',      label: '신뢰도',     width: 68 },
  { key: 'accuracy',   label: '정확도',     width: 68 },
  { key: 'clickbait',  label: '어그로',     width: 68 },
  { key: 'grounding',  label: '검색',       width: 80 },
  { key: 'type',       label: '구분',       width: 68 },
];
const COL_STORAGE_KEY = 'admin_analysis_cols_v2';

function loadCols(): ColDef[] {
  if (typeof window === 'undefined') return DEFAULT_COLUMNS;
  try {
    const saved = localStorage.getItem(COL_STORAGE_KEY);
    if (!saved) return DEFAULT_COLUMNS;
    const parsed: { key: string; width: number }[] = JSON.parse(saved);
    const ordered = parsed
      .map(s => { const d = DEFAULT_COLUMNS.find(c => c.key === s.key); return d ? { ...d, width: s.width } : null; })
      .filter(Boolean) as ColDef[];
    DEFAULT_COLUMNS.forEach(c => { if (!ordered.find(o => o.key === c.key)) ordered.push({ ...c }); });
    return ordered;
  } catch { return DEFAULT_COLUMNS; }
}

function saveCols(cols: ColDef[]) {
  localStorage.setItem(COL_STORAGE_KEY, JSON.stringify(cols.map(c => ({ key: c.key, width: c.width }))));
}

function AnalysisTable({ logs, selectedLogIds, toggleLogSelection, toggleAllLogs, isChiu3 }: {
  logs: any[];
  selectedLogIds: Set<string>;
  toggleLogSelection: (id: string) => void;
  toggleAllLogs: () => void;
  isChiu3: boolean;
}) {
  const [cols, setCols] = useState<ColDef[]>(loadCols);
  const dragColIdx = useRef<number | null>(null);
  const dragOverIdx = useRef<number | null>(null);
  const resizeIdx = useRef<number | null>(null);
  const resizeStartX = useRef(0);
  const resizeStartW = useRef(0);

  const onResizeDown = (e: React.MouseEvent, idx: number) => {
    if (!isChiu3) return;
    e.preventDefault();
    resizeIdx.current = idx;
    resizeStartX.current = e.clientX;
    resizeStartW.current = cols[idx].width;
    const onMove = (me: MouseEvent) => {
      if (resizeIdx.current === null) return;
      const delta = me.clientX - resizeStartX.current;
      setCols(prev => {
        const next = prev.map((c, i) => i === resizeIdx.current ? { ...c, width: Math.max(40, resizeStartW.current + delta) } : c);
        saveCols(next);
        return next;
      });
    };
    const onUp = () => { resizeIdx.current = null; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const onDragStart = (e: React.DragEvent, idx: number) => {
    if (!isChiu3 || cols[idx].fixed) { e.preventDefault(); return; }
    dragColIdx.current = idx;
    e.dataTransfer.effectAllowed = 'move';
  };
  const onDragOver = (e: React.DragEvent, idx: number) => {
    if (!isChiu3) return;
    e.preventDefault();
    dragOverIdx.current = idx;
  };
  const onDrop = (e: React.DragEvent, idx: number) => {
    if (!isChiu3) return;
    e.preventDefault();
    if (dragColIdx.current === null || dragColIdx.current === idx) return;
    const from = dragColIdx.current;
    setCols(prev => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(idx, 0, moved);
      saveCols(next);
      return next;
    });
    dragColIdx.current = null;
  };

  const renderCell = (col: ColDef, log: any) => {
    switch (col.key) {
      case 'checkbox': return <input type="checkbox" checked={selectedLogIds.has(log.id)} onChange={() => toggleLogSelection(log.id)} className="rounded" />;
      case 'created_at': return <span className="text-gray-500 whitespace-nowrap">{new Date(log.created_at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>;
      case 'user_email': return log.user_email
        ? <span className="text-gray-900 font-medium truncate block">{log.user_email.split('@')[0]}</span>
        : log.user_id?.startsWith('anon_')
          ? <span className="text-orange-400 italic">익명</span>
          : <span className="text-gray-400 italic">-</span>;
      case 'channel': return <span className="text-gray-600 truncate block">{log.channel_name}</span>;
      case 'title': return <span className="text-gray-900 truncate block" title={log.title}>{log.title}</span>;
      case 'score': return <span className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${
        log.score >= 70 ? 'bg-emerald-50 text-emerald-600' : log.score >= 40 ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-600'
      }`}>{log.score}</span>;
      case 'accuracy': return <span className="text-gray-600">{log.accuracy ?? '-'}</span>;
      case 'clickbait': return <span className="text-gray-600">{log.clickbait ?? '-'}</span>;
      case 'grounding': return log.grounding_used
        ? <span title={(log.grounding_queries || []).join(', ')} className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-600 cursor-help">🔍 검색</span>
        : <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-gray-50 text-gray-400">💭 추론</span>;
      case 'type': return log.is_recheck
        ? <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-600">재분석</span>
        : <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-gray-50 text-gray-400">신규</span>;
      default: return null;
    }
  };

  const totalWidth = cols.reduce((s, c) => s + c.width, 0);

  return (
    <div className="border border-gray-200 rounded-xl bg-white" style={{ display: 'flex', flexDirection: 'column', maxHeight: '72vh' }}>
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
        <table style={{ width: totalWidth, tableLayout: 'fixed', borderCollapse: 'collapse' }} className="text-xs">
          <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
            <tr style={{ background: '#f8fafc' }}>
              {cols.map((col, idx) => (
                <th
                  key={col.key}
                  style={{ width: col.width, minWidth: col.width, maxWidth: col.width, position: 'relative', borderBottom: '2px solid #cbd5e1', borderRight: '1px solid #e2e8f0', padding: '10px 8px' }}
                  className="text-left font-bold text-gray-500 select-none"
                  draggable={isChiu3 && !col.fixed}
                  onDragStart={e => onDragStart(e, idx)}
                  onDragOver={e => onDragOver(e, idx)}
                  onDrop={e => onDrop(e, idx)}
                >
                  {col.key === 'checkbox'
                    ? <input type="checkbox" checked={logs.length > 0 && selectedLogIds.size === logs.length} onChange={toggleAllLogs} className="rounded" />
                    : <span className={isChiu3 ? 'cursor-grab' : ''}>{col.label}</span>
                  }
                  {isChiu3 && !col.fixed && (
                    <span
                      onMouseDown={e => onResizeDown(e, idx)}
                      style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 5, cursor: 'col-resize', zIndex: 1 }}
                      className="hover:bg-blue-400 opacity-0 hover:opacity-60 transition-opacity"
                    />
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {logs.map((log, ri) => (
              <tr
                key={log.id}
                style={{ background: selectedLogIds.has(log.id) ? '#eef2ff' : ri % 2 === 0 ? '#ffffff' : '#f9fafb' }}
                className="hover:bg-blue-50 transition-colors"
              >
                {cols.map(col => (
                  <td
                    key={col.key}
                    style={{ width: col.width, minWidth: col.width, maxWidth: col.width, borderBottom: '1px solid #f1f5f9', borderRight: '1px solid #f1f5f9', overflow: 'hidden', padding: '8px 8px' }}
                    className="text-center align-middle"
                  >
                    {renderCell(col, log)}
                  </td>
                ))}
              </tr>
            ))}
            {logs.length === 0 && (
              <tr><td colSpan={cols.length} className="py-12 text-center text-gray-400">분석 로그가 없습니다.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

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
        <main className="mx-auto px-4 py-16 flex justify-center">
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
      <main className="w-full px-3 sm:px-4 py-4 sm:py-6 md:px-8">
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
              <AnalysisTable
                logs={analysisLogs}
                selectedLogIds={selectedLogIds}
                toggleLogSelection={toggleLogSelection}
                toggleAllLogs={toggleAllLogs}
                isChiu3={isAllowedAdminEmail(typeof window !== 'undefined' ? localStorage.getItem('userEmail') : '')}
              />
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