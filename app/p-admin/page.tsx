"use client"

import { useState, useEffect, useCallback, useRef } from 'react';
import { AppHeader } from '@/components/c-app-header';
import { toast } from '@/components/c-toast';
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

type TabType = 'credits' | 'analysis' | 'review' | 'stats' | 'payments';

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
  { key: 'is_valid',   label: '유효',       width: 60 },
  { key: 'needs_review', label: '검토',      width: 60 },
  { key: 'review_reason', label: '이유',      width: 150 },
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
      case 'is_valid': return log.is_valid ? <span className="text-emerald-500">Y</span> : <span className="text-rose-500">N</span>;
      case 'needs_review': return log.needs_review ? <span className="text-amber-500 font-bold">Q</span> : <span className="text-gray-300">-</span>;
      case 'review_reason': return <span className="text-gray-500 truncate block text-[10px]" title={log.review_reason}>{log.review_reason || '-'}</span>;
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
  const [reviewLogs, setReviewLogs] = useState<any[]>([]);
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

  const fetchReviewLogs = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/analysis-logs?reviewOnly=true', { headers: adminHeaders() });
      if (res.ok) {
        const data = await res.json();
        setReviewLogs(data.logs);
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
      if (activeTab === 'review') fetchReviewLogs();
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
        toast.error('사용자를 찾을 수 없습니다.');
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
        toast.success(`${amount > 0 ? '지급' : '차감'} 완료`);
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
        toast.success(`${data.deleted}건 삭제 완료`);
        setSelectedLogIds(new Set());
        fetchAnalysisLogs();
        fetchStats();
      }
    } catch (e) { console.error(e); }
  };

  const handleReviewAction = async (id: string, isValid: boolean) => {
    try {
      const res = await fetch('/api/admin/analysis-logs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...adminHeaders() },
        body: JSON.stringify({ id, is_valid: isValid, needs_review: false })
      });
      if (res.ok) {
        toast.success(isValid ? '승인 완료' : '반려 완료');
        fetchReviewLogs();
        fetchAnalysisLogs();
      } else {
        toast.error('처리에 실패했습니다.');
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
            <CreditCard className="w-4 h-4" /> 코인
          </button>
          <button
            onClick={() => setActiveTab('analysis')}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${activeTab === 'analysis' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            <History className="w-4 h-4" /> 분석
          </button>
          <button
            onClick={() => setActiveTab('review')}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${activeTab === 'review' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            <Search className="w-4 h-4" /> 검토 {reviewLogs.length > 0 && <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{reviewLogs.length}</span>}
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
            <div className="space-y-5">
              {/* 요약 카드 */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { icon: <Users className="w-4 h-4" />, label: '전체 유저', value: stats.summary.total_users, color: 'text-gray-500', valColor: 'text-gray-900' },
                  { icon: <Activity className="w-4 h-4" />, label: '분석 사용자', value: stats.summary.unique_analysts, color: 'text-indigo-500', valColor: 'text-indigo-600' },
                  { icon: <Video className="w-4 h-4" />, label: '전체 분석', value: stats.summary.total_analyses, color: 'text-gray-500', valColor: 'text-gray-900' },
                  { icon: <TrendingUp className="w-4 h-4" />, label: '전체 채널', value: stats.summary.total_channels, color: 'text-gray-500', valColor: 'text-gray-900' },
                ].map(({ icon, label, value, color, valColor }) => (
                  <div key={label} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                    <div className={`flex items-center gap-2 ${color} mb-2`}>
                      {icon} <span className="text-xs font-bold">{label}</span>
                    </div>
                    <div className={`text-3xl font-black ${valColor}`}>{Number(value).toLocaleString()}</div>
                  </div>
                ))}
              </div>

              {/* 일별 분석 SVG 바차트 */}
              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                <h3 className="text-sm font-bold text-gray-700 mb-4">일별 분석 추이 (최근 30일)</h3>
                {(() => {
                  const daily: { date: string; count: number }[] = stats.daily;
                  const maxVal = Math.max(...daily.map(d => Number(d.count)), 1);
                  const W = 700, H = 120, PAD = 28, BAR_GAP = 2;
                  const barW = daily.length > 0 ? Math.max(4, (W - PAD * 2) / daily.length - BAR_GAP) : 8;
                  const step = (W - PAD * 2) / Math.max(daily.length, 1);
                  return (
                    <div className="overflow-x-auto">
                      <svg viewBox={`0 0 ${W} ${H + 24}`} className="w-full" style={{ minWidth: 320 }}>
                        {/* Y grid lines */}
                        {[0, 0.25, 0.5, 0.75, 1].map(r => (
                          <line key={r} x1={PAD} y1={H - H * r + 4} x2={W - PAD} y2={H - H * r + 4} stroke="#f1f5f9" strokeWidth="1" />
                        ))}
                        {/* Bars */}
                        {daily.map((d, i) => {
                          const h = Math.max(2, (Number(d.count) / maxVal) * (H - 8));
                          const x = PAD + i * step + (step - barW) / 2;
                          const y = H - h + 4;
                          return (
                            <g key={d.date}>
                              <rect x={x} y={y} width={barW} height={h} rx="3" fill="#6366f1" opacity="0.85" />
                              {Number(d.count) === maxVal && (
                                <text x={x + barW / 2} y={y - 4} textAnchor="middle" fontSize="9" fill="#6366f1" fontWeight="bold">{d.count}</text>
                              )}
                            </g>
                          );
                        })}
                        {/* X labels — show every ~5 days */}
                        {daily.map((d, i) => {
                          if (i % Math.ceil(daily.length / 6) !== 0 && i !== daily.length - 1) return null;
                          const x = PAD + i * step + step / 2;
                          const label = new Date(d.date).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' });
                          return <text key={d.date} x={x} y={H + 18} textAnchor="middle" fontSize="9" fill="#94a3b8">{label}</text>;
                        })}
                      </svg>
                    </div>
                  );
                })()}
              </div>

              {/* 하단 3개 차트 */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

                {/* 신뢰도 분포 도넛 */}
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                  <h3 className="text-sm font-bold text-gray-700 mb-4">신뢰도 분포</h3>
                  {(() => {
                    const g = Number(stats.scoreDist?.green || 0);
                    const y = Number(stats.scoreDist?.yellow || 0);
                    const r = Number(stats.scoreDist?.red || 0);
                    const total = g + y + r || 1;
                    const pct = (v: number) => Math.round(v / total * 100);
                    const segments = [
                      { val: g, color: '#10b981', label: '🟢 Green', pct: pct(g) },
                      { val: y, color: '#f59e0b', label: '🟡 Yellow', pct: pct(y) },
                      { val: r, color: '#ef4444', label: '🔴 Red', pct: pct(r) },
                    ];
                    // SVG donut
                    const cx = 60, cy = 60, R = 46, r2 = 28;
                    let startAngle = -Math.PI / 2;
                    const arcs = segments.map(s => {
                      const angle = (s.val / total) * 2 * Math.PI;
                      const x1 = cx + R * Math.cos(startAngle), y1 = cy + R * Math.sin(startAngle);
                      const x2 = cx + R * Math.cos(startAngle + angle), y2 = cy + R * Math.sin(startAngle + angle);
                      const xi1 = cx + r2 * Math.cos(startAngle + angle), yi1 = cy + r2 * Math.sin(startAngle + angle);
                      const xi2 = cx + r2 * Math.cos(startAngle), yi2 = cy + r2 * Math.sin(startAngle);
                      const large = angle > Math.PI ? 1 : 0;
                      const path = `M ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} L ${xi1} ${yi1} A ${r2} ${r2} 0 ${large} 0 ${xi2} ${yi2} Z`;
                      startAngle += angle;
                      return { ...s, path };
                    });
                    return (
                      <div className="flex items-center gap-4">
                        <svg viewBox="0 0 120 120" className="w-24 h-24 flex-shrink-0">
                          {arcs.map(a => <path key={a.label} d={a.path} fill={a.color} opacity="0.9" />)}
                          <text x={cx} y={cy + 4} textAnchor="middle" fontSize="11" fontWeight="bold" fill="#1e293b">{total.toLocaleString()}</text>
                          <text x={cx} y={cy + 15} textAnchor="middle" fontSize="8" fill="#94a3b8">총 분석</text>
                        </svg>
                        <div className="space-y-1.5 flex-1">
                          {segments.map(s => (
                            <div key={s.label} className="flex items-center justify-between text-xs">
                              <span className="text-gray-600">{s.label}</span>
                              <span className="font-bold text-gray-900">{s.pct}%</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* 신규 vs 재분석 */}
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                  <h3 className="text-sm font-bold text-gray-700 mb-4">신규 vs 재분석</h3>
                  {(() => {
                    const nw = Number(stats.recheckStats?.new_count || 0);
                    const rc = Number(stats.recheckStats?.recheck_count || 0);
                    const total = nw + rc || 1;
                    const nwPct = Math.round(nw / total * 100);
                    const rcPct = 100 - nwPct;
                    return (
                      <div className="space-y-3">
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-gray-600 font-bold">신규 분석</span>
                            <span className="font-black text-indigo-600">{nwPct}% <span className="text-gray-400 font-normal">({nw.toLocaleString()})</span></span>
                          </div>
                          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${nwPct}%` }} />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-gray-600 font-bold">재분석</span>
                            <span className="font-black text-violet-600">{rcPct}% <span className="text-gray-400 font-normal">({rc.toLocaleString()})</span></span>
                          </div>
                          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-violet-400 rounded-full transition-all" style={{ width: `${rcPct}%` }} />
                          </div>
                        </div>
                        <div className="pt-2 border-t border-gray-100 text-xs text-gray-400 text-center">
                          총 {total.toLocaleString()}건
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* 언어별 분포 */}
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                  <h3 className="text-sm font-bold text-gray-700 mb-4">언어별 분석</h3>
                  {(() => {
                    const langs: { language: string; count: number }[] = stats.langStats || [];
                    const total = langs.reduce((s, l) => s + Number(l.count), 0) || 1;
                    const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
                    return (
                      <div className="space-y-2">
                        {langs.map((l, i) => {
                          const pct = Math.round(Number(l.count) / total * 100);
                          return (
                            <div key={l.language}>
                              <div className="flex justify-between text-xs mb-0.5">
                                <span className="text-gray-600 font-bold capitalize">{l.language}</span>
                                <span className="font-bold text-gray-700">{pct}% <span className="text-gray-400 font-normal">({Number(l.count).toLocaleString()})</span></span>
                              </div>
                              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: colors[i % colors.length] }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* === COINS TAB === */}
          {activeTab === 'credits' && (
            <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm space-y-8">
              <div className="max-w-md space-y-4">
                <h3 className="text-lg font-bold text-gray-900">사용자 코인 조정</h3>
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
                      <div className="text-xs text-indigo-600 font-bold uppercase mb-1">현재 코인</div>
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

          {/* === REVIEW TAB === */}
          {activeTab === 'review' && (
            <div className="space-y-4">
              <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                <h3 className="text-sm font-bold text-gray-700 mb-1">AI 검토 대기열 (Review Queue)</h3>
                <p className="text-xs text-gray-500">AI가 &apos;팩트체크 적합성&apos;을 확신하지 못해 관리자의 확인이 필요한 영상들입니다.</p>
              </div>
              <div className="border border-gray-200 rounded-xl bg-white overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="p-3 text-left font-bold text-gray-500">일시</th>
                      <th className="p-3 text-left font-bold text-gray-500">채널/제목</th>
                      <th className="p-3 text-left font-bold text-gray-500">검토 사유</th>
                      <th className="p-3 text-center font-bold text-gray-500">액션</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {reviewLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="p-3 text-gray-500 whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="p-3">
                          <div className="font-bold text-gray-900 truncate max-w-[200px]">{log.title}</div>
                          <div className="text-gray-500 text-[10px]">{log.channel_name}</div>
                        </td>
                        <td className="p-3 text-amber-600 font-medium">
                          {log.review_reason || '사유 없음'}
                        </td>
                        <td className="p-3">
                          <div className="flex justify-center gap-2">
                            <button
                              onClick={() => handleReviewAction(log.id, true)}
                              className="px-3 py-1 bg-emerald-500 text-white font-bold rounded hover:bg-emerald-600 transition-all"
                            >
                              승인
                            </button>
                            <button
                              onClick={() => handleReviewAction(log.id, false)}
                              className="px-3 py-1 bg-rose-500 text-white font-bold rounded hover:bg-rose-600 transition-all"
                            >
                              반려
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {reviewLogs.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-12 text-center text-gray-400">검토 대기 중인 영상이 없습니다.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
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