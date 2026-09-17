import { Link } from 'react-router-dom'

/** Wordmark used in the sidebar and on mobile. */
export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <span className="bg-brand-600 flex size-8 items-center justify-center rounded-lg">
        <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden>
          <path
            d="M7 3v8a2 2 0 0 0 2 2v8a1.2 1.2 0 0 0 2.4 0v-8a2 2 0 0 0 2-2V3"
            stroke="#d5eff2"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path d="M10.2 3v5" stroke="#d5eff2" strokeWidth="1.8" strokeLinecap="round" />
          <path
            d="M17.4 3c1.5 1.2 1.8 4.3 0 5.8V21"
            stroke="#7bcad6"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </span>
      <span className="flex flex-col leading-none">
        <span className="text-[15px] font-semibold tracking-tight text-white">Mise</span>
        <span className="text-sidebar-fg-muted text-[10.5px] font-medium tracking-wide uppercase">
          Restaurant ops
        </span>
      </span>
    </Link>
  )
}
