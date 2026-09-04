import React from 'react';

/**
 * 📱 Merlin Hub SDK Mobile Input & Cursor Utilities
 * 모바일 입력창에서 커서를 텍스트 맨 뒤로 자동 위치시켜 백스페이스 편의성을 극대화하는 헬퍼
 */

/**
 * HTML Input 또는 Textarea 요소의 커서를 텍스트 맨 뒤로 이동시킵니다.
 */
export const setCursorToEnd = (element: HTMLInputElement | HTMLTextAreaElement | null): void => {
  if (!element) return;
  setTimeout(() => {
    try {
      const len = element.value.length;
      element.setSelectionRange(len, len);
    } catch {
      // type="number" 등 setSelectionRange 미지원 타입 예외 방어
    }
  }, 0);
};

/**
 * React Input의 onFocus 또는 onClick 이벤트 핸들러로 직접 연결하여 커서를 맨 뒤로 보냅니다.
 * 사용법: <input onFocus={handleCursorToEnd} onClick={handleCursorToEnd} />
 */
export const handleCursorToEnd = (
  e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement> | React.MouseEvent<HTMLInputElement | HTMLTextAreaElement>
): void => {
  const target = e.currentTarget;
  setCursorToEnd(target);
};
