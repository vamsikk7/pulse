import Link from "next/link";
import { Activity, Settings, ListChecks } from "lucide-react";
import { ClerkUserButton } from "@/components/ClerkUserButton";
import { Footer } from "@/components/Footer";

const ADMIN_URL = process.env.NEXT_PUBLIC_API_URL
  ? `${process.env.NEXT_PUBLIC_API_URL}/admin/queues`
  : "http://localhost:4000/admin/queues";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-gray-25">
      <header className="border-b border-gray-100 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600 text-white">
              <Activity className="h-4 w-4" />
            </span>
            <span className="text-sm font-semibold tracking-tight text-gray-900">
              Pulse
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <a
              href={ADMIN_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
              title="Queues admin (Bull Board)"
              aria-label="Queues admin"
            >
              <ListChecks className="h-4 w-4" />
            </a>
            <Link
              href="/app/settings"
              className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
              title="Settings"
              aria-label="Settings"
            >
              <Settings className="h-4 w-4" />
            </Link>
            <ClerkUserButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        {children}
      </main>
      <Footer />
    </div>
  );
}
