import { useCallback, useRef } from 'react'

interface UseLongPressOptions {
  onLongPress: () => void
  onClick?: () => void
  delay?: number
}

export function useLongPress(
  { onLongPress, onClick, delay = 500 }: UseLongPressOptions
) {
  const timerRef = useRef<NodeJS.Timeout>()
  const isLongPress = useRef(false)

  const start = useCallback(() => {
    isLongPress.current = false
    timerRef.current = setTimeout(() => {
      isLongPress.current = true
      onLongPress()
    }, delay)
  }, [onLongPress, delay])

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }
    
    // 짧게 클릭한 경우에만 onClick 실행
    if (!isLongPress.current && onClick) {
      onClick()
    }
  }, [onClick])

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }
  }, [])

  return {
    onMouseDown: start,
    onMouseUp: clear,
    onMouseLeave: cancel,
    onTouchStart: start,
    onTouchEnd: clear,
  }
}
