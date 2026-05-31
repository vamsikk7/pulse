import { Activity, ShieldCheck, AlertTriangle, Lock } from "lucide-react";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-gray-100 bg-gray-25">
      <div className="mx-auto max-w-7xl px-6 py-12">
        {/* Top — brand + tagline */}
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600 text-white">
            <Activity className="h-4 w-4" />
          </span>
          <span className="text-base font-semibold tracking-tight text-gray-900">
            Pulse
          </span>
        </div>
        <p className="mt-2 max-w-xl text-sm text-gray-600">
          A petition review and USCIS case-tracking tool for applicants and
          immigration teams.
        </p>

        {/* Disclaimer panels */}
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <DisclaimerCard
            icon={<ShieldCheck className="h-4 w-4" />}
            title="Not legal advice"
            body="Pulse is a software tool, not a law firm. Its review is informational only and does not create an attorney-client relationship. Always consult a licensed immigration attorney before filing."
          />
          <DisclaimerCard
            icon={<AlertTriangle className="h-4 w-4" />}
            title="Not affiliated with USCIS"
            body="Pulse is independent. It is not endorsed by or affiliated with U.S. Citizenship and Immigration Services, the Department of Homeland Security, or any government agency."
          />
          <DisclaimerCard
            icon={<AlertTriangle className="h-4 w-4" />}
            title="No guarantee of outcome"
            body="The risk score is an estimate based on common adjudication patterns. It does not guarantee approval, denial, or any specific USCIS action on your case."
          />
          <DisclaimerCard
            icon={<Lock className="h-4 w-4" />}
            title="Your data stays put"
            body="Petition files are processed on this machine. Nothing is sent to a third-party AI service or stored externally."
          />
        </div>

        {/* Notice strip */}
        <div className="mt-10 rounded-2xl border border-gray-200 bg-white px-5 py-4 text-xs leading-6 text-gray-600">
          <p>
            <strong className="font-semibold text-gray-900">A note on case status data: </strong>
            Pulse pulls case status directly from USCIS when possible. If USCIS
            is temporarily unreachable, Pulse may show representative sample
            data, clearly labeled <em>Sample data</em>. Always confirm important
            details with USCIS directly or your attorney.
          </p>
        </div>

        {/* Bottom */}
        <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-gray-100 pt-6 text-xs text-gray-500 sm:flex-row sm:items-center">
          <p>&copy; {year} Pulse. All rights reserved.</p>
          <p>
            Immigration is a serious matter. If something on this site is
            unclear, please contact a licensed attorney.
          </p>
        </div>
      </div>
    </footer>
  );
}

function DisclaimerCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
          {icon}
        </span>
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      </div>
      <p className="mt-2 text-xs leading-5 text-gray-600">{body}</p>
    </div>
  );
}
