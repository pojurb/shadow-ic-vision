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

/** How well the locked figures + qualitative case support the thesis (replaces a numeric confidence). */
export type ThesisSupport = "STRONG" | "MIXED" | "THIN";

export interface DebateLine {
  agent: string;
  text: string;
  /** The persona debate-rubric slot this line addresses (e.g. "valuation"). */
  slot?: string;
}

/** One advisory lens result: a short verdict word + the take. */
export interface SeedLens {
  id: string;
  name: string;
  verdict: string;
  text: string;
}

export interface AssetSeed {
  thesisSupport: ThesisSupport;
  /** One-line justification of the engine-derived stance (references locked verdicts only). */
  stanceBasis: string;
  bull: DebateLine[];
  bear: DebateLine[];
  advisory: SeedLens[];
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
        thesisSupport: "STRONG",
        stanceBasis: "P/E and intrinsic value back a top-quality franchise at a full price",
        bull: [
          { slot: "quality", agent: "Growth Lead", text: "An 80% CASA ratio gives an extremely low cost of funds, shielding it from Bank Indonesia rate hikes." },
          { slot: "catalyst", agent: "Technologist", text: "The myBCA app and e-channel banking process billions of daily transactions, securing stable fee-based income." },
          { slot: "risk", agent: "Asset Allocator", text: "NPL (Non-Performing Loan) is held at 1.9%, far below the national banking industry average." },
        ],
        bear: [
          { slot: "valuation", agent: "Valuation Bear", text: "A P/B ratio near 4.8x is already very premium (priced-in) versus other SEA regional banks." },
          { slot: "catalyst", agent: "Macro Adversary", text: "If Indonesian GDP growth slows below 5.0%, corporate credit expansion will weaken." },
          { slot: "risk", agent: "Risk Skeptic", text: "Fierce competition from new digital banks and fintech lending could erode its retail CASA share over the long run." },
        ],
        advisory: [
          { id: "valuation", name: "Valuation", verdict: "PREMIUM", text: "At ~4.8x P/B the quality is well recognized; the margin of safety is thin unless the multiple de-rates toward its ~4.5x mean." },
          { id: "quality", name: "Quality", verdict: "DURABLE", text: "BCA's low-cost CASA franchise and digital SOP are the industry gold standard, sustaining high ROE through rate cycles." },
          { id: "catalyst", name: "Catalyst", verdict: "MEAN-REVERSION", text: "A fat pitch appears only if an irrational correction drags BBCA to P/B < 3.8x (~Rp 7,500–8,000); it historically reverts to ~4.5x within 6–9 months." },
          { id: "risk", name: "Risk Manager", verdict: "RATE-SENSITIVE", text: "Stress scenario: at 7% rates corporate NPL could climb to ~3.5%. Mitigate by shifting liquidity into short-tenor SBN and trimming volatile commodity exposure." },
        ],
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
        thesisSupport: "MIXED",
        stanceBasis: "an infrastructure moat offset by tariff erosion and a capped payout",
        bull: [
          { slot: "quality", agent: "Infras Lead", text: "The largest national fiber-optic infrastructure plus tower ownership via Mitratel guarantees connectivity-market dominance." },
          { slot: "catalyst", agent: "Cloud Architect", text: "The NeutraDC data-center business is growing fast as cloud-computing adoption by SOEs & enterprises rises." },
        ],
        bear: [
          { slot: "valuation", agent: "Yield Skeptic", text: "Data tariffs (yield per GB) keep falling due to a telco price war that never ends." },
          { slot: "risk", agent: "Legacy Bear", text: "Heavy employee pension liabilities and fiber-optic CapEx cap the dividend payout ratio." },
        ],
        advisory: [
          { id: "valuation", name: "Valuation", verdict: "FAIR", text: "A real discount only opens on foreign sell-offs below ~10x P/E; that is the thick margin of safety worth waiting for." },
          { id: "quality", name: "Quality", verdict: "INFRA-MOAT", text: "Fixed-Mobile Convergence between Telkomsel and IndiHome can cut duplicate field/technician OpEx by up to 15%, defending the moat." },
          { id: "catalyst", name: "Catalyst", verdict: "DATA-CENTER", text: "NeutraDC and enterprise cloud are the re-rating catalysts if data-center monetization scales faster than legacy voice declines." },
          { id: "risk", name: "Risk Manager", verdict: "CAPEX-HEAVY", text: "High-rate crises raise syndicated-debt costs; limit non-productive fiber expansion outside core urban areas and restructure USD debt into IDR." },
        ],
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
        thesisSupport: "MIXED",
        stanceBasis: "strong loan quality and growth against a tightening runway",
        bull: [
          { slot: "unit_economics", agent: "Risk Modeling", text: "The AI algorithm holds NPL (Non-Performing Loan) at 1.8%, far below the OJK 5% ceiling." },
          { slot: "growth", agent: "BizDev Lead", text: "A partnership with a B2B e-commerce platform grew monthly loan volume by 35% organically." },
        ],
        bear: [
          { slot: "runway", agent: "Liquidity Analyst", text: "Less than 15 months of runway remain, while capital-market liquidity for a Series C is in a Tech Winter." },
          { slot: "risk", agent: "Regulatory Bear", text: "New OJK rules capping productive-loan interest rates will compress profit margins at the company." },
        ],
        advisory: [
          { id: "unit_economics", name: "Unit Economics", verdict: "IMPROVING", text: "Automating credit assessment with a distributed-data model cuts manual field-review cost per disbursement and lifts contribution per loan." },
          { id: "growth", name: "Growth", verdict: "ORGANIC", text: "The B2B e-commerce channel compounds volume without paid CAC; the open question is whether it survives a rate cap on yields." },
          { id: "runway", name: "Runway & Dilution", verdict: "TIGHTENING", text: "Cut monthly burn ~25% (Rp 1.2B → Rp 900M) via a hiring freeze and cloud efficiency to extend runway toward 20 months and raise from strength." },
          { id: "risk", name: "Risk Manager", verdict: "REGULATORY", text: "An OJK rate cap is the tail risk to margins; model the capped-yield case before sizing, and keep NPL discipline as the moat." },
        ],
      },
    },
    {
      id: "saas-builder",
      name: "Omni Retail SaaS",
      vertical: "startups",
      parameters: { cash: 8_000_000_000, burn: 450_000_000, cac: 600_000, arpu: 180_000, margin: 0.85, churn: 0.02 },
      seed: {
        thesisSupport: "STRONG",
        stanceBasis: "healthy LTV:CAC and very low churn with ample runway",
        bull: [
          { slot: "growth", agent: "Retention Advocate", text: "Very low churn at 2%/month signals strong product-market fit and high product stickiness." },
          { slot: "unit_economics", agent: "Unit Econ", text: "An LTV/CAC ratio of 4.25x proves very healthy marketing-budget conversion efficiency." },
        ],
        bear: [
          { slot: "growth", agent: "TAM Critic", text: "The Indonesian retail SME market is highly price-sensitive; ARPU is hard to push above Rp 200k/month without spiking churn." },
          { slot: "risk", agent: "Competitor Bear", text: "Many free POS systems are subsidized by e-wallet platforms chasing merchant volume." },
        ],
        advisory: [
          { id: "unit_economics", name: "Unit Economics", verdict: "HEALTHY", text: "LTV:CAC of ~4.25x and an 85% margin make the model fundable; growth is a distribution question, not an economics one." },
          { id: "growth", name: "Growth", verdict: "STICKY", text: "2%/month churn anchors the base; add supply-chain integration to build an ecosystem moat a free POS cannot replicate." },
          { id: "runway", name: "Runway & Dilution", verdict: "AMPLE", text: "Pull cash forward with discounted annual subscriptions to secure net cash flow earlier amid macro uncertainty." },
          { id: "risk", name: "Risk Manager", verdict: "PRICE-PRESSURE", text: "Subsidized free POS rivals cap ARPU; defend with enterprise migrations and long-term contracts rather than price." },
        ],
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
        thesisSupport: "MIXED",
        stanceBasis: "clean cash economics against fast CapEx depreciation",
        bull: [
          { slot: "returns", agent: "Cashflow Lead", text: "A cash-upfront business (coin/e-wallet) with no bad receivables. Working capital is very clean." },
          { slot: "demand", agent: "Location Expert", text: "Lower-middle-class apartments whose units lack drying balconies guarantee >60% machine occupancy." },
        ],
        bear: [
          { slot: "breakeven", agent: "CapEx Bear", text: "High-speed commercial washers depreciate fast; maintenance cost rises sharply after year 2." },
          { slot: "risk", agent: "Utility Risk", text: "Sensitive to volatile hikes in base electricity tariffs and LPG (3kg/12kg) gas prices." },
        ],
        advisory: [
          { id: "returns", name: "Returns", verdict: "CASH-CLEAN", text: "Upfront cash collection and no receivables keep realized IRR close to modeled, provided occupancy holds above break-even." },
          { id: "breakeven", name: "Break-even", verdict: "CAPEX-DRAG", text: "Rising post-year-2 maintenance lifts the effective break-even; budget machine refurbishment into the BEP, not just day-one units." },
          { id: "demand", name: "Demand", verdict: "STRUCTURAL", text: "Balcony-less apartments structurally drive >60% occupancy; the location thesis is the load-bearing demand assumption." },
          { id: "risk", name: "Risk Manager", verdict: "UTILITY-SENSITIVE", text: "Stress: rent +30% and customers −20% — recompute daily BEP. Mitigate with a 5-year lease and staggered rent-adjustment options." },
        ],
      },
    },
    {
      id: "coffee-shop",
      name: "Kopi Kencana (Coffee Shop & Roastery)",
      vertical: "conventional",
      parameters: { fixed: 240_000_000, price: 35_000, variable: 8_500, invested: 500_000_000 },
      seed: {
        thesisSupport: "MIXED",
        stanceBasis: "a high gross margin against a saturated, low-loyalty market",
        bull: [
          { slot: "returns", agent: "Roastery Moat", text: "Roasting beans in-house cuts the variable cost (COGS) of a milk coffee from Rp 12k to Rp 8.5k, yielding a 75% gross margin." },
          { slot: "demand", agent: "Social Space", text: "The co-working & meeting-room concept attracts a loyal corporate segment with higher billing per transaction." },
        ],
        bear: [
          { slot: "demand", agent: "Saturated Bear", text: "Coffee-shop density within a 1 km radius is already saturated. Marketing cost to acquire new customers is high." },
          { slot: "risk", agent: "Churn Risk", text: "Specialty-coffee customers have low loyalty — they constantly chase new spots for social-media aesthetics." },
        ],
        advisory: [
          { id: "returns", name: "Returns", verdict: "MARGIN-RICH", text: "In-house roasting lifts gross margin to ~75%, so every transaction past break-even drops hard to the bottom line." },
          { id: "breakeven", name: "Break-even", verdict: "VOLUME-GATED", text: "High fixed rent in a prime social location pushes the BEP up; sustained daily volume, not margin, is the binding constraint." },
          { id: "demand", name: "Demand", verdict: "SATURATED", text: "1 km density is high; the corporate co-working segment with higher billing is the differentiated demand to defend." },
          { id: "risk", name: "Risk Manager", verdict: "COMMODITY", text: "If green-bean prices rise 40%, diversify the blend with quality robusta without harming core flavor; wholesale beans to nearby cafes to utilize the roaster." },
        ],
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
