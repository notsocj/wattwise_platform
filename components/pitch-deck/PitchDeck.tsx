"use client";

/* eslint-disable @next/next/no-page-custom-font -- Inter is scoped to this standalone pitch deck route. */

import { useEffect, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Download, Zap } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

const slides = [
  { id: "cover", label: "WattWise" },
  { id: "problem", label: "The problem" },
  { id: "solution", label: "The solution" },
  { id: "product", label: "The product" },
  { id: "market", label: "Market" },
  { id: "model", label: "Business model" },
  { id: "progress", label: "Progress & impact" },
  { id: "ask", label: "Use of funds" },
];

export default function PitchDeck() {
  const [activeSlide, setActiveSlide] = useState(0);
  const [teamName, setTeamName] = useState("Your Team");

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement) return;
      if (event.key === "ArrowRight" || event.key === "PageDown") {
        event.preventDefault();
        setActiveSlide((current) => Math.min(slides.length - 1, current + 1));
      }
      if (event.key === "ArrowLeft" || event.key === "PageUp") {
        event.preventDefault();
        setActiveSlide((current) => Math.max(0, current - 1));
      }
      if (event.key === "Home") setActiveSlide(0);
      if (event.key === "End") setActiveSlide(slides.length - 1);
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const originalTitle = document.title;
    const restoreTitle = () => {
      document.title = originalTitle;
    };
    window.addEventListener("afterprint", restoreTitle);
    return () => window.removeEventListener("afterprint", restoreTitle);
  }, []);

  const exportPdf = () => {
    const safeTeam = teamName.trim().replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "TeamName";
    document.title = `${safeTeam}_PresentationDeck_PSC11`;
    window.print();
  };

  const previous = () => setActiveSlide((current) => Math.max(0, current - 1));
  const next = () => setActiveSlide((current) => Math.min(slides.length - 1, current + 1));

  return (
    <main className="pitch-shell">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />

      <header className="deck-toolbar">
        <Link className="deck-brand" href="/" aria-label="WattWise home">
          <span className="brand-mark"><Zap size={17} fill="currentColor" strokeWidth={2.5} /></span>
          <span>WattWise <span className="brand-divider">/</span> PSC XI</span>
        </Link>
        <div className="toolbar-actions">
          <label className="team-field">
            <span>Team</span>
            <input value={teamName} onChange={(event) => setTeamName(event.target.value)} aria-label="Team name for PDF filename" />
          </label>
          <button type="button" className="export-button" onClick={exportPdf}>
            <Download size={16} /> <span>Export PDF</span>
          </button>
        </div>
      </header>

      <section className="deck-stage" aria-label="WattWise pitch deck">
        <div className="slides-viewport" aria-live="polite">
          {slides.map((slide, index) => (
            <article className={`deck-slide slide-${index + 1}${index === activeSlide ? " is-current" : ""}`} key={slide.id}>
              <SlideContent index={index} teamName={teamName} />
              <div className="slide-foot">
                <span>WATTWISE · PHILIPPINE STARTUP CHALLENGE XI</span>
                <span>{String(index + 1).padStart(2, "0")} / {String(slides.length).padStart(2, "0")}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <footer className="deck-controls">
        <button type="button" className="nav-button" onClick={previous} disabled={activeSlide === 0} aria-label="Previous slide">
          <ArrowLeft size={17} /> <span>Previous</span>
        </button>
        <nav className="slide-nav" aria-label="Choose slide">
          {slides.map((slide, index) => (
            <button
              type="button"
              key={slide.id}
              className={`slide-dot${index === activeSlide ? " is-active" : ""}`}
              onClick={() => setActiveSlide(index)}
              aria-label={`Slide ${index + 1}: ${slide.label}`}
              aria-current={index === activeSlide ? "step" : undefined}
            />
          ))}
        </nav>
        <div className="slide-count">{String(activeSlide + 1).padStart(2, "0")} <span>/</span> {String(slides.length).padStart(2, "0")}</div>
        <button type="button" className="nav-button" onClick={next} disabled={activeSlide === slides.length - 1} aria-label="Next slide">
          <span>Next</span> <ArrowRight size={17} />
        </button>
      </footer>
      <p className="keyboard-hint">Use ← and → to navigate</p>
    </main>
  );
}

function SlideContent({ index, teamName }: { index: number; teamName: string }) {
  switch (index) {
    case 0: return <CoverSlide teamName={teamName} />;
    case 1: return <ProblemSlide />;
    case 2: return <SolutionSlide />;
    case 3: return <ProductSlide />;
    case 4: return <MarketSlide />;
    case 5: return <BusinessModelSlide />;
    case 6: return <ProgressSlide />;
    case 7: return <FundingSlide />;
    default: return null;
  }
}

function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="eyebrow"><span />{children}</p>;
}

function SlideHeading({ eyebrow, title, summary }: { eyebrow: string; title: string; summary?: string }) {
  return (
    <header className="slide-heading">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2>{title}</h2>
      {summary && <p className="slide-summary">{summary}</p>}
    </header>
  );
}

function CoverSlide({ teamName }: { teamName: string }) {
  return (
    <div className="cover-content">
      <div className="cover-topline"><span className="cover-icon"><Zap size={22} fill="currentColor" /></span><span>SMART ENERGY MANAGEMENT</span></div>
      <div className="cover-main">
        <Eyebrow>PHILIPPINE STARTUP CHALLENGE XI</Eyebrow>
        <h1>Watt<span>Wise</span></h1>
        <p className="cover-subtitle">Appliance-level energy monitoring<br />and control for Filipino homes</p>
        <div className="cover-meta"><span>Presented by</span><strong>{teamName.trim() || "Your Team"}</strong></div>
      </div>
      <Image src="/wattwise_mascot.png" alt="" aria-hidden width={900} height={900} className="cover-brand-art" priority />
      <span className="cover-coordinate">14°35′N&nbsp; 121°00′E</span>
    </div>
  );
}

function ProblemSlide() {
  return (
    <div className="slide-content problem-content">
      <SlideHeading eyebrow="01 / THE PROBLEM" title="A bill shows the total. It rarely shows the story." summary="Households see the peso amount after usage has happened, with little clarity on which appliance drove it." />
      <div className="problem-layout">
        <div className="bill-figure">
          <span className="figure-label">MONTHLY ELECTRICITY BILL</span>
          <strong>₱ ?</strong>
          <div className="bill-rule" />
          <p>One total for the household.<br />Appliance-level visibility is missing.</p>
        </div>
        <div className="problem-points">
          <ProblemPoint number="01" title="Limited visibility" body="The utility meter records total household consumption, not an easy appliance-by-appliance breakdown." />
          <ProblemPoint number="02" title="Late feedback" body="When the bill arrives, a household has already used the energy it is trying to understand." />
          <ProblemPoint number="03" title="Changing rates" body="Monthly rate changes make a static peso-per-kWh assumption unreliable for budgeting." />
        </div>
      </div>
      <p className="source-note">Meralco describes its Appliance Calculator as an estimate based on appliance and usage inputs. WattWise addresses the gap with measured appliance telemetry.</p>
    </div>
  );
}

function ProblemPoint({ number, title, body }: { number: string; title: string; body: string }) {
  return <div className="problem-point"><span>{number}</span><div><h3>{title}</h3><p>{body}</p></div></div>;
}

function SolutionSlide() {
  return (
    <div className="slide-content solution-content">
      <SlideHeading eyebrow="02 / THE SOLUTION" title="See where the electricity goes." summary="WattWise turns appliance readings into useful cost and control decisions." />
      <div className="flow-line" aria-label="How WattWise works">
        <FlowStep number="01" title="Measure" detail="ESP32-S3 with PZEM meter captures voltage, current, power, and cumulative energy." />
        <span className="flow-connector" />
        <FlowStep number="02" title="Understand" detail="A live web dashboard turns readings into usage history and Meralco-aware cost estimates." />
        <span className="flow-connector" />
        <FlowStep number="03" title="Manage" detail="Users set budgets, receive alerts, and control a supported connected appliance." />
      </div>
      <div className="solution-callout"><span className="callout-mark"><Zap size={19} fill="currentColor" /></span><p>One place to monitor appliance use, watch estimated costs, and act on budget limits.</p></div>
      <p className="source-note">Cost figures are budgeting estimates based on stored rate components. WattWise does not replace the utility meter or official bill.</p>
    </div>
  );
}

function FlowStep({ number, title, detail }: { number: string; title: string; detail: string }) {
  return <div className="flow-step"><span className="flow-number">{number}</span><h3>{title}</h3><p>{detail}</p></div>;
}

function ProductSlide() {
  return (
    <div className="slide-content product-content">
      <SlideHeading eyebrow="03 / THE PRODUCT" title="A working loop from appliance to action." summary="The hardware, cloud data flow, and web experience already work together in the prototype." />
      <div className="product-layout">
        <div className="product-feature-list">
          <ProductFeature title="Live appliance readings" detail="Voltage, current, watts, and accumulated kWh." />
          <ProductFeature title="Meralco-aware cost views" detail="Unbundled rate components feed estimated peso costs." />
          <ProductFeature title="Budgets and control" detail="Per-device limits, threshold alerts, and relay commands." />
          <ProductFeature title="Useful guidance" detail="Contextual Taglish insights based on account energy data." />
        </div>
        <div className="meter-visual" aria-label="Example of the live readings shown by WattWise">
          <div className="meter-head"><span className="live-indicator" /> DEVICE TELEMETRY <span className="meter-serial">SAMPLE / ESP32-S3</span></div>
          <div className="meter-main"><div><span>POWER</span><strong>120 W</strong></div><span className="meter-wave">⌁</span></div>
          <div className="meter-divider" />
          <div className="meter-readings"><div><span>VOLTAGE</span><strong>220 V</strong></div><div><span>CURRENT</span><strong>0.55 A</strong></div><div><span>ENERGY</span><strong>1.24 kWh</strong></div></div>
          <div className="meter-bottom"><span>Illustrative sample readings</span><span className="meter-status">CLOUD SYNC</span></div>
        </div>
      </div>
    </div>
  );
}

function ProductFeature({ title, detail }: { title: string; detail: string }) {
  return <div className="product-feature"><span className="feature-tick">✓</span><div><h3>{title}</h3><p>{detail}</p></div></div>;
}

function MarketSlide() {
  return (
    <div className="slide-content market-content">
      <SlideHeading eyebrow="04 / TARGET MARKET" title="Start with connected homes and multi-unit properties." summary="Lead with customers who need visibility into appliance use or consumption by room." />
      <div className="market-stat-row">
        <div className="market-stat"><strong>29.67<span>M</span></strong><p>households in the Philippines</p><small>2024 census</small></div>
        <div className="market-stat market-stat-accent"><strong>12.1<span>M</span></strong><p>households in NCR, CALABARZON, and Central Luzon</p><small>Initial geographic focus · 40.7% of households</small></div>
      </div>
      <div className="market-segments">
        <div><span>01</span><p><strong>Households</strong> tracking high-use appliances and monthly energy spending.</p></div>
        <div><span>02</span><p><strong>Landlords and dorm operators</strong> managing electricity by room or tenant.</p></div>
        <div><span>03</span><p><strong>Small property managers</strong> who need device-level monitoring across units.</p></div>
      </div>
      <p className="source-note">Source: Philippine Statistics Authority, 2024 Census of Population. Regional counts sum to about 12.1M. This is a market-size ceiling, not a sales forecast.</p>
    </div>
  );
}

function BusinessModelSlide() {
  return (
    <div className="slide-content model-content">
      <SlideHeading eyebrow="05 / BUSINESS MODEL" title="Hardware opens the door. Software keeps the service useful." summary="A proposed model combines device revenue with recurring monitoring and property-management services." />
      <div className="model-layout">
        <div className="revenue-streams">
          <div className="revenue-stream"><span className="stream-index">01</span><div><h3>Hardware</h3><p>One-time sale of an assembled WattWise monitoring unit. Installation may be quoted separately.</p></div><strong>₱3,500–₱5,000<span> proposed per unit</span></strong></div>
          <div className="revenue-stream"><span className="stream-index">02</span><div><h3>Household plan</h3><p>Basic monitoring, with optional paid history, alerts, and expanded insights.</p></div><strong>₱99–₱199<span> proposed / month</span></strong></div>
          <div className="revenue-stream"><span className="stream-index">03</span><div><h3>Property plan</h3><p>Fleet dashboard and room or tenant workflows priced by active device.</p></div><strong>To validate<span> with pilot buyers</span></strong></div>
        </div>
        <aside className="model-note"><Eyebrow>POSITIONING</Eyebrow><p>Existing products offer appliance estimates or smart-plug monitoring. WattWise combines locally relevant cost estimates with per-device budget workflows and multi-unit management.</p><small>Pricing and differentiation require customer validation.</small></aside>
      </div>
      <p className="source-note">Alternatives include Meralco’s Appliance Calculator, TP-Link Tapo energy-monitoring plugs, and Lumi’s household electricity app.</p>
    </div>
  );
}

function ProgressSlide() {
  return (
    <div className="slide-content progress-content">
      <SlideHeading eyebrow="06 / PROGRESS & IMPACT" title="Prototype built. Pilot evidence is the next milestone." summary="WattWise has a working ESP32-to-cloud-to-dashboard flow. No paid customer or pilot results are being claimed yet." />
      <div className="progress-columns">
        <section className="progress-column"><Eyebrow>BUILT IN THE PROTOTYPE</Eyebrow><ul><li>ESP32-S3 appliance telemetry with PZEM readings</li><li>Supabase storage and a live WattWise web dashboard</li><li>Meralco component-based cost estimates and budget flows</li><li>Relay control, alerts, and Taglish energy insights</li></ul></section>
        <section className="progress-column pilot-column"><Eyebrow>SIX-MONTH PILOT TARGETS</Eyebrow><ul><li>30 households or monitored rooms</li><li>At least 95% telemetry availability</li><li>Readings within ±5% of a reference meter in controlled checks</li><li>Measure usage changes and willingness to pay</li></ul></section>
      </div>
      <div className="sdg-band"><span className="sdg-number">7</span><div><strong>Affordable and Clean Energy</strong><p>Support energy efficiency through timely feedback on electricity use.</p></div><span className="sdg-number sdg-secondary">12</span><div><strong>Responsible Consumption</strong><p>Help households make informed decisions about energy consumption.</p></div></div>
    </div>
  );
}

function FundingSlide() {
  const uses = [
    ["Pilot hardware · 30 units", "₱120,000", 48],
    ["Installation and validation", "₱35,000", 14],
    ["Enclosure and hardware iteration", "₱20,000", 8],
    ["Cloud and software operations", "₱20,000", 8],
    ["Pilot operations and support", "₱25,000", 10],
    ["Contingency", "₱30,000", 12],
  ] as const;
  return (
    <div className="slide-content funding-content">
      <SlideHeading eyebrow="07 / USE OF FUNDS" title="₱250,000 to validate a six-month pilot." summary="Funding will move the prototype into a measured field trial and establish real hardware cost, reliability, and willingness to pay." />
      <div className="funding-layout">
        <div className="funding-chart" aria-label="Proposed allocation of 250,000 pesos">
          {uses.map(([label, amount, percent]) => <div className="fund-row" key={label}><div className="fund-label"><span>{label}</span><strong>{amount}</strong></div><div className="fund-track"><span style={{ width: `${percent}%` }} /></div></div>)}
        </div>
        <aside className="ask-total"><span>PROPOSED ASK</span><strong>₱250K</strong><p>30 pilot units<br />6 months<br />NCR / CALABARZON / Central Luzon</p><small>Planning estimate. Confirm with supplier and installation quotations.</small></aside>
      </div>
    </div>
  );
}
