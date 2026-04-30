type IconName =
  | "dashboard"
  | "members"
  | "attendance"
  | "events"
  | "settings"
  | "search"
  | "notifications"
  | "help"
  | "logout"
  | "quick-attendance"
  | "view-attendance"
  | "reports"
  | "newcomer"
  | "plus-user";

type IconProps = {
  name: IconName;
  className?: string;
  filled?: boolean;
};

export function Icon({ name, className = "h-5 w-5", filled = false }: IconProps) {
  const strokeWidth = 1.8;

  switch (name) {
    case "dashboard":
      return (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill={filled ? "currentColor" : "none"}
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={strokeWidth}
          className={className}
        >
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
      );

    case "members":
      return (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={strokeWidth}
          className={className}
        >
          <path d="M8 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
          <path d="M16 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
          <path d="M3.75 20c.4-3.08 2.76-5.25 6.25-5.25S15.85 16.92 16.25 20" />
          <path d="M12.75 20c.29-2.27 1.88-3.93 4.25-4.62" />
        </svg>
      );

    case "attendance":
    case "quick-attendance":
      return (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill={filled ? "currentColor" : "none"}
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={strokeWidth}
          className={className}
        >
          <circle cx="12" cy="12" r="8" />
          <path d="m8.5 12.2 2.5 2.5 4.75-4.7" stroke={filled ? "#ffffff" : "currentColor"} />
        </svg>
      );

    case "events":
      return (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={strokeWidth}
          className={className}
        >
          <rect x="4" y="5" width="16" height="15" rx="2" />
          <path d="M8 3v4" />
          <path d="M16 3v4" />
          <path d="M4 9h16" />
        </svg>
      );

    case "settings":
      return (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={strokeWidth}
          className={className}
        >
          <path d="M10.2 4.9h3.6l.5 2a6.8 6.8 0 0 1 1.4.8l1.9-.7 1.8 3.1-1.6 1.3c.1.3.1.6.1.9s0 .6-.1.9l1.6 1.3-1.8 3.1-1.9-.7a6.8 6.8 0 0 1-1.4.8l-.5 2h-3.6l-.5-2a6.8 6.8 0 0 1-1.4-.8l-1.9.7-1.8-3.1 1.6-1.3A5 5 0 0 1 6 12c0-.3 0-.6.1-.9L4.5 9.8l1.8-3.1 1.9.7a6.8 6.8 0 0 1 1.4-.8l.5-2Z" />
          <circle cx="12" cy="12" r="2.5" />
        </svg>
      );

    case "search":
      return (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={strokeWidth}
          className={className}
        >
          <circle cx="11" cy="11" r="6.5" />
          <path d="m16 16 4 4" />
        </svg>
      );

    case "notifications":
      return (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={strokeWidth}
          className={className}
        >
          <path d="M14.8 17.5a3 3 0 0 1-5.6 0" />
          <path d="M6.5 16.5h11l-1.3-1.8V11a4.2 4.2 0 0 0-8.4 0v3.7Z" />
        </svg>
      );

    case "help":
      return (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={strokeWidth}
          className={className}
        >
          <circle cx="12" cy="12" r="8" />
          <path d="M9.7 9.3a2.4 2.4 0 1 1 3.4 2.2c-.9.4-1.4 1.1-1.4 2v.5" />
          <path d="M12 17.2h0" />
        </svg>
      );

    case "logout":
      return (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={strokeWidth}
          className={className}
        >
          <path d="M10 7V5.8a1.8 1.8 0 0 1 1.8-1.8h6.4A1.8 1.8 0 0 1 20 5.8v12.4a1.8 1.8 0 0 1-1.8 1.8h-6.4A1.8 1.8 0 0 1 10 18.2V17" />
          <path d="M4 12h10" />
          <path d="m7.5 8.5 3.5 3.5-3.5 3.5" />
        </svg>
      );

    case "view-attendance":
      return (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={strokeWidth}
          className={className}
        >
          <path d="M2.8 12s2.8-5.5 9.2-5.5S21.2 12 21.2 12s-2.8 5.5-9.2 5.5S2.8 12 2.8 12Z" />
          <circle cx="12" cy="12" r="2.6" />
        </svg>
      );

    case "reports":
      return (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={strokeWidth}
          className={className}
        >
          <path d="M5 19V9" />
          <path d="M10 19V5" />
          <path d="M15 19v-8" />
          <path d="M20 19H4" />
        </svg>
      );

    case "newcomer":
    case "plus-user":
      return (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={strokeWidth}
          className={className}
        >
          <path d="M10 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
          <path d="M4 20c.5-3 3-5 6-5" />
          <path d="M18 8v6" />
          <path d="M15 11h6" />
        </svg>
      );

    default:
      return (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={strokeWidth}
          className={className}
        >
          <circle cx="12" cy="12" r="8" />
        </svg>
      );
  }
}
