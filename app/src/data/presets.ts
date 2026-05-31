/**
 * Typed asset presets for the three verticals.
 *
 * `parameters` feed the deterministic finance engine. `seed` holds curated
 * debate/advisory content used as (a) the offline demo when no API key is set
 * and (b) the reference baseline for the eval harness. When a key is present,
 * the live AI layer replaces `seed` at runtime.
 */

export type Vertical = "stocks" | "startups" | "conventional";

export interface AssetParameters {
  // Equities
  price?: number;
  eps?: number;
  pb?: number;
  roe?: number;
  discountRate?: number;
  terminalMult?: number;
  invested?: number;
  cashflows?: number[];
  // Ventures
  cash?: number;
  burn?: number;
  cac?: number;
  arpu?: number;
  margin?: number;
  churn?: number;
  // Operating / conventional
  fixed?: number;
  variable?: number;
}

export interface DebateLine {
  agent: string;
  text: string;
}

export interface AdvisoryLens {
  title: string;
  text: string;
}

export interface AssetSeed {
  confidence: number;
  bull: DebateLine[];
  bear: DebateLine[];
  advisory: {
    operator: AdvisoryLens;
    risk: AdvisoryLens;
    predator: AdvisoryLens;
  };
}

export interface AssetPreset {
  id: string;
  name: string;
  vertical: Vertical;
  parameters: AssetParameters;
  seed: AssetSeed;
}

