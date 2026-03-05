type DiscoverySeed = {
  companyName: string;
  signalType: string;
  signalSummary: string;
};

const seedCompanies: DiscoverySeed[] = [
  {
    companyName: "Summit Medical Supplies",
    signalType: "hiring",
    signalSummary: "Hiring multiple logistics coordinators after regional expansion.",
  },
  {
    companyName: "BlueLine Distribution Group",
    signalType: "expansion",
    signalSummary: "Announced new distribution center launch and route growth plans.",
  },
  {
    companyName: "RapidLab Networks",
    signalType: "contract",
    signalSummary: "Won a multi-site service contract requiring recurring deliveries.",
  },
  {
    companyName: "Prime Facility Services",
    signalType: "operations",
    signalSummary: "Publicly shared same-day service goals for field operations.",
  },
];

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function buildLeadCandidates(query: string, state?: string | null, region?: string | null) {
  const querySlug = slugify(query).slice(0, 40) || "lead";

  return seedCompanies.map((seed, index) => {
    const companySlug = slugify(seed.companyName);
    return {
      companyName: seed.companyName,
      website: `https://${companySlug}.com`,
      state: state || null,
      region: region || null,
      signalType: seed.signalType,
      signalSummary: `${seed.signalSummary} Search theme: "${query}".`,
      sourceUrl: `https://example.com/news/${querySlug}/${index + 1}`,
      sourcePublishedAt: new Date(Date.now() - index * 86_400_000),
      confidenceScore: Math.max(0.55, 0.87 - index * 0.07),
      dedupeKey: `${companySlug}:${state || "na"}:${region || "na"}`,
      notes: "Auto-generated discovery candidate. Replace with live provider integration.",
    };
  });
}
