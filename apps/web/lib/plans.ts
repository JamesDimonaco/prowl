export interface Plan {
  name: string;
  price: number;
  period: "forever" | "month";
  popular?: boolean;
  description: string;
  features: string[];
}

export const PLANS: Plan[] = [
  {
    name: "Free",
    price: 0,
    period: "forever",
    description: "Get started with basic monitoring",
    features: [
      "3 monitors",
      "6 hour check interval",
      "Email notifications",
      "AI-powered extraction",
      "Change detection",
    ],
  },
  {
    name: "Pro",
    price: 9,
    period: "month",
    popular: true,
    description: "For power users who need faster checks",
    features: [
      "25 monitors",
      "15 minute check interval",
      "Email, Telegram & Discord",
      "Priority scraping",
      "AI-powered extraction",
      "Change detection",
    ],
  },
  {
    name: "Max",
    price: 29,
    period: "month",
    description: "Unlimited monitoring with API access",
    features: [
      "Unlimited monitors",
      "5 minute check interval",
      "All notification channels",
      "Webhook notifications",
      "API access",
      "Priority scraping",
      "AI-powered extraction",
      "Change detection",
    ],
  },
];

/** Build Schema.org Offer objects from plans */
export function buildOffersJsonLd() {
  return PLANS.map((plan) => ({
    "@type": "Offer" as const,
    name: plan.name,
    price: String(plan.price),
    priceCurrency: "USD",
    description: plan.description,
    priceSpecification: {
      "@type": "UnitPriceSpecification" as const,
      price: String(plan.price),
      priceCurrency: "USD",
      unitCode: "MON",
      ...(plan.period !== "forever" && { billingDuration: "P1M" }),
    },
  }));
}
