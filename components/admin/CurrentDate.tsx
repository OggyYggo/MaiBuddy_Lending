'use client'

export function CurrentDate() {
  return (
    <span className="text-sm text-gray-600">
      {new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })}
    </span>
  )
}
