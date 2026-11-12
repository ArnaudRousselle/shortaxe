import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement>

function Base({ children, className = 'h-5 w-5', ...rest }: P) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  )
}

export const IconHome = (p: P) => (
  <Base {...p}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /></Base>
)
export const IconList = (p: P) => (
  <Base {...p}><path d="M8 6h13M8 12h13M8 18h13" /><circle cx="4" cy="6" r="1" /><circle cx="4" cy="12" r="1" /><circle cx="4" cy="18" r="1" /></Base>
)
export const IconTarget = (p: P) => (
  <Base {...p}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></Base>
)
export const IconChart = (p: P) => (
  <Base {...p}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></Base>
)
export const IconSettings = (p: P) => (
  <Base {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></Base>
)
export const IconWallet = (p: P) => (
  <Base {...p}><rect x="3" y="6" width="18" height="14" rx="2" /><path d="M3 10h18M16 15h2" /><path d="M6 6V5a2 2 0 0 1 2-2h9" /></Base>
)
export const IconTag = (p: P) => (
  <Base {...p}><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z" /><circle cx="7.5" cy="7.5" r="1" /></Base>
)
export const IconPlus = (p: P) => (
  <Base {...p}><path d="M12 5v14M5 12h14" /></Base>
)
export const IconX = (p: P) => (
  <Base {...p}><path d="M18 6 6 18M6 6l12 12" /></Base>
)
export const IconChevronLeft = (p: P) => (
  <Base {...p}><path d="m15 18-6-6 6-6" /></Base>
)
export const IconChevronRight = (p: P) => (
  <Base {...p}><path d="m9 18 6-6-6-6" /></Base>
)
export const IconDownload = (p: P) => (
  <Base {...p}><path d="M12 3v12M7 10l5 5 5-5M4 21h16" /></Base>
)
export const IconLogout = (p: P) => (
  <Base {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></Base>
)
export const IconCheck = (p: P) => (
  <Base {...p}><path d="M20 6 9 17l-5-5" /></Base>
)
export const IconTrash = (p: P) => (
  <Base {...p}><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></Base>
)
export const IconSearch = (p: P) => (
  <Base {...p}><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></Base>
)
export const IconCalendar = (p: P) => (
  <Base {...p}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /><path d="m9 15 2 2 4-4" /></Base>
)
export const IconTrend = (p: P) => (
  <Base {...p}><path d="M3 17l6-6 4 4 8-8" /><path d="M15 7h6v6" /></Base>
)
export const IconRepeat = (p: P) => (
  <Base {...p}><path d="m17 2 4 4-4 4" /><path d="M3 11v-1a4 4 0 0 1 4-4h14" /><path d="m7 22-4-4 4-4" /><path d="M21 13v1a4 4 0 0 1-4 4H3" /></Base>
)
