import { AlertCircle } from "lucide-react";

export function CriterionPreview() {
  const data = [
    {
      title: "Membership in associations",
      strength: "Borderline" as const,
      summary:
        "Elected to a student-council membership through a competitive nomination.",
      critique:
        "USCIS may question whether the parent association itself requires outstanding achievement.",
    },
    {
      title: "Original contributions of major significance",
      strength: "Looks strong" as const,
      summary:
        "A novel technique that meaningfully reduces memory use, documented with independent expert letters.",
      critique:
        "One recommender appears to be a former co-author — adjudicators look for independent voices.",
    },
  ];

  return (
    <div className="grid gap-2.5 sm:grid-cols-2">
      {data.map((d) => (
        <div key={d.title} className="card border-gray-200 p-3.5">
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-semibold leading-4 text-gray-900">
              {d.title}
            </p>
            <span
              className={`pill shrink-0 ${
                d.strength === "Looks strong"
                  ? "border border-success-200 bg-success-50 text-success-700"
                  : "border border-warning-200 bg-warning-50 text-warning-700"
              }`}
            >
              {d.strength}
            </span>
          </div>
          <p className="mt-2 text-xs leading-5 text-gray-700">{d.summary}</p>
          <p className="mt-1.5 flex gap-1 text-[11px] leading-5 text-gray-500">
            <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
            <span>{d.critique}</span>
          </p>
        </div>
      ))}
    </div>
  );
}
