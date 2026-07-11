import { Link, useLocation } from "wouter";
import { Bookmark, Compass, Home, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/tutoros", label: "Home", icon: Home, match: (path: string) => path === "/tutoros" },
  {
    href: "/tutoros/explore",
    label: "Explore",
    icon: Compass,
    match: (path: string) =>
      path.startsWith("/tutoros/explore") ||
      path.startsWith("/tutoros/subjects") ||
      path.startsWith("/tutoros/courses"),
  },
  {
    href: "/tutoros/bookmarks",
    label: "Bookmarks",
    icon: Bookmark,
    match: (path: string) => path.startsWith("/tutoros/bookmarks"),
  },
] as const;

export function TutorOsShell({
  children,
  showBottomNav = true,
}: {
  children: React.ReactNode;
  showBottomNav?: boolean;
}) {
  const [location] = useLocation();

  return (
    <div className="tutoros-shell min-h-[100dvh] bg-white text-slate-900 flex flex-col">
      <div className={cn("flex-1 w-full mx-auto max-w-lg", showBottomNav && "pb-24")}>
        {children}
      </div>

      {showBottomNav && (
        <nav
          className="fixed bottom-0 inset-x-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur"
          aria-label="TutorOS"
        >
          <div className="mx-auto max-w-lg grid grid-cols-4 h-16">
            {tabs.map((tab) => {
              const active = tab.match(location);
              const Icon = tab.icon;
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={cn(
                    "flex flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors",
                    active ? "text-[#1865F2]" : "text-slate-500 hover:text-slate-800",
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon className={cn("h-5 w-5", active && "stroke-[2.4]")} />
                  {tab.label}
                </Link>
              );
            })}
            <Link
              href="/dashboard"
              className="flex flex-col items-center justify-center gap-0.5 text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors"
            >
              <Settings className="h-5 w-5" />
              Hours
            </Link>
          </div>
        </nav>
      )}
    </div>
  );
}

export function TutorOsHeader({
  title,
  right,
  onBack,
}: {
  title?: string;
  right?: React.ReactNode;
  onBack?: () => void;
}) {
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-slate-100 bg-white/95 px-3 backdrop-blur">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[#1865F2] hover:bg-blue-50"
          aria-label="Go back"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      ) : (
        <div className="w-2" />
      )}
      {title ? (
        <h1 className="flex-1 truncate text-lg font-semibold tracking-tight text-slate-900">{title}</h1>
      ) : (
        <div className="flex-1" />
      )}
      {right ?? <div className="w-10" />}
    </header>
  );
}

export function PrimaryButton({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex w-full items-center justify-center rounded-full bg-[#1865F2] px-6 py-3.5 text-base font-semibold text-white shadow-sm transition hover:bg-[#1557d0] disabled:opacity-60",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
