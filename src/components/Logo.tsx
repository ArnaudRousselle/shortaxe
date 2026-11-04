export function Logo({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="#0f766e" />
      <path
        d="M42 20c-2.5-2.6-6.2-4-10.2-4-6.4 0-11 3.4-11 8.4 0 11 21.6 6.6 21.6 15.6 0 3.6-3.6 6-9 6-4.4 0-8.2-1.6-10.8-4.4"
        fill="none"
        stroke="#fff"
        strokeWidth="5.5"
        strokeLinecap="round"
      />
    </svg>
  )
}
