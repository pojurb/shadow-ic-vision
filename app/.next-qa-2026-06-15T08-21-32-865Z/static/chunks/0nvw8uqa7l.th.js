(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["object"==typeof document?document.currentScript:void 0,17035,e=>{"use strict";var a=e.i(43476),t=e.i(71645);function o({role:e,children:t}){return(0,a.jsxs)("div",{className:`px-msg px-msg--${e}`,children:[(0,a.jsx)("div",{className:"px-msg-role",children:"you"===e?"You":"Analyst"}),(0,a.jsx)("div",{className:"px-msg-body",children:t})]})}function r({rows:e}){let[o,s]=(0,t.useState)(!1);return o?(0,a.jsxs)("div",{className:"px-extract px-extract--locked",children:[(0,a.jsx)("div",{className:"px-extract-h px-extract-h--locked",children:"🔒 Figures locked via the deterministic engine"}),(0,a.jsx)("button",{className:"px-link",onClick:()=>s(!1),children:"review again"})]}):(0,a.jsxs)("div",{className:"px-extract",children:[(0,a.jsx)("div",{className:"px-extract-h",children:"Confirm before locking"}),(0,a.jsxs)("div",{className:"px-extract-note",children:["The amber rows were ",(0,a.jsx)("b",{children:"inferred from the attachment"}),"— check them. The rest you typed, so they're ready."]}),e.map(e=>{let t="pdf"===e.src;return(0,a.jsxs)("div",{className:`px-extract-row ${t?"is-inferred":""}`,children:[(0,a.jsx)("span",{className:"px-extract-k",children:e.k}),t?(0,a.jsxs)("span",{className:"px-extract-edit",children:[(0,a.jsx)("input",{defaultValue:e.v,className:"px-extract-input"}),(0,a.jsx)("span",{className:"px-extract-unit",children:e.unit})]}):(0,a.jsxs)("span",{className:"px-extract-v",children:[e.v," ",(0,a.jsx)("span",{className:"px-extract-unit",children:e.unit})]}),t?(0,a.jsx)("span",{className:"px-extract-flag",children:"inferred · check"}):(0,a.jsx)("span",{className:"px-extract-ok",children:"✓ you typed"})]},e.k)}),(0,a.jsxs)("div",{className:"px-extract-actions",children:[(0,a.jsx)("button",{className:"px-primary-btn px-extract-confirm",onClick:()=>s(!0),children:"Confirm & lock figures"}),(0,a.jsx)("button",{className:"px-ghost-btn",children:"Edit in inspector"})]})]})}function s({side:e,label:o,points:r}){let[i,n]=(0,t.useState)(!1),l=r.some(e=>e.slot),p=l||i?r:r.slice(0,1),c=r.length-1;return(0,a.jsxs)("div",{className:"px-debate-col",children:[(0,a.jsx)("div",{className:`px-debate-h ${"bull"===e?"px-bull":"px-bear"}`,children:o}),(0,a.jsx)("ul",{className:"px-points",children:p.map((e,t)=>(0,a.jsxs)("li",{children:[e.slot&&(0,a.jsx)("span",{className:"px-slot",children:e.slot}),(0,a.jsx)("b",{children:e.hook})," — ",e.text]},t))}),!l&&c>0&&(0,a.jsx)("button",{className:"px-more",onClick:()=>n(e=>!e),children:i?"Show less":`+${c} more`})]})}function i({lens:e}){let[o,r]=(0,t.useState)(!1);return(0,a.jsxs)("div",{className:"px-lens-row",children:[(0,a.jsxs)("div",{className:"px-lens-top",children:[(0,a.jsx)("span",{className:"px-lens-name",children:e.name}),(0,a.jsx)("span",{className:`px-lens-verdict ${e.tone}`,children:e.verdict})]}),(0,a.jsxs)("div",{className:"px-lens-hook",children:[(0,a.jsxs)("b",{children:[e.hook,"."]})," ",(0,a.jsx)("button",{className:"px-more px-more-inline",onClick:()=>r(e=>!e),children:o?"less":"why"})]}),o&&(0,a.jsx)("ul",{className:"px-points px-points-tight",children:e.points.map((e,t)=>(0,a.jsx)("li",{children:e},t))})]})}function n(){let e=e=>(e-3800)/1600*100;return(0,a.jsxs)("div",{className:"px-pvf",children:[(0,a.jsxs)("div",{className:"px-mos2-track",children:[(0,a.jsx)("div",{className:"px-mos2-gap",style:{left:`${e(4200)}%`,width:`${e(4940)-e(4200)}%`}}),(0,a.jsx)("div",{className:"px-mos2-tick px-mos2-cost",style:{left:`${e(4200)}%`},children:(0,a.jsx)("span",{children:"cost 4,200"})}),(0,a.jsx)("div",{className:"px-mos2-tick px-mos2-npv",style:{left:`${e(4940)}%`},children:(0,a.jsx)("span",{children:"NPV 4,940"})})]}),(0,a.jsxs)("div",{className:"px-mos-axis",children:[(0,a.jsx)("span",{children:"3,800"}),(0,a.jsx)("span",{children:"5,400"})]}),(0,a.jsxs)("div",{className:"px-pvf-legend",children:[(0,a.jsx)("span",{className:"px-leg-fair",children:"● intrinsic value (NPV)"}),(0,a.jsx)("span",{className:"px-leg-gap",children:"margin of safety +15%"})]})]})}function l(){let e=Math.round(56.68016194331984);return(0,a.jsxs)("div",{className:"px-bridge",children:[(0,a.jsxs)("div",{className:"px-bridge-bar",children:[(0,a.jsx)("div",{className:"px-bridge-seg px-bridge-pv",style:{width:`${43.31983805668016}%`},children:"PV cashflows"}),(0,a.jsx)("div",{className:"px-bridge-seg px-bridge-term",style:{width:`${56.68016194331984}%`},children:"terminal"})]}),(0,a.jsxs)("div",{className:"px-bridge-legend",children:[(0,a.jsxs)("span",{children:[(0,a.jsx)("b",{children:"2,140"})," PV of cashflows"]}),(0,a.jsxs)("span",{children:[(0,a.jsx)("b",{children:"2,800"})," terminal value"]}),(0,a.jsx)("span",{className:"px-bridge-total",children:"= 4,940 NPV"})]}),(0,a.jsxs)("div",{className:"px-bridge-flag",children:["⚠ ",e,"% of intrinsic value is terminal value — leans on the exit multiple."]})]})}function p(){let e=.7694444444444444*240;return(0,a.jsxs)("div",{className:"px-pvf",children:[(0,a.jsxs)("svg",{viewBox:"0 0 240 96",className:"px-vsvg",preserveAspectRatio:"none",children:[(0,a.jsx)("polygon",{points:`0,14 ${e},88 ${e},96 0,96`,className:"px-chart-fill"}),(0,a.jsx)("polyline",{points:`0,14 ${e},88`,className:"px-chart-line"}),(0,a.jsx)("line",{x1:0,y1:88,x2:240,y2:88,className:"px-ref px-ref-zero"}),(0,a.jsx)("line",{x1:120,y1:0,x2:120,y2:96,className:"px-ref px-ref-raise"})]}),(0,a.jsxs)("div",{className:"px-pvf-legend",children:[(0,a.jsx)("span",{className:"px-leg-fair",children:"● 14 mo to zero"}),(0,a.jsx)("span",{className:"px-leg-raise",children:"● raise window · mo 9"}),(0,a.jsx)("span",{className:"px-leg-gap",children:"−1.30B / mo"})]})]})}function c(){return(0,a.jsxs)("div",{className:"px-pvf",children:[(0,a.jsxs)("svg",{viewBox:"0 0 240 96",className:"px-vsvg",preserveAspectRatio:"none",children:[(0,a.jsx)("rect",{x:163,y:0,width:77,height:96,className:"px-be-profit"}),(0,a.jsx)("rect",{x:0,y:0,width:163,height:96,className:"px-be-loss"}),(0,a.jsx)("polyline",{points:"0,90 240,12",className:"px-be-rev"}),(0,a.jsx)("polyline",{points:"0,52 240,30",className:"px-be-cost"}),(0,a.jsx)("line",{x1:163,y1:0,x2:163,y2:96,className:"px-ref px-ref-bep"})]}),(0,a.jsxs)("div",{className:"px-pvf-legend",children:[(0,a.jsx)("span",{className:"px-leg-rev",children:"● revenue"}),(0,a.jsx)("span",{className:"px-leg-cost",children:"● total cost"}),(0,a.jsx)("span",{className:"px-leg-gap",children:"BEP · 1,850/mo"})]})]})}let d={stocks:{name:"Stocks",crumb:"BBRI · Bank Rakyat",sub:"BBRI · everything at a glance",verticalLabel:"listed-equity",attach:"BBRI_factsheet_Q1.pdf",userPaste:(0,a.jsx)(a.Fragment,{children:"Looking at BBRI at 4,200. EPS around 380, ROE has been strong ~19%. Worth a position? Pasting the latest factsheet too."}),confirmLine:"Looks right. Lock it and run the debate.",lockSummary:(0,a.jsxs)(a.Fragment,{children:["Locked via the deterministic engine. Against your ",(0,a.jsx)("b",{children:"4,200"})," cost basis, intrinsic value (DCF) is"," ",(0,a.jsx)("b",{className:"px-bull",children:"4,940"})," — a ",(0,a.jsx)("b",{className:"px-bull",children:"margin of safety of ~15%"}),", and P/E at 11.1× screens as a"," ",(0,a.jsx)("b",{className:"px-bull",children:"DISCOUNT"}),". Note ~57% of that value sits in the terminal multiple, so the call leans on the exit assumption. Engine stance: ",(0,a.jsx)("b",{className:"px-bull",children:"UNDERVALUED"}),". Debate and the four lenses are in the inspector."]}),followups:["Stress-test the discount rate","How much value is terminal?","Compare to BBCA"],extractRows:[{k:"Share price",v:"4,200",unit:"IDR",src:"you"},{k:"EPS",v:"380",unit:"IDR",src:"you"},{k:"ROE",v:"19",unit:"%",src:"you"},{k:"Cost basis / buy price",v:"4,200",unit:"IDR",src:"you"},{k:"Discount rate",v:"11",unit:"%",src:"pdf"}],stance:{label:"UNDERVALUED",tone:"px-bull",basis:"engine-derived · P/E DISCOUNT + positive margin of safety"},thesisSupport:"MIXED",stats:[{label:"P/E · DISCOUNT",val:"11.1×",tone:"px-bull"},{label:"Margin of Safety",val:"+15%",tone:"px-bull"},{label:"Intrinsic Val. (NPV)",val:"4,940",tone:""},{label:"Earnings Yield",val:"9.0%",tone:""}],figs:[{label:"Share Price (IDR)",val:"4,200",pct:21},{label:"EPS (IDR)",val:"380",pct:19},{label:"ROE %",val:"19%",pct:38},{label:"Discount Rate %",val:"11%",pct:30},{label:"Terminal Multiple",val:"12×",pct:48}],debate:{bull:[{slot:"Valuation",hook:"P/E 11.1× = DISCOUNT",text:"below the 13× cheap threshold and the 5-yr mean; a ~6% yield pays you to wait."},{slot:"Quality",hook:"ROE ~19%",text:"a low-cost deposit franchise compounds book value faster than peers."},{slot:"Catalyst",hook:"Rate-cut re-rate",text:"a shallow cut cycle lets NIM hold while the multiple normalizes toward the mean."},{slot:"Risk",hook:"Margin of safety +15%",text:"intrinsic value sits above your cost basis even before any re-rate."}],bear:[{slot:"Valuation",hook:"Cheap for a reason",text:"the discount may be pricing a real earnings cut, not a mispricing."},{slot:"Quality",hook:"ROE mean-reverts",text:"19% isn't permanent; competition and rate cuts pull it toward the cost of equity."},{slot:"Catalyst",hook:"No visible trigger",text:"without a catalyst a cheap stock stays cheap — the classic value trap."},{slot:"Risk",hook:"57% terminal value",text:"most of the DCF rests on the exit multiple; a small haircut erases the margin of safety."}]},lenses:[{name:"Valuation",verdict:"CHEAP",tone:"px-bull",hook:"Trades at a discount to intrinsic value",points:["P/E 11.1× screens DISCOUNT; margin of safety +15% vs cost basis.","Earnings yield 9.0% beats the discount rate — value accretes by holding."]},{name:"Quality",verdict:"DURABLE",tone:"px-bull",hook:"ROE ~19% funds the compounding",points:["Deposit franchise + scale keep returns above the cost of equity.","PEG reasonable given the ROE — growth isn't being overpaid for."]},{name:"Catalyst",verdict:"CATALYST-LIGHT",tone:"px-amber",hook:"The re-rate needs a trigger that isn't visible yet",points:["Cheapness alone doesn't close the gap — watch for the rate-cycle turn.","Until then, the dividend is the carry while you wait."]},{name:"Risk Manager",verdict:"FRAGILE TO RATES",tone:"px-bear",hook:"Most of the value is rate-sensitive terminal value",points:["57% of NPV is terminal — stress the discount rate before sizing.","Set a review trigger if ROE prints below 16% or the MoS turns negative."]}]},startups:{name:"Startups",crumb:"Acme · Seed extension",sub:"Acme SaaS · everything at a glance",verticalLabel:"early-stage startup",attach:"Acme_board_deck.pdf",userPaste:(0,a.jsx)(a.Fragment,{children:"Evaluating a seed extension for Acme (B2B SaaS). ~18B in the bank, burning about 1.3B a month. Deck attached — pull what you need."}),confirmLine:"Yep, lock it and run the read.",lockSummary:(0,a.jsxs)(a.Fragment,{children:["Locked. At 1.3B/mo you have ",(0,a.jsx)("b",{children:"~14 months"})," of cash, but the raise window closes around ",(0,a.jsx)("b",{className:"px-amber",children:"month 9"}),"— that's the real clock. Unit economics hold (",(0,a.jsx)("b",{className:"px-bull",children:"LTV:CAC 3.2×"}),"); the burn multiple at 1.8× is the soft spot. Lenses on the right. Confidence ",(0,a.jsx)("b",{children:"61%"}),"."]}),followups:["What burn hits default-alive?","Model a 20% burn cut","Compare to last round"],extractRows:[{k:"Cash balance",v:"18.0",unit:"B",src:"you"},{k:"Monthly burn",v:"1.30",unit:"B",src:"pdf"},{k:"CAC",v:"450",unit:"k",src:"pdf"},{k:"ARPU",v:"95",unit:"k/mo",src:"you"},{k:"Churn",v:"4.0",unit:"%/mo",src:"pdf"}],stats:[{label:"Runway",val:"14 mo",tone:""},{label:"Burn mult.",val:"1.8×",tone:"px-amber"},{label:"LTV : CAC",val:"3.2×",tone:"px-bull"},{label:"Confidence",val:"61%",tone:"px-acc"}],figs:[{label:"Cash Balance",val:"18.0B",pct:36},{label:"Monthly Burn",val:"1.30B",pct:26},{label:"CAC",val:"450k",pct:22},{label:"ARPU /mo",val:"95k",pct:30},{label:"Gross Margin %",val:"78%",pct:78},{label:"Churn %/mo",val:"4.0%",pct:27}],debate:{bull:[{hook:"Net revenue retention >115%",text:"expansion offsets churn; the installed base compounds without new logos."},{hook:"14 months of runway",text:"enough to hit the metrics that de-risk a priced Series A."},{hook:"LTV:CAC at 3.2×",text:"the unit economics already work — growth is a funding question, not a model question."},{hook:"Founder-led sales engine",text:"a repeatable motion with a short ramp on new reps."}],bear:[{hook:"Burn multiple 1.8×",text:"nearly two rupiah burned per rupiah of net-new ARR — inefficient growth."},{hook:"Churn at 4%/mo",text:"~38% annual logo churn quietly caps the ceiling."},{hook:"Single-channel acquisition",text:"CAC rises the moment the one working channel saturates."},{hook:"Raise needed by month 9",text:"real runway to a round is shorter than the cash-out date."}]},lenses:[{name:"Operator",verdict:"EXTEND RUNWAY",tone:"px-bull",hook:"Get to default-alive",points:["A 20% burn cut pushes the raise window past month 12.","Concentrate spend on the one channel that's actually converting."]},{name:"Risk",verdict:"CUT BURN",tone:"px-amber",hook:"The raise window is the risk, not the runway",points:["Plan the round to open by month 6, not 9 — markets gap.","Model the down-round case; a 1.8× burn multiple won't impress a lead."]},{name:"Predator",verdict:"NEGOTIATE",tone:"px-acc",hook:"Time the raise from strength",points:["Two more quarters of NRR data resets the valuation anchor.","An insider-led extension buys leverage for the priced round."]}]},conventional:{name:"Conventional",crumb:"Kopi Senja · Outlet 3",sub:"Kopi Senja · everything at a glance",verticalLabel:"conventional / cash-flow business",attach:"KopiSenja_outlet3_PnL.pdf",userPaste:(0,a.jsx)(a.Fragment,{children:"Third Kopi Senja outlet. ~850M fit-out, fixed run-rate around 420M/year, sells at ~28k a cup, COGS ~11k. Worth opening? P&L attached."}),confirmLine:"Correct. Lock and run it.",lockSummary:(0,a.jsxs)(a.Fragment,{children:["Locked. Break-even sits near ",(0,a.jsx)("b",{children:"1,850 cups/month"})," against a location already running above that, with a ",(0,a.jsx)("b",{children:"~26-month payback"})," and a"," ",(0,a.jsx)("b",{className:"px-bull",children:"positive NPV at 12%"}),". The 850M CapEx is the irreversible piece. Lenses on the right. Confidence ",(0,a.jsx)("b",{children:"68%"}),"."]}),followups:["Break-even if footfall −20%?","Phase the CapEx?","Cannibalization vs outlet 2"],extractRows:[{k:"Initial CapEx",v:"850",unit:"M",src:"you"},{k:"Annual fixed cost",v:"420",unit:"M",src:"pdf"},{k:"Price / unit",v:"28",unit:"k",src:"you"},{k:"Variable / unit",v:"11",unit:"k",src:"pdf"}],stats:[{label:"Break-even",val:"1,850",tone:""},{label:"Payback",val:"26 mo",tone:"px-amber"},{label:"NPV @12%",val:"+1.4B",tone:"px-bull"},{label:"Confidence",val:"68%",tone:"px-acc"}],figs:[{label:"Initial CapEx",val:"850M",pct:42},{label:"Annual Fixed Cost",val:"420M",pct:40},{label:"Price / Unit",val:"28k",pct:55},{label:"Variable / Unit",val:"11k",pct:22}],debate:{bull:[{hook:"Contribution margin 61%",text:"every cup past break-even drops mostly to profit."},{hook:"Break-even below run-rate",text:"1,850/mo sits under the location's existing footfall from day one."},{hook:"26-month payback",text:"reasonable for a hard-asset outlet that retains resale value."},{hook:"Proven format",text:"third outlet, not a first bet — the playbook is known."}],bear:[{hook:"850M CapEx upfront",text:"concentrated, illiquid, hard to reverse if footfall disappoints."},{hook:"Fixed cost 420M/yr",text:"operating leverage cuts both ways in a slow quarter."},{hook:"Cannibalization risk",text:"a third outlet may pull customers from the existing two."},{hook:"Lease & wage inflation",text:"fixed costs creep faster than you can push price."}]},lenses:[{name:"Operator",verdict:"APPROVE",tone:"px-bull",hook:"Greenlight with a ramp plan",points:["Margin structure is healthy; the model works above 1,850 cups.","Pre-open marketing to clear break-even inside the first quarter."]},{name:"Risk",verdict:"STAGE CAPEX",tone:"px-amber",hook:"Phase the fit-out spend",points:["Release the second tranche only after week-4 footfall confirms demand.","Stress break-even at −20% footfall before committing the full 850M."]},{name:"Predator",verdict:"RENEGOTIATE",tone:"px-acc",hook:"The landlord needs the anchor more than you",points:["A rent-free fit-out period shortens payback by months.","Push a turnover-linked lease to cap the fixed-cost downside."]}]}},x=`
.proto-root{
  position:fixed; inset:0; z-index:9999;
  display:flex; flex-direction:column;
  background:#16181d;
  color:#e6e9ef;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size:15px; line-height:1.55;
  --acc:#22d3ee; --amber:#f0a829; --bull:#34d399; --bear:#f87171;
  --line:#2a2e37; --panel:#1c1f26; --panel2:#21252e; --muted:#9aa3b2;
  --mono:"JetBrains Mono", ui-monospace, monospace;
}
.proto-root *{box-sizing:border-box;}
.px-bull{color:var(--bull);} .px-bear{color:var(--bear);} .px-amber{color:var(--amber);} .px-acc{color:var(--acc);}

/* top bar */
.px-topbar{display:flex; justify-content:space-between; align-items:center;
  padding:12px 18px; background:#1a1d23; border-bottom:1px solid var(--line); gap:16px;}
.px-brand{display:flex; align-items:center; gap:8px; font-weight:600; letter-spacing:.3px; font-size:13px; min-width:0;}
.px-dot{width:8px;height:8px;border-radius:50%;background:var(--bull);box-shadow:0 0 8px var(--bull);flex:0 0 auto;}
.px-sep{color:#4b515e;}
.px-crumb{color:var(--muted);font-weight:500;}
.px-crumb-active{color:#fff;font-weight:600;white-space:nowrap;}
.px-vert-seg{display:flex;gap:2px;background:#13161b;border:1px solid var(--line);border-radius:8px;padding:2px;flex:0 0 auto;}
.px-vert-btn{background:transparent;border:none;color:var(--muted);padding:5px 14px;border-radius:6px;
  cursor:pointer;font-size:12.5px;font-weight:600;font-family:inherit;}
.px-vert-btn.is-active{background:var(--panel2);color:#fff;box-shadow:inset 0 -2px 0 var(--acc);}
.px-topbar-right{display:flex;align-items:center;gap:14px;flex:0 0 auto;}
.px-mode{font-size:12px;font-weight:600;letter-spacing:.4px;padding:3px 10px;border-radius:999px;}
.px-mode-locked{color:var(--acc);background:rgba(34,211,238,.12);}
.px-ghost-btn{background:transparent;border:1px solid var(--line);color:var(--muted);
  padding:5px 12px;border-radius:6px;cursor:pointer;font-size:13px;font-family:inherit;}
.px-ghost-btn:hover{color:#fff;border-color:#3c424d;}

/* split */
.px-split{flex:1;display:flex;min-height:0;}
.px-gutter{flex:0 0 6px;cursor:col-resize;background:var(--line);position:relative;}
.px-gutter::after{content:"";position:absolute;inset:0 -3px;}
.px-gutter:hover,.px-gutter.is-dragging{background:var(--acc);}

/* conversation */
.px-convo{flex:1;display:flex;flex-direction:column;min-height:0;min-width:0;background:#16181d;}
.px-stream{flex:1;overflow-y:auto;padding:28px 0;}
.px-msg{max-width:760px;margin:0 auto 22px;padding:0 28px;}
.px-msg-role{font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--muted);margin-bottom:6px;}
.px-msg--ai .px-msg-role{color:var(--acc);}
.px-msg-body{font-size:15.5px;line-height:1.6;}
.px-msg--you .px-msg-body{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:14px 16px;}
.px-msg b{color:#fff;font-weight:600;}
.px-attach{margin-top:10px;font-size:13px;color:var(--muted);font-family:var(--mono);
  background:#14161b;border:1px solid var(--line);border-radius:6px;padding:6px 10px;display:inline-block;}
.px-note{margin-top:12px;font-size:13px;color:var(--muted);}
.px-link{background:none;border:none;color:var(--acc);cursor:pointer;font-size:13px;text-decoration:underline;padding:0;font-family:inherit;}
.px-followups{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px;}
.px-chip{background:var(--panel2);border:1px solid var(--line);color:#cdd3dd;padding:6px 12px;border-radius:999px;cursor:pointer;font-size:13px;font-family:inherit;}
.px-chip:hover{border-color:var(--acc);color:#fff;}

/* extraction confirm card */
.px-extract{margin-top:14px;background:var(--panel);border:1px solid var(--line);border-left:3px solid var(--amber);border-radius:10px;padding:14px 16px;}
.px-extract--locked{border-left-color:var(--bull);display:flex;justify-content:space-between;align-items:center;gap:12px;}
.px-extract-h{font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--amber);margin-bottom:6px;}
.px-extract-h--locked{color:var(--bull);margin-bottom:0;}
.px-extract-note{font-size:13px;color:var(--muted);margin-bottom:10px;line-height:1.5;}
.px-extract-note b{color:var(--amber);font-weight:600;}
.px-extract-row{display:grid;grid-template-columns:1fr auto auto;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid #23262e;}
.px-extract-row.is-inferred{background:rgba(240,168,41,.05);margin:0 -8px;padding:8px;border-radius:6px;border-bottom:1px solid transparent;}
.px-extract-row:last-child{border-bottom:none;}
.px-extract-k{color:#cdd3dd;font-size:14px;}
.px-extract-v{font-family:var(--mono);color:#fff;font-weight:600;font-size:14px;}
.px-extract-edit{display:flex;align-items:center;gap:5px;}
.px-extract-input{width:82px;background:#14161b;border:1px solid var(--amber);border-radius:5px;color:#fff;font-family:var(--mono);font-weight:600;font-size:14px;padding:4px 7px;text-align:right;}
.px-extract-input:focus{outline:none;box-shadow:0 0 0 2px rgba(240,168,41,.25);}
.px-extract-unit{font-family:var(--mono);font-size:12px;color:var(--muted);}
.px-extract-flag{font-size:11px;color:var(--amber);background:rgba(240,168,41,.12);padding:2px 8px;border-radius:999px;white-space:nowrap;}
.px-extract-ok{font-size:11px;color:var(--bull);white-space:nowrap;}
.px-extract-actions{display:flex;gap:8px;align-items:center;margin-top:14px;}
.px-extract-actions .px-extract-confirm{width:auto;flex:1;}

/* composer */
.px-composer{border-top:1px solid var(--line);background:#1a1d23;padding:12px 28px 16px;}
.px-composer-tools{display:flex;gap:10px;margin-bottom:8px;max-width:760px;margin:0 auto 8px;}
.px-tool{background:transparent;border:1px solid var(--line);color:var(--muted);padding:5px 12px;border-radius:999px;font-size:12.5px;cursor:pointer;display:flex;align-items:center;gap:6px;font-family:inherit;}
.px-tool-toggle input{accent-color:var(--acc);}
.px-composer-input{display:flex;gap:10px;align-items:flex-end;max-width:760px;margin:0 auto;}
.px-composer-input textarea{flex:1;resize:none;background:var(--panel);border:1px solid var(--line);border-radius:10px;color:#e6e9ef;padding:12px 14px;font-size:15px;font-family:inherit;line-height:1.5;}
.px-composer-input textarea:focus{outline:none;border-color:var(--acc);}
.px-send{background:var(--acc);color:#0a0c0f;border:none;border-radius:10px;font-weight:700;padding:12px 18px;cursor:pointer;font-size:14px;white-space:nowrap;font-family:inherit;}

/* inspector */
.px-inspector{background:var(--panel);overflow-y:auto;min-height:0;}
.px-inspector-head{display:flex;justify-content:space-between;align-items:baseline;padding:14px 16px;border-bottom:1px solid var(--line);position:sticky;top:0;background:var(--panel);z-index:2;}
.px-inspector-head span:first-child{font-size:12px;font-weight:700;letter-spacing:1px;}
.px-inspector-sub{font-size:12px;color:var(--muted);font-family:var(--mono);}

/* verdict strip */
.px-verdict{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:var(--line);border-bottom:1px solid var(--line);position:sticky;top:49px;z-index:1;}
.px-v-cell{background:var(--panel);padding:12px 8px;text-align:center;}
.px-v-lbl{font-size:10.5px;color:var(--muted);text-transform:uppercase;letter-spacing:.4px;margin-bottom:5px;}
.px-v-val{font-family:var(--mono);font-size:18px;font-weight:700;}

/* board */
.px-board{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px;padding:14px;align-content:start;}
.px-card{background:var(--panel2);border:1px solid var(--line);border-radius:10px;padding:13px 14px;}
.px-card--wide{grid-column:1 / -1;}
.px-card-h{font-weight:600;font-size:13.5px;margin-bottom:10px;display:flex;align-items:center;gap:8px;}
.px-card-hint{font-size:10.5px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;font-weight:400;}
.px-badge{font-family:var(--mono);font-size:10px;font-weight:700;padding:2px 7px;border-radius:999px;}
.px-badge-live{color:var(--acc);background:rgba(34,211,238,.14);}

/* debate */
.px-debate{display:grid;grid-template-columns:1fr 1fr;gap:14px;}
.px-debate-h{font-weight:700;font-size:12.5px;margin-bottom:8px;}

/* bolded-hook bullets */
.px-points{list-style:none;display:flex;flex-direction:column;gap:9px;margin:0;padding:0;}
.px-points li{font-size:13.5px;line-height:1.5;color:#cdd3dd;}
.px-points b{color:#fff;font-weight:600;}
.px-points-tight li{font-size:13px;color:var(--muted);}
.px-more{background:none;border:none;color:var(--acc);cursor:pointer;font-size:12px;padding:6px 0 0;font-weight:600;font-family:inherit;}
.px-more-inline{padding:0;font-size:12px;}

/* advisory */
.px-lenses{display:flex;flex-direction:column;gap:13px;}
.px-lens-row{border-left:2px solid var(--line);padding-left:12px;}
.px-lens-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;}
.px-lens-name{font-size:11.5px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.6px;}
.px-lens-verdict{font-family:var(--mono);font-size:12px;font-weight:700;letter-spacing:.5px;padding:2px 8px;border-radius:999px;background:rgba(255,255,255,.04);}
.px-lens-hook{font-size:14px;line-height:1.5;color:#cdd3dd;}
.px-lens-hook b{color:#fff;font-weight:600;}
.px-lens-row .px-points{margin-top:8px;}

/* figures */
.px-figs{display:flex;flex-direction:column;gap:14px;}
.px-fig-row{display:flex;justify-content:space-between;font-size:13.5px;margin-bottom:5px;}
.px-fig-label{color:var(--muted);}
.px-fig-val{font-family:var(--mono);color:var(--acc);font-weight:600;}
.px-slider{-webkit-appearance:none;appearance:none;width:100%;height:5px;border-radius:3px;background:#2c313b;outline:none;}
.px-slider::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;border-radius:50%;background:var(--acc);cursor:pointer;border:2px solid #16181d;}

.px-decision{display:flex;flex-direction:column;}
.px-input{width:100%;background:#13161b;border:1px solid var(--line);border-radius:8px;color:#e6e9ef;padding:10px 12px;font-size:14px;font-family:inherit;margin-bottom:10px;}
.px-input:focus{outline:none;border-color:var(--acc);}
.px-primary-btn{width:100%;background:var(--amber);color:#1a1205;border:none;border-radius:8px;font-weight:700;padding:11px;cursor:pointer;font-size:14px;font-family:inherit;}

/* shared chart shell */
.px-vsvg{width:100%;height:96px;background:#13161b;border:1px solid var(--line);border-radius:8px;display:block;}
.px-chart-line{fill:none;stroke:var(--acc);stroke-width:2;vector-effect:non-scaling-stroke;}
.px-chart-fill{fill:rgba(34,211,238,.1);}
.px-ref{stroke-width:1.5;stroke-dasharray:3 3;vector-effect:non-scaling-stroke;}
.px-pvf-legend{display:flex;gap:12px;margin-top:8px;font-size:11.5px;flex-wrap:wrap;align-items:center;}
.px-leg-gap{margin-left:auto;font-weight:600;font-family:var(--mono);color:#cdd3dd;}

/* chart A: price vs fair value */
.px-pvf-gap{fill:rgba(52,211,153,.08);}
.px-ref-now{stroke:#cdd3dd;} .px-ref-fair{stroke:var(--bull);}
.px-leg-now{color:#cdd3dd;} .px-leg-fair{color:var(--bull);}

/* chart B: football field */
.px-ff{position:relative;padding-top:4px;}
.px-ff-row{display:flex;align-items:center;gap:8px;margin-bottom:10px;}
.px-ff-label{width:56px;flex:0 0 56px;font-size:11.5px;color:var(--muted);text-align:right;}
.px-ff-track{position:relative;flex:1;height:14px;background:#13161b;border:1px solid var(--line);border-radius:3px;}
.px-ff-bar{position:absolute;top:0;bottom:0;background:linear-gradient(90deg,var(--bear),var(--amber),var(--bull));opacity:.55;border-radius:3px;}
.px-ff-marker{position:absolute;top:0;bottom:18px;width:2px;background:#fff;}
.px-ff-marker-lbl{position:absolute;top:-2px;left:5px;font-size:10px;color:#fff;white-space:nowrap;font-family:var(--mono);}
.px-ff-axis{display:flex;justify-content:space-between;font-size:10px;color:var(--muted);font-family:var(--mono);padding-left:64px;margin-top:2px;}

/* chart C: margin-of-safety band */
.px-mos-track{position:relative;height:46px;background:#13161b;border:1px solid var(--line);border-radius:8px;overflow:hidden;}
.px-mos-band{position:absolute;top:0;bottom:0;background:rgba(52,211,153,.16);border-left:1.5px solid var(--bull);border-right:1.5px solid var(--bull);}
.px-mos-band-lbl{position:absolute;top:3px;left:5px;font-size:9.5px;color:var(--bull);font-family:var(--mono);white-space:nowrap;}
.px-mos-fair{position:absolute;top:0;bottom:0;width:2px;background:var(--bull);}
.px-mos-gap{position:absolute;top:50%;height:0;border-top:1.5px dashed var(--amber);}
.px-mos-price{position:absolute;top:0;bottom:0;width:2px;background:#fff;}
.px-mos-price-lbl{position:absolute;bottom:3px;left:5px;font-size:10px;color:#fff;font-family:var(--mono);white-space:nowrap;}
.px-mos-axis{display:flex;justify-content:space-between;font-size:10px;color:var(--muted);font-family:var(--mono);margin-top:3px;}

/* chart D: sensitivity tornado */
.px-tor{display:flex;flex-direction:column;gap:11px;}
.px-tor-head{display:flex;justify-content:space-between;font-size:10px;color:var(--muted);font-family:var(--mono);}
.px-tor-label{font-size:12px;color:#cdd3dd;margin-bottom:4px;display:flex;justify-content:space-between;gap:8px;}
.px-tor-label span{color:var(--muted);font-family:var(--mono);font-size:11px;}
.px-tor-track{position:relative;height:14px;background:#13161b;border:1px solid var(--line);border-radius:3px;}
.px-tor-bar{position:absolute;top:0;bottom:0;background:rgba(34,211,238,.4);border-radius:3px;}
.px-tor-mid{position:absolute;top:-2px;bottom:-2px;width:1px;background:#fff;opacity:.65;}

/* runway chart */
.px-ref-zero{stroke:var(--bear);} .px-ref-raise{stroke:var(--amber);}
.px-leg-raise{color:var(--amber);}

/* break-even chart */
.px-be-rev{fill:none;stroke:var(--bull);stroke-width:2;vector-effect:non-scaling-stroke;}
.px-be-cost{fill:none;stroke:var(--bear);stroke-width:2;vector-effect:non-scaling-stroke;}
.px-be-profit{fill:rgba(52,211,153,.07);}
.px-be-loss{fill:rgba(248,113,113,.05);}
.px-ref-bep{stroke:#fff;}
.px-leg-rev{color:var(--bull);} .px-leg-cost{color:var(--bear);}

/* stance banner — engine-derived valuation verdict */
.px-stance{display:flex;align-items:baseline;gap:10px;padding:11px 16px;background:rgba(52,211,153,.06);border-bottom:1px solid var(--line);flex-wrap:wrap;}
.px-stance-label{font-family:var(--mono);font-size:16px;font-weight:700;letter-spacing:.5px;}
.px-stance-basis{font-size:11.5px;color:var(--muted);}

/* thesis-support chip (replaces the ungrounded % confidence) */
.px-badge-support{color:var(--amber);background:rgba(240,168,41,.14);}

/* debate slot tag (4-slot rubric) */
.px-slot{display:inline-block;font-size:9.5px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;
  color:var(--muted);background:rgba(255,255,255,.05);border-radius:4px;padding:1px 6px;margin-right:6px;vertical-align:middle;}

/* P0 chart — MoS gap (intrinsic vs cost basis, both totals) */
.px-mos2-track{position:relative;height:46px;background:#13161b;border:1px solid var(--line);border-radius:8px;margin-top:14px;}
.px-mos2-gap{position:absolute;top:0;bottom:0;background:rgba(52,211,153,.14);}
.px-mos2-tick{position:absolute;top:0;bottom:0;width:2px;}
.px-mos2-cost{background:#cdd3dd;}
.px-mos2-npv{background:var(--bull);}
.px-mos2-tick span{position:absolute;bottom:3px;left:5px;font-size:10px;font-family:var(--mono);white-space:nowrap;}
.px-mos2-cost span{color:#cdd3dd;}
.px-mos2-npv span{color:var(--bull);top:3px;bottom:auto;}

/* P0 chart — DCF value bridge */
.px-bridge-bar{display:flex;height:30px;border:1px solid var(--line);border-radius:6px;overflow:hidden;}
.px-bridge-seg{display:flex;align-items:center;justify-content:center;font-size:11px;color:#0a0c0f;font-weight:600;white-space:nowrap;}
.px-bridge-pv{background:rgba(34,211,238,.65);}
.px-bridge-term{background:rgba(240,168,41,.6);}
.px-bridge-legend{display:flex;gap:14px;flex-wrap:wrap;margin-top:9px;font-size:12px;color:var(--muted);align-items:center;}
.px-bridge-legend b{color:#fff;font-family:var(--mono);font-weight:600;}
.px-bridge-total{margin-left:auto;color:#cdd3dd;font-family:var(--mono);font-weight:600;}
.px-bridge-flag{margin-top:10px;font-size:12px;line-height:1.5;color:var(--amber);background:rgba(240,168,41,.07);border-radius:6px;padding:8px 10px;}
`;e.s(["default",0,function(){let[e,h]=(0,t.useState)("stocks"),[m,u]=(0,t.useState)(!0),[b,f]=(0,t.useState)(440),[g,v]=(0,t.useState)(!1),k=(0,t.useRef)(null),y=(0,t.useCallback)(()=>v(!0),[]);(0,t.useEffect)(()=>{if(!g)return;let e=e=>{f(Math.min(760,Math.max(300,(k.current?.getBoundingClientRect().right??window.innerWidth)-e.clientX)))},a=()=>v(!1);return window.addEventListener("mousemove",e),window.addEventListener("mouseup",a),()=>{window.removeEventListener("mousemove",e),window.removeEventListener("mouseup",a)}},[g]);let w=d[e];return(0,a.jsxs)("div",{className:"proto-root",ref:k,style:g?{cursor:"col-resize",userSelect:"none"}:void 0,children:[(0,a.jsx)("style",{children:x}),(0,a.jsxs)("header",{className:"px-topbar",children:[(0,a.jsxs)("div",{className:"px-brand",children:[(0,a.jsx)("span",{className:"px-dot"}),"JP FAMILY OFFICE",(0,a.jsx)("span",{className:"px-sep",children:"/"}),(0,a.jsx)("span",{className:"px-crumb",children:"Library"}),(0,a.jsx)("span",{className:"px-sep",children:"›"}),(0,a.jsx)("span",{className:"px-crumb-active",children:w.crumb})]}),(0,a.jsx)("div",{className:"px-vert-seg",children:Object.keys(d).map(t=>(0,a.jsx)("button",{className:`px-vert-btn ${t===e?"is-active":""}`,onClick:()=>h(t),children:d[t].name},t))}),(0,a.jsxs)("div",{className:"px-topbar-right",children:[(0,a.jsx)("span",{className:"px-mode px-mode-locked",children:"● FIGURES LOCKED"}),(0,a.jsx)("button",{className:"px-ghost-btn",onClick:()=>u(e=>!e),children:m?"Hide inspector ›":"‹ Show inspector"})]})]}),(0,a.jsxs)("div",{className:"px-split",children:[(0,a.jsxs)("main",{className:"px-convo",children:[(0,a.jsxs)("div",{className:"px-stream",children:[(0,a.jsxs)(o,{role:"you",children:[w.userPaste,(0,a.jsxs)("div",{className:"px-attach",children:["📄 ",w.attach]})]}),(0,a.jsxs)(o,{role:"ai",children:["This reads as a ",(0,a.jsx)("b",{children:w.verticalLabel}),"analysis. I pulled the figures from your message and the attachment — here's what I'll lock before we debate. The amber rows I inferred, so check those:",(0,a.jsx)(r,{rows:w.extractRows}),(0,a.jsxs)("div",{className:"px-note",children:["Vertical detected: ",(0,a.jsx)("b",{children:w.name})," · ",(0,a.jsx)("button",{className:"px-link",children:"change"})]})]}),(0,a.jsx)(o,{role:"you",children:w.confirmLine}),(0,a.jsxs)(o,{role:"ai",children:[w.lockSummary,(0,a.jsx)("div",{className:"px-followups",children:w.followups.map(e=>(0,a.jsx)("button",{className:"px-chip",children:e},e))})]})]},e),(0,a.jsxs)("div",{className:"px-composer",children:[(0,a.jsxs)("div",{className:"px-composer-tools",children:[(0,a.jsx)("button",{className:"px-tool",children:"＋ Attach"}),(0,a.jsxs)("label",{className:"px-tool px-tool-toggle",children:[(0,a.jsx)("input",{type:"checkbox",defaultChecked:!0})," Web research"]})]}),(0,a.jsxs)("div",{className:"px-composer-input",children:[(0,a.jsx)("textarea",{rows:2,placeholder:"Ask a grounded follow-up, or paste another deal…",defaultValue:""}),(0,a.jsx)("button",{className:"px-send",children:"Send ↵"})]})]})]}),m&&(0,a.jsx)("div",{className:`px-gutter ${g?"is-dragging":""}`,onMouseDown:y,role:"separator","aria-orientation":"vertical"}),m&&(0,a.jsxs)("aside",{className:"px-inspector",style:{width:b,flex:`0 0 ${b}px`},children:[(0,a.jsxs)("div",{className:"px-inspector-head",children:[(0,a.jsx)("span",{children:"INSPECTOR"}),(0,a.jsx)("span",{className:"px-inspector-sub",children:w.sub})]}),w.stance&&(0,a.jsxs)("div",{className:"px-stance",children:[(0,a.jsx)("span",{className:`px-stance-label ${w.stance.tone}`,children:w.stance.label}),(0,a.jsx)("span",{className:"px-stance-basis",children:w.stance.basis})]}),(0,a.jsx)("div",{className:"px-verdict",children:w.stats.map(e=>(0,a.jsxs)("div",{className:"px-v-cell",children:[(0,a.jsx)("div",{className:"px-v-lbl",children:e.label}),(0,a.jsx)("div",{className:`px-v-val ${e.tone}`,children:e.val})]},e.label))}),(0,a.jsxs)("div",{className:"px-board",children:[(0,a.jsxs)("div",{className:"px-card px-card--wide",children:[(0,a.jsxs)("div",{className:"px-card-h",children:["Red-team debate ",(0,a.jsx)("span",{className:"px-badge px-badge-live",children:"LIVE"}),w.thesisSupport&&(0,a.jsxs)("span",{className:"px-badge px-badge-support",children:["THESIS ",w.thesisSupport]})]}),(0,a.jsxs)("div",{className:"px-debate",children:[(0,a.jsx)(s,{side:"bull",label:"▲ Bull",points:w.debate.bull}),(0,a.jsx)(s,{side:"bear",label:"▼ Bear",points:w.debate.bear})]})]}),(0,a.jsxs)("div",{className:"px-card px-card--wide",children:[(0,a.jsx)("div",{className:"px-card-h",children:"Advisory board · three lenses"}),(0,a.jsx)("div",{className:"px-lenses",children:w.lenses.map(e=>(0,a.jsx)(i,{lens:e},e.name))})]}),(0,a.jsxs)("div",{className:"px-card",children:[(0,a.jsxs)("div",{className:"px-card-h",children:["Locked figures ",(0,a.jsx)("span",{className:"px-card-hint",children:"editable"})]}),(0,a.jsx)("div",{className:"px-figs",children:w.figs.map(e=>(0,a.jsxs)("div",{className:"px-fig",children:[(0,a.jsxs)("div",{className:"px-fig-row",children:[(0,a.jsx)("span",{className:"px-fig-label",children:e.label}),(0,a.jsx)("span",{className:"px-fig-val",children:e.val})]}),(0,a.jsx)("input",{type:"range",className:"px-slider",defaultValue:e.pct})]},e.label))})]}),"stocks"===e&&(0,a.jsxs)(a.Fragment,{children:[(0,a.jsxs)("div",{className:"px-card",children:[(0,a.jsxs)("div",{className:"px-card-h",children:["Margin of safety ",(0,a.jsx)("span",{className:"px-card-hint",children:"intrinsic vs cost basis"})]}),(0,a.jsx)(n,{})]}),(0,a.jsxs)("div",{className:"px-card",children:[(0,a.jsxs)("div",{className:"px-card-h",children:["DCF value bridge ",(0,a.jsx)("span",{className:"px-card-hint",children:"how much is terminal value"})]}),(0,a.jsx)(l,{})]})]}),"startups"===e&&(0,a.jsxs)("div",{className:"px-card",children:[(0,a.jsxs)("div",{className:"px-card-h",children:["Cash runway ",(0,a.jsx)("span",{className:"px-card-hint",children:"months to zero"})]}),(0,a.jsx)(p,{})]}),"conventional"===e&&(0,a.jsxs)("div",{className:"px-card",children:[(0,a.jsxs)("div",{className:"px-card-h",children:["Break-even ",(0,a.jsx)("span",{className:"px-card-hint",children:"units / month"})]}),(0,a.jsx)(c,{})]}),(0,a.jsxs)("div",{className:"px-card px-card--wide",children:[(0,a.jsx)("div",{className:"px-card-h",children:"Make the call"}),(0,a.jsxs)("div",{className:"px-decision",children:[(0,a.jsxs)("select",{className:"px-input",defaultValue:"APPROVE",children:[(0,a.jsx)("option",{children:"APPROVE / SWING CAPITAL"}),(0,a.jsx)("option",{children:"HOLD / MONITOR"}),(0,a.jsx)("option",{children:"REJECT"})]}),(0,a.jsx)("textarea",{className:"px-input",rows:2,placeholder:"Investor rationale…"}),(0,a.jsx)("button",{className:"px-primary-btn",children:"Commit decision"})]})]})]})]})]})]})}])}]);