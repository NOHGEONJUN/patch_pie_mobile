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

    // 모바일 브라우저 호환성을 위한 추가 속성 설정
    // iOS Safari와 Android Chrome에서 인라인 재생을 보장
    if (video) {
      (video as any).webkitPlaysInline = true;
      (video as any).playsInline = true;
      // Android WebView (특히 WeChat 등) 지원
      (video as any).setAttribute('x5-playsinline', 'true');
      (video as any).setAttribute('webkit-playsinline', 'true');
    }

    // 컨테이너의 시작 위치를 저장 (한 번만 계산)
    const containerStartTop = container.offsetTop;
    const containerHeight = container.offsetHeight;
    
    // 스크롤 위치를 계산하는 함수 (모바일/데스크톱 모두 대응)
    // 모바일에서 getBoundingClientRect()가 제대로 업데이트되지 않을 수 있으므로
    // window.scrollY를 직접 사용하는 방식으로 변경
    const calculateScrollProgress = () => {
      // window.scrollY를 직접 사용 (모바일에서 더 정확함)
      const scrollY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;
      const windowHeight = window.innerHeight || document.documentElement.clientHeight;
      
      // 컨테이너가 뷰포트에 들어오기 시작한 시점부터의 스크롤 거리
      const scrollDistance = Math.max(0, scrollY - containerStartTop);
      
      // 최대 스크롤 가능 거리 (컨테이너 높이 - 뷰포트 높이)
      const maxScroll = Math.max(0, containerHeight - windowHeight);

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
    let lastUpdateTime = 0;

    const renderLoop = (currentTime: number) => {
      if (video && container) {
        // 비디오가 준비되었는지 확인 (모바일에서 중요)
        // readyState 2 (HAVE_CURRENT_DATA) 이상이어야 currentTime 설정 가능
        if (video.readyState < 2) {
          animationFrameId = requestAnimationFrame(renderLoop);
          return;
        }

        // 모바일 대응: requestAnimationFrame 루프에서 직접 스크롤 위치 확인
        // 이렇게 하면 스크롤 이벤트가 throttling되어도 계속 업데이트됨
        const currentProgress = calculateScrollProgress();
        
        // 진행도가 변경되었을 때만 목표 시간 업데이트
        // 모바일에서 더 민감하게 반응하도록 threshold를 낮춤
        if (Math.abs(currentProgress - lastProgress) > 0.0001) {
          if (!Number.isNaN(video.duration) && video.duration > 0) {
            targetTimeRef.current = currentProgress * video.duration;
            lastProgress = currentProgress;
          }
        }

        // Easing factor: 부드러운 전환을 위한 값
        // 모바일에서 더 빠르게 반응하도록 easing 증가
        const easing = 0.2; 
        
        // 현재 시간과 목표 시간의 차이 계산
        const diff = targetTimeRef.current - video.currentTime;
        
        // 차이가 충분히 클 때만 업데이트 (시각적으로 의미있는 차이)
        // 모바일에서 더 민감하게 반응하도록 threshold를 낮춤
        if (Math.abs(diff) > 0.005) {
          // CRITICAL: Seeking Guard
          // 비디오가 현재 프레임을 디코딩 중이면 업데이트를 건너뛰어 끊김 방지
          if (!video.seeking) {
            try {
              video.currentTime += diff * easing;
            } catch (e) {
              // 모바일에서 currentTime 설정이 실패할 수 있으므로 에러 처리
              console.warn('Video currentTime update failed:', e);
            }
          }
        }
      }

      animationFrameId = requestAnimationFrame(renderLoop);
    };

    // 렌더링 루프 시작 (requestAnimationFrame은 자동으로 timestamp를 전달)
    animationFrameId = requestAnimationFrame(renderLoop);

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