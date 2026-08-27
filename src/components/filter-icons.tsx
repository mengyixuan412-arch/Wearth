const BASE = { width: 15, height: 15, viewBox: "0 0 24 24", fill: "none", "aria-hidden": true } as const;

/** Season — a sun over a horizon. */
export const SeasonIcon = () => (
  <svg {...BASE}>
    <circle cx="12" cy="10" r="3.6" stroke="currentColor" strokeWidth="1.7" />
    <path d="M12 3v1.6M12 15.4V17M5 10H3.4M20.6 10H19M7 5l1.1 1.1M15.9 13.9 17 15M17 5l-1.1 1.1M8.1 13.9 7 15M4 20h16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);

/** Colour — a painter's palette. */
export const ColorIcon = () => (
  <svg {...BASE}>
    <path d="M12 3a9 9 0 1 0 0 18c1.2 0 1.8-.9 1.8-1.8 0-1.5 1-2.2 2.4-2.2H18a3.5 3.5 0 0 0 3.5-3.5C21.5 7.4 17.4 3 12 3Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    <circle cx="7.8" cy="11" r="1.1" fill="currentColor" />
    <circle cx="11" cy="7.4" r="1.1" fill="currentColor" />
    <circle cx="15.4" cy="8.6" r="1.1" fill="currentColor" />
  </svg>
);

/** Brand — a price tag. */
export const BrandIcon = () => (
  <svg {...BASE}>
    <path d="M11.2 3.4 3.8 10.8a2 2 0 0 0 0 2.8l6.6 6.6a2 2 0 0 0 2.8 0l7.4-7.4V3.4h-9.4Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    <circle cx="16.6" cy="7.4" r="1.4" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

/** Status — a circle with a check. */
export const StatusIcon = () => (
  <svg {...BASE}>
    <circle cx="12" cy="12" r="8.6" stroke="currentColor" strokeWidth="1.7" />
    <path d="m8.4 12.2 2.5 2.4 4.7-4.9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Sort — descending bars. */
export const SortIcon = () => (
  <svg {...BASE}>
    <path d="M4 6h14M4 12h9M4 18h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

/** Search — a magnifier. */
export const SearchIcon = () => (
  <svg {...BASE}>
    <circle cx="10.6" cy="10.6" r="6.4" stroke="currentColor" strokeWidth="1.8" />
    <path d="m15.4 15.4 4.2 4.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);
