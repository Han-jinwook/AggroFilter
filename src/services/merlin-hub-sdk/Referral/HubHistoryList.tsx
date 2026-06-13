/**
 * Version: v1.2.0
 * Last Updated: 2026-06-12
 */
import React from 'react';

interface HistoryItem {
  id: string;
  inviteeNickname: string;
  inviteeEmail?: string;
  joinedAt: string;
}

interface HubHistoryListProps {
  className?: string;
  history?: HistoryItem[];
  isLoading?: boolean;
}

/**
 * [Referral] 초대 실적 리스트
 * 내가 초대한 친구들의 목록을 보여주는 컴포넌트입니다.
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
      <h3 className="text-lg font-bold text-gray-900 mb-4">앱 초대 List</h3>
      
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
              <li key={item.id} className="p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors flex flex-col justify-center">
                {/* 1st Row: User Name & Email */}
                <p className="font-semibold text-gray-800 break-all leading-snug">
                  {item.inviteeNickname}
                  {emailId && (
                    <span className="text-sm font-normal text-gray-500 ml-1">({emailId})</span>
                  )}
                  <span className="ml-1">님</span>
                </p>
                {/* 2nd Row: Joined Date */}
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-xs text-gray-500">{item.joinedAt} 가입</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