export const PRESETS: Record<Vertical, AssetPreset[]> = {
  stocks: [
    {
      id: "bbca",
      name: "PT Bank Central Asia Tbk (BBCA)",
      vertical: "stocks",
      parameters: {
        price: 9200,
        eps: 680,
        pb: 4.8,
        roe: 22.5,
        discountRate: 0.1,
        terminalMult: 15,
        invested: 8500,
        cashflows: [600, 680, 780, 890, 1020],
      },
      seed: {
        confidence: 85,
        bull: [
          { agent: "Growth Lead", text: "An 80% CASA ratio gives an extremely low cost of funds, shielding it from Bank Indonesia rate hikes." },
          { agent: "Technologist", text: "The myBCA app and e-channel banking process billions of daily transactions, securing stable fee-based income." },
          { agent: "Asset Allocator", text: "NPL (Non-Performing Loan) is held at 1.9%, far below the national banking industry average." },
        ],
        bear: [
          { agent: "Valuation Bear", text: "A P/B ratio near 4.8x is already very premium (priced-in) versus other SEA regional banks." },
          { agent: "Macro Adversary", text: "If Indonesian GDP growth slows below 5.0%, corporate credit expansion will weaken." },
          { agent: "Risk Skeptic", text: "Fierce competition from new digital banks and fintech lending could erode its retail CASA share over the long run." },
        ],
        advisory: {
          operator: { title: "Operator — Moat & Efficiency", text: "BCA's digitalization SOP is the industry gold standard. The Operator play is to scale cloud infrastructure to cut conventional IT maintenance, and to patent the internal credit-scoring algorithm for retail lending to drive down approval cost." },
          risk: { title: "Risk Manager — Stress-Test & Survival", text: "Stress-test scenario: if rates rise to 7%, corporate NPL is projected to climb to 3.5%. Mitigation: shift more liquidity into short-tenor government bonds (SBN) and reduce credit exposure to volatile commodity sectors." },
          predator: { title: "Predator — Opportunism & Fat Pitch", text: "A Fat Pitch appears if an irrational market correction drags BBCA to P/B < 3.8x (~Rp 7,500–8,000). Swing capital aggressively here: historically BBCA valuation always reverts to its ~4.5x P/B mean within 6–9 months." },
        },
      },
    },
    {
      id: "tlkm",
      name: "PT Telkom Indonesia Tbk (TLKM)",
      vertical: "stocks",
      parameters: {
        price: 3400,
        eps: 250,
        pb: 2.8,
        roe: 16.2,
        discountRate: 0.12,
        terminalMult: 10,
        invested: 3800,
        cashflows: [230, 250, 270, 290, 310],
      },
      seed: {
        confidence: 68,
        bull: [
          { agent: "Infras Lead", text: "The largest national fiber-optic infrastructure plus tower ownership via Mitratel guarantees connectivity-market dominance." },
          { agent: "Cloud Architect", text: "The NeutraDC data-center business is growing fast as cloud-computing adoption by SOEs & enterprises rises." },
        ],
        bear: [
          { agent: "Yield Skeptic", text: "Data tariffs (yield per GB) keep falling due to a telco price war that never ends." },
          { agent: "Legacy Bear", text: "Heavy employee pension liabilities and fiber-optic CapEx cap the dividend payout ratio." },
        ],
        advisory: {
          operator: { title: "Operator — Moat & Efficiency", text: "Focus on infrastructure consolidation (FMC — Fixed Mobile Convergence) between Telkomsel and IndiHome to eliminate duplicate field sales & technician teams, cutting OpEx by up to 15%." },
          risk: { title: "Risk Manager — Stress-Test & Survival", text: "A high-rate crisis could raise syndicated-debt costs. Limit non-productive fiber-optic expansion outside core urban areas and restructure USD-denominated debt into IDR." },
          predator: { title: "Predator — Opportunism & Fat Pitch", text: "Wait for an extreme-discount moment when foreign sell-offs drag TLKM below 10x P/E. That is a thick Margin of Safety for the long term." },
        },
      },
    },
  ],
  startups: [
    {
      id: "fintech-x",
      name: "PayGuard (Fintech Lending Series B)",
      vertical: "startups",
      parameters: { cash: 18_000_000_000, burn: 1_200_000_000, cac: 1_500_000, arpu: 450_000, margin: 0.7, churn: 0.04 },
      seed: {
        confidence: 75,
        bull: [
          { agent: "Risk Modeling", text: "The AI algorithm holds NPL (Non-Performing Loan) at 1.8%, far below the OJK 5% ceiling." },
          { agent: "BizDev Lead", text: "A partnership with a B2B e-commerce platform grew monthly loan volume by 35% organically." },
        ],
        bear: [
          { agent: "Liquidity Analyst", text: "Less than 15 months of runway remain, while capital-market liquidity for a Series C is in a Tech Winter." },
          { agent: "Regulatory Bear", text: "New OJK rules capping productive-loan interest rates will compress profit margins at the company." },
        ],
        advisory: {
          operator: { title: "Operator — Moat & Efficiency", text: "Automate credit assessment with a distributed-data model immediately. Reduce manual field-review staff to improve unit economics per loan disbursement." },
          risk: { title: "Risk Manager — Stress-Test & Survival", text: "Runway stress-test: monthly burn must drop 25% from Rp 1.2B to Rp 900M via a hiring freeze and cloud-server efficiency, extending runway to 20 months to secure the fundraising window." },
          predator: { title: "Predator — Opportunism & Fat Pitch", text: "Use the Tech Winter to acquire small fintech startups running out of runway at cheap valuations, integrating their merchant databases to accelerate market expansion." },
        },
      },
    },
    {
      id: "saas-builder",
      name: "Omni Retail SaaS",
      vertical: "startups",
      parameters: { cash: 8_000_000_000, burn: 450_000_000, cac: 600_000, arpu: 180_000, margin: 0.85, churn: 0.02 },
      seed: {
        confidence: 89,
        bull: [
          { agent: "Retention Advocate", text: "Very low churn at 2%/month signals strong product-market fit and high product stickiness." },
          { agent: "Unit Econ", text: "An LTV/CAC ratio of 4.25x proves very healthy marketing-budget conversion efficiency." },
        ],
        bear: [
          { agent: "TAM Critic", text: "The Indonesian retail SME market is highly price-sensitive; ARPU is hard to push above Rp 200k/month without spiking churn." },
          { agent: "Competitor Bear", text: "Many free POS systems are subsidized by e-wallet platforms chasing merchant volume." },
        ],
        advisory: {
          operator: { title: "Operator — Moat & Efficiency", text: "Add supply-chain integration (connecting stores to raw-material suppliers) to build an ecosystem moat that a plain free POS cannot replicate." },
          risk: { title: "Risk Manager — Stress-Test & Survival", text: "Offer discounted annual subscriptions to pull cash upfront, securing net cash flow earlier amid macro uncertainty." },
          predator: { title: "Predator — Opportunism & Fat Pitch", text: "Target large retail brands frustrated with expensive foreign enterprise software; offer custom migration on long-term contracts." },
        },
      },
    },
  ],
  conventional: [
    {
      id: "laundry-franchise",
      name: "SpinExpress (Coin Laundry, 10 Outlets)",
      vertical: "conventional",
      parameters: { fixed: 180_000_000, price: 45_000, variable: 12_000, invested: 350_000_000 },
      seed: {
        confidence: 79,
        bull: [
          { agent: "Cashflow Lead", text: "A cash-upfront business (coin/e-wallet) with no bad receivables. Working capital is very clean." },
          { agent: "Location Expert", text: "Lower-middle-class apartments whose units lack drying balconies guarantee >60% machine occupancy." },
        ],
        bear: [
          { agent: "CapEx Bear", text: "High-speed commercial washers depreciate fast; maintenance cost rises sharply after year 2." },
          { agent: "Utility Risk", text: "Sensitive to volatile hikes in base electricity tariffs and LPG (3kg/12kg) gas prices." },
        ],
        advisory: {
          operator: { title: "Operator — Moat & Efficiency", text: "Adopt an SOP for daily utility logging via IoT water & power meters to detect gas/water leaks faster. Integrate a machine-booking app to keep queues orderly." },
          risk: { title: "Risk Manager — Stress-Test & Survival", text: "Stress-test: if rent rises 30% and customers drop 20%, recompute the daily BEP. Mitigation: lock a long-term lease (min. 5 years) upfront with staggered rent-adjustment options." },
          predator: { title: "Predator — Opportunism & Fat Pitch", text: "Find a nearby laundry competitor with idle machines or a burned-out owner; offer to acquire the location below the machine liquidation value (distressed asset purchase)." },
        },
      },
    },
    {
      id: "coffee-shop",
      name: "Kopi Kencana (Coffee Shop & Roastery)",
      vertical: "conventional",
      parameters: { fixed: 240_000_000, price: 35_000, variable: 8_500, invested: 500_000_000 },
      seed: {
        confidence: 72,
        bull: [
          { agent: "Roastery Moat", text: "Roasting beans in-house cuts the variable cost (COGS) of a milk coffee from Rp 12k to Rp 8.5k, yielding a 75% gross margin." },
          { agent: "Social Space", text: "The co-working & meeting-room concept attracts a loyal corporate segment with higher billing per transaction." },
        ],
        bear: [
          { agent: "Saturated Bear", text: "Coffee-shop density within a 1 km radius is already saturated. Marketing cost to acquire new customers is high." },
          { agent: "Churn Risk", text: "Specialty-coffee customers have low loyalty — they constantly chase new spots for social-media aesthetics." },
        ],
        advisory: {
          operator: { title: "Operator — Moat & Efficiency", text: "Sell roasted packaged beans to other small cafes around town to maximize utilization of the expensive roasting machine." },
          risk: { title: "Risk Manager — Stress-Test & Survival", text: "If commodity green-bean prices rise 40%, quickly diversify the blend with high-quality robusta without harming the core flavor." },
          predator: { title: "Predator — Opportunism & Fat Pitch", text: "If a neighboring coffee shop goes bankrupt, buy their used La Marzocco espresso machine at a 40% market discount as stock for a second outlet." },
        },
      },
    },
  ],
};

