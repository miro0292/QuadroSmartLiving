function BrandLogo({ className = '', compact = false }) {
  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      <svg
        viewBox="0 0 96 96"
        role="img"
        aria-label="Logo Quadro Smart Living"
        className={`${compact ? 'h-10 w-10' : 'h-14 w-14'} text-brand-500`}
      >
        <rect x="10" y="10" width="76" height="76" fill="none" stroke="currentColor" strokeWidth="4" />
        <rect x="20" y="20" width="56" height="56" fill="none" stroke="currentColor" strokeWidth="4" />
        <rect x="30" y="30" width="36" height="36" fill="none" stroke="currentColor" strokeWidth="4" />
        <rect x="40" y="40" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="4" />
      </svg>

      <div className="leading-tight">
        <p className="brand-title text-lg font-semibold text-zinc-900 dark:text-white">QUADRO</p>
        <p className="brand-title text-[10px] font-medium text-brand-500">SMARTLIVING</p>
      </div>
    </div>
  )
}

export default BrandLogo
