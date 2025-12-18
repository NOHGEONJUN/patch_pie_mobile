import React, { useRef, useEffect, useState } from 'react';
import { ScrollVideoProps } from './types';
import { Loader2 } from 'lucide-react';

export const ScrollVideoContainer: React.FC<ScrollVideoProps> = ({ 
  src, 
  scrollLength = '400vh', 
  children 
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Ref to store the desired time based on scroll position.
  // Using ref instead of state to avoid re-renders during the high-frequency loop.
  const targetTimeRef = useRef<number>(0);
  
  // Helper to handle metadata loading
  const handleLoadedMetadata = () => {
    setIsLoading(false);
  };

  useEffect(() => {
    const video = videoRef.current;
    const container = containerRef.current;

    if (!video || !container) return;

    // 스크롤 위치를 계산하는 함수 (모바일/데스크톱 모두 대응)
    const calculateScrollProgress = () => {
      // 모바일에서 더 정확한 스크롤 위치 계산을 위해 여러 방법 시도
      const containerRect = container.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      
      // 스크롤 거리 계산: 컨테이너가 뷰포트 상단을 지나간 거리
      const scrollDistance = -containerRect.top;
      
      // 최대 스크롤 가능 거리
      const maxScroll = containerRect.height - windowHeight;

      if (maxScroll <= 0) return 0;

      // 0~1 사이의 진행도로 정규화
      const progress = Math.max(0, Math.min(1, scrollDistance / maxScroll));
      
      return progress;
    };

    // 1. 스크롤 이벤트 리스너 (데스크톱용)
    const handleScroll = () => {
      const progress = calculateScrollProgress();
      
      if (Number.isNaN(video.duration) || video.duration === 0) return;

      // 목표 재생 시간 업데이트
      targetTimeRef.current = progress * video.duration;
    };

    // 2. 터치 이벤트 리스너 (모바일용 - 스크롤 중에도 계속 업데이트)
    const handleTouchMove = () => {
      handleScroll();
    };

    // 3. Intersection Observer (모바일에서 컨테이너가 뷰포트에 들어올 때 감지)
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // 뷰포트에 보일 때 스크롤 위치 업데이트
            handleScroll();
          }
        });
      },
      {
        threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
        rootMargin: '0px'
      }
    );

    observer.observe(container);

    // 이벤트 리스너 등록
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    // 모바일에서 스크롤 종료 후에도 업데이트
    window.addEventListener('touchend', handleScroll, { passive: true });

    // 4. Render Loop (RequestAnimationFrame)
    // 모바일에서도 안정적으로 작동하도록 requestAnimationFrame에서 직접 스크롤 위치 확인
    let animationFrameId: number;
    let lastProgress = -1;

    const renderLoop = () => {
      if (video && container) {
        // 모바일 대응: requestAnimationFrame 루프에서도 직접 스크롤 위치 확인
        // 이렇게 하면 스크롤 이벤트가 throttling되어도 계속 업데이트됨
        const currentProgress = calculateScrollProgress();
        
        // 진행도가 변경되었을 때만 목표 시간 업데이트
        if (Math.abs(currentProgress - lastProgress) > 0.001) {
          if (!Number.isNaN(video.duration) && video.duration > 0) {
            targetTimeRef.current = currentProgress * video.duration;
            lastProgress = currentProgress;
          }
        }

        // Easing factor: 부드러운 전환을 위한 값
        const easing = 0.15; 
        
        // 현재 시간과 목표 시간의 차이 계산
        const diff = targetTimeRef.current - video.currentTime;
        
        // 차이가 충분히 클 때만 업데이트 (시각적으로 의미있는 차이)
        if (Math.abs(diff) > 0.01) {
          // CRITICAL: Seeking Guard
          // 비디오가 현재 프레임을 디코딩 중이면 업데이트를 건너뛰어 끊김 방지
          if (!video.seeking) {
            video.currentTime += diff * easing;
          }
        }
      }

      animationFrameId = requestAnimationFrame(renderLoop);
    };

    // 렌더링 루프 시작
    renderLoop();

    // 초기 스크롤 위치 계산
    handleScroll();

    // 클린업 함수
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleScroll);
      observer.disconnect();
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div 
      ref={containerRef} 
      className="relative w-full bg-slate-50"
      style={{ height: scrollLength }}
    >
      {/* Sticky wrapper to keep video fixed while container scrolls */}
      <div className="sticky top-0 left-0 h-screen w-full overflow-hidden">
        
        {/* Loading State - Light Theme */}
        {isLoading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-50 text-amber-600">
            <Loader2 className="h-10 w-10 animate-spin" />
            <span className="ml-3 font-serif text-lg tracking-widest text-slate-800">이야기 로딩 중...</span>
          </div>
        )}

        <video
          ref={videoRef}
          src={src}
          className="absolute inset-0 h-full w-full object-cover"
          preload="auto"
          muted
          playsInline
          onLoadedMetadata={handleLoadedMetadata}
        />
        
        {/* Optional light overlay to ensure dark text pops if video is very dark, 
            or keep transparent to see video clearly. 
            Removed dark overlay for white theme request. 
        */}
      </div>

      {/* Content Overlay passed as children */}
      <div className="absolute top-0 left-0 w-full h-full z-10 pointer-events-none">
        {children}
      </div>
    </div>
  );
};