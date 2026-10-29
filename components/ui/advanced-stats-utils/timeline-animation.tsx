'use client'

import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { cn } from '@/lib/utils'

type TimelineAnimationProps = {
  animationNum: number
  timelineRef: RefObject<HTMLDivElement | null>
  className?: string
  children: ReactNode
}

export function TimelineAnimation({ animationNum, className, children }: TimelineAnimationProps) {
  const elementRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const element = elementRef.current
    if (!element) return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true)
        observer.disconnect()
      }
    }, { threshold: 0.08 })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={elementRef}
      className={cn('transition-[opacity,transform] duration-700 ease-out motion-reduce:transition-none', visible ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0', className)}
      style={{ transitionDelay: `${Math.min(animationNum * 60, 360)}ms` }}
    >
      {children}
    </div>
  )
}