export const VERTICAL_LABELS: Record<Vertical, string> = {
  stocks: "Listed Equities Ingestion Cockpit",
  startups: "VC Unit Economics & Runway Sandbox",
  conventional: "Conventional Business CapEx & BEP Calculator",
};

/** Short labels for menus / titles (the VERTICAL_LABELS above are too long for chips). */
export const VERTICAL_SHORT: Record<Vertical, string> = {
  stocks: "Stock",
  startups: "Startup / VC",
  conventional: "Conventional",
};

/**
 * Neutral starting parameters for a blank entry in each vertical. Values are
 * mid-range, round, and within the slider bounds so the deterministic engine
 * computes cleanly (no divide-by-zero) before the user edits anything.
 */
export const BLANK_PARAMS: Record<Vertical, AssetParameters> = {
  stocks: {
    price: 5000,
    eps: 500,
    pb: 3,
    roe: 15,
    discountRate: 0.1,
    terminalMult: 10,
    invested: 5000,
    cashflows: [500, 500, 500, 500, 500],
  },
  startups: {
    cash: 10_000_000_000,
    burn: 1_000_000_000,
    cac: 500_000,
    arpu: 200_000,
    margin: 0.6,
    churn: 0.05,
  },
  conventional: {
    fixed: 200_000_000,
    price: 50_000,
    variable: 20_000,
    invested: 500_000_000,
  },
};
