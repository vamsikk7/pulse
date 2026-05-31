import { User } from "lucide-react";

export function ClerkUserButton() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-600">
      <User className="h-3 w-3" />
      You
    </span>
  );
}
