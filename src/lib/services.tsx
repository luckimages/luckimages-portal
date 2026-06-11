export const SERVICES = [
  {
    name: "Listing Photos",
    slug: "listing-photos",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
        <circle cx="12" cy="13" r="4" />
      </svg>
    ),
  },
  {
    name: "Video",
    slug: "video",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <polygon points="23 7 16 12 23 17 23 7" />
        <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
      </svg>
    ),
  },
  {
    name: "Twilight",
    slug: "twilight",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        {/* horizon line */}
        <line x1="2" y1="17" x2="22" y2="17" />
        {/* half sun above horizon */}
        <path d="M12 17 A5 5 0 0 1 7 17 A5 5 0 0 1 17 17" />
        {/* rays */}
        <line x1="12" y1="9" x2="12" y2="7" />
        <line x1="6.5" y1="11.5" x2="5" y2="10" />
        <line x1="17.5" y1="11.5" x2="19" y2="10" />
        <line x1="4.5" y1="17" x2="2.5" y2="17" />
        <line x1="19.5" y1="17" x2="21.5" y2="17" />
      </svg>
    ),
  },
  {
    name: "Drone",
    slug: "drone",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        {/* body */}
        <rect x="8" y="9" width="8" height="5" rx="1" />
        {/* arms */}
        <line x1="8" y1="10" x2="3" y2="7" />
        <line x1="16" y1="10" x2="21" y2="7" />
        <line x1="8" y1="13" x2="3" y2="16" />
        <line x1="16" y1="13" x2="21" y2="16" />
        {/* rotors */}
        <line x1="1" y1="7" x2="5" y2="7" />
        <line x1="19" y1="7" x2="23" y2="7" />
        <line x1="1" y1="16" x2="5" y2="16" />
        <line x1="19" y1="16" x2="23" y2="16" />
        {/* camera pod */}
        <circle cx="12" cy="15" r="1" />
      </svg>
    ),
  },
  {
    name: "Matterport",
    slug: "matterport",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <circle cx="12" cy="12" r="10" />
        <path d="M2 12 C6 7, 18 7, 22 12" />
        <path d="M2 12 C6 17, 18 17, 22 12" />
        <line x1="12" y1="2" x2="12" y2="22" />
        <path d="M19 5 L21 3" markerEnd="url(#arr)" />
        <polyline points="17,4 19,5 18,7" />
      </svg>
    ),
  },
  {
    name: "Virtual Staging",
    slug: "virtual-staging",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        {/* sofa base */}
        <rect x="3" y="11" width="18" height="7" rx="1" />
        {/* sofa back */}
        <rect x="5" y="7" width="14" height="5" rx="1" />
        {/* left arm */}
        <rect x="2" y="10" width="3" height="6" rx="1" />
        {/* right arm */}
        <rect x="19" y="10" width="3" height="6" rx="1" />
        {/* legs */}
        <line x1="6" y1="18" x2="6" y2="21" />
        <line x1="18" y1="18" x2="18" y2="21" />
      </svg>
    ),
  },
  {
    name: "Floorplans",
    slug: "floorplans",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        {/* compass legs meeting at top pivot */}
        <line x1="12" y1="3" x2="7" y2="19" />
        <line x1="12" y1="3" x2="17" y2="19" />
        {/* crossbar */}
        <line x1="8.5" y1="11" x2="15.5" y2="11" />
        {/* needle tips */}
        <circle cx="7" cy="19.5" r="0.8" fill="currentColor" stroke="none" />
        <circle cx="17" cy="19.5" r="0.8" fill="currentColor" stroke="none" />
        {/* pivot point */}
        <circle cx="12" cy="3" r="1" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    name: "Brochures",
    slug: "brochures",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        {/* page with dog-ear */}
        <path d="M14 2 H6 a2 2 0 0 0-2 2 v16 a2 2 0 0 0 2 2 h12 a2 2 0 0 0 2-2 V8 Z" />
        {/* dog-ear fold */}
        <polyline points="14 2 14 8 20 8" />
        {/* lines suggesting content */}
        <line x1="8" y1="13" x2="16" y2="13" />
        <line x1="8" y1="17" x2="13" y2="17" />
      </svg>
    ),
  },
];
