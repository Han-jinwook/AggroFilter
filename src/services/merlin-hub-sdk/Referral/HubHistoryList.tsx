import React from 'react';

interface HistoryItem {
  id: string;
  inviteeNickname: string;
  inviteeEmail?: string;
  joinedAt: string;
  status: 'PENDING' | 'REWARDED';
}

interface HubHistoryListProps {
  className?: string;
  history?: HistoryItem[];
  isLoading?: boolean;
}

/**
 * [Referral] 초대 실적 리스트
 * 내가 초대한 친구들의 목록과 각각의 보상 지급 상태를 보여주는 컴포넌트입니다.
 */
export const HubHistoryList: React.FC<HubHistoryListProps> = ({ 
  className = '', 
  history = [], 
  isLoading = false 
}) => {
  if (isLoading) {
    return <div className="w-full h-40 bg-gray-50 animate-pulse rounded-2xl" />;
  }

  return (
    <div className={`w-full bg-white rounded-2xl border border-gray-100 shadow-sm p-5 ${className}`}>
      <h3 className="text-lg font-bold text-gray-900 mb-4">초대 실적 현황</h3>
      
      {history.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm bg-gray-50 rounded-xl">
          아직 초대한 친구가 없습니다.<br/>
          친구를 초대하고 함께 혜택을 받아보세요!
        </div>
      ) : (
        <ul className="space-y-3">
          {history.map(item => {
            const emailId = item.inviteeEmail ? item.inviteeEmail.split('@')[0] : '';
            return (
              <li key={item.id} className="flex flex-col gap-2 p-3.5 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-800 break-all leading-normal">
                    {item.inviteeNickname}
                    {emailId && (
                      <span className="text-sm font-normal text-gray-500 ml-1">({emailId})</span>
                    )}
                    <span className="ml-1">님</span>
                  </p>
                  <p className="text-xs text-gray-400 mt-1">{item.joinedAt} 가입</p>
                </div>
                <div className="mt-1">
                  {item.status === 'REWARDED' ? (
                    <span className="inline-flex px-2.5 py-1 bg-green-100 text-green-700 text-[11px] font-black rounded-full whitespace-nowrap">
                      지급 완료
                    </span>
                  ) : (
                    <span className="inline-flex px-2.5 py-1 bg-gray-200 text-gray-600 text-[11px] font-black rounded-full whitespace-nowrap">
                      대기 중 (조건 미달성)
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
