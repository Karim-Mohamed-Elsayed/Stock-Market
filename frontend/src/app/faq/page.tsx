"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";

import btn from "@/components/Button.module.css";
import styles from "./faq.module.css";

interface QA {
  q: string;
  a: ReactNode;
}

interface FaqGroup {
  id: string;
  title: string;
  items: QA[];
}

const GROUPS: FaqGroup[] = [
  {
    id: "getting-started",
    title: "Getting started",
    items: [
      {
        q: "What is Meridian Axiom?",
        a: (
          <>
            Meridian Axiom is a market dashboard for the{" "}
            <strong>S&amp;P 500</strong>. It tracks every constituent of the
            index, layers on the technical indicators traders actually use,
            rolls returns up by sector, and lets you save a personal watchlist
            all in one place. It grew out of a data-engineering project into a
            full product you can browse in your browser.
          </>
        ),
      },
      {
        q: "Do I need an account to use it?",
        a: (
          <>
            No. Browsing the market  charts, indicators, sector rankings, and
            the insights dashboards  is completely open and requires no login.
            You only need a free account to build a{" "}
            <strong>personal watchlist</strong>, which is then saved to your
            profile and follows you across sessions and devices.
          </>
        ),
      },
      {
        q: "How much does it cost?",
        a: (
          <>
            Meridian Axiom is free to use. It was built as an educational
            data-engineering and full-stack project, not a commercial product,
            so there are no paid tiers or subscriptions.
          </>
        ),
      },
    ],
  },
  {
    id: "data",
    title: "Data & coverage",
    items: [
      {
        q: "Where does the data come from?",
        a: (
          <>
            The list of companies in the index is scraped from the public{" "}
            <strong>Wikipedia S&amp;P 500 constituents</strong> table, and the
            price history (open, high, low, close, volume) is pulled from{" "}
            <strong>Yahoo Finance</strong> via the <code>yfinance</code>{" "}
            library. Everything is then cleaned and enriched through our own data
            pipeline before it reaches the site.
          </>
        ),
      },
      {
        q: "How often is the data updated?",
        a: (
          <>
            There are two paths. Historical prices and indicators are recomputed
            in <strong>daily</strong> and <strong>hourly</strong> batches by the
            pipeline. Live quotes on the ticker pages are fetched{" "}
            <strong>on demand</strong> straight from the market and cached for
            roughly 30–60 seconds, so they stay near real-time without hammering
            the upstream source.
          </>
        ),
      },
      {
        q: "Are the prices real-time?",
        a: (
          <>
            They are <strong>near</strong> real-time, not exchange-grade tick
            data. Live quotes refresh on a short cache (about 30–60 seconds) and
            may be delayed. The candlestick charts and indicators are built from
            the daily and hourly batch data. Treat everything on the site as
            slightly delayed and informational.
          </>
        ),
      },
      {
        q: "Which companies are covered?",
        a: (
          <>
            All ~500 constituents of the S&amp;P 500, grouped across the{" "}
            <strong>11 GICS sectors</strong>. The constituent list refreshes
            with the pipeline, so additions and removals from the index are
            picked up over time.
          </>
        ),
      },
    ],
  },
  {
    id: "indicators",
    title: "Indicators & analytics",
    items: [
      {
        q: "Which technical indicators do you calculate?",
        a: (
          <>
            For each ticker the pipeline computes{" "}
            <strong>SMA 50 &amp; SMA 200</strong> (simple moving averages),{" "}
            <strong>RSI-14</strong> (Relative Strength Index),{" "}
            <strong>MACD</strong> (the MACD line and its signal line),{" "}
            <strong>Golden / Death Cross</strong> signals, daily returns, and a{" "}
            <strong>30-day rolling volatility</strong> (standard deviation of
            returns).
          </>
        ),
      },
      {
        q: "What do \"overbought\" and \"oversold\" mean?",
        a: (
          <>
            Those labels come from the RSI. By convention an{" "}
            <strong>RSI at or above 70</strong> is considered{" "}
            <strong>overbought</strong> (the stock may have run up too fast),
            and an <strong>RSI at or below 30</strong> is considered{" "}
            <strong>oversold</strong> (it may have been sold off too hard). The
            Insights page ranks tickers by RSI and flags each one accordingly.
            These are signals, not guarantees.
          </>
        ),
      },
      {
        q: "What is a Golden Cross or Death Cross?",
        a: (
          <>
            Both are moving-average crossover signals. A{" "}
            <strong>Golden Cross</strong> is when the shorter 50-day average
            crosses <em>above</em> the longer 200-day average  often read as
            bullish momentum. A <strong>Death Cross</strong> is the opposite: the
            50-day crossing <em>below</em> the 200-day, often read as bearish.
          </>
        ),
      },
      {
        q: "What is the sector heatmap?",
        a: (
          <>
            Every company is tagged with its <strong>GICS sector</strong>. The
            pipeline averages the daily returns of all tickers within each of the
            11 sectors, so you can see at a glance where money is flowing on a
            given day. You&apos;ll find the full ranking, plus expandable
            per-sector ticker lists, on the{" "}
            <Link href="/insights">Insights &amp; Analytics</Link> page.
          </>
        ),
      },
      {
        q: "What does the volatility figure represent?",
        a: (
          <>
            It&apos;s the <strong>rolling 30-day standard deviation</strong> of a
            ticker&apos;s daily returns  a common way to measure how much a
            stock&apos;s price has been swinging recently. Higher values mean a
            choppier, riskier ride; lower values mean a steadier one.
          </>
        ),
      },
    ],
  },
  {
    id: "insights-analytics",
    title: "Insights & Analytics guide",
    items: [
      {
        q: "How do I use the Deep-Dive Ticker Analytics section?",
        a: (
          <>
            Use the <strong>ticker dropdown</strong> at the top right to switch
            between any S&amp;P 500 stock  both dashboards update instantly.
            Start with a stock you follow (e.g. <strong>AAPL</strong>) and check
            whether its RSI is above 70 (potentially overbought) or below 30
            (potentially oversold). Then cross-reference that with the MACD: if
            both signal the same direction, the case is stronger.
          </>
        ),
      },
      {
        q: "How do I read the Risk & Return Performance Dashboard?",
        a: (
          <>
            There are two panels.
            <br /><br />
            <strong>Top dual-axis chart:</strong> The <em>blue line</em> (left
            axis) is the daily return %  positive means the stock gained that
            day, negative means it fell. The <em>orange line</em> (right axis)
            is the 30-day rolling volatility. When it spikes, the stock is in a
            high-swing period regardless of direction.
            <br /><br />
            <strong>Bottom histogram:</strong> Shows how often each return range
            occurred across the full price history. A narrow peak near 0% means
            a steady stock; a wide, flat spread means high volatility. A
            right-skewed histogram (more mass on the positive side) suggests the
            stock historically drifts upward.
          </>
        ),
      },
      {
        q: "How do I read the RSI chart?",
        a: (
          <>
            RSI oscillates between <strong>0 and 100</strong>. Two zones matter:
            <br /><br />
            <strong>Red zone (70–100)  Overbought:</strong> The stock has risen
            much faster than it has fallen over 14 days. A pullback risk is
            elevated. Many traders tighten stop-losses or reduce position size
            here.
            <br /><br />
            <strong>Green zone (0–30)  Oversold:</strong> The stock has dropped
            hard. This can be a contrarian entry signal, especially when the MACD
            histogram begins turning positive from below zero.
            <br /><br />
            When RSI crosses back <em>below</em> 70 after being above it, or
            back <em>above</em> 30 after being below it, traders treat those
            crossings as actionable triggers.
          </>
        ),
      },
      {
        q: "How do I read the MACD chart?",
        a: (
          <>
            Three components to know:
            <br /><br />
            <strong>MACD Line (blue):</strong> The 12-day EMA minus the 26-day
            EMA. Above zero = short-term momentum outpacing long-term (bullish).
            Below zero = the reverse (bearish).
            <br /><br />
            <strong>Signal Line (red):</strong> A 9-day EMA of the MACD line.
            When the blue line crosses <em>above</em> the red, that is a classic{" "}
            <strong>buy crossover</strong>. When it crosses <em>below</em>, that
            is a <strong>sell crossover</strong>.
            <br /><br />
            <strong>Histogram bars:</strong> The gap between the two lines. Blue
            bars growing means bullish momentum is accelerating; red bars growing
            means bearish momentum is building. Shrinking bars often precede a
            crossover  watch for that as an early warning.
          </>
        ),
      },
      {
        q: "How do I read the Sector Performance Ranking table?",
        a: (
          <>
            Each row is one of the <strong>11 GICS sectors</strong> and shows
            its <strong>average daily return</strong>  the mean price change of
            all member stocks on the latest trading day. Green = net inflows,
            red = net outflows. Click a row to expand it and see which tickers
            belong to that sector, each linking to its full market page. Click
            the <em>Avg Daily Return</em> column header to reverse the sort.
          </>
        ),
      },
      {
        q: "How do I use the Ticker Rankings table?",
        a: (
          <>
            Toggle between two modes with the <strong>RSI / Volatility</strong>{" "}
            switch at the top of the table:
            <br /><br />
            <strong>RSI mode:</strong> Lists every S&amp;P 500 stock ranked by
            its current RSI-14. Top = most overbought, bottom = most oversold.
            The Status column flags Overbought / Neutral / Oversold so you can
            scan the extremes at a glance without opening each stock page.
            <br /><br />
            <strong>Volatility mode:</strong> Lists stocks by their 30-day
            rolling standard deviation of returns. Top = wildest movers. Use
            this to gauge risk before entering a position  if a stock ranks in
            the top 10, expect large daily swings. Click the column header to
            flip sort order. Use the search icon to jump to a specific ticker.
          </>
        ),
      },
    ],
  },
  {
    id: "account",
    title: "Accounts & watchlists",
    items: [
      {
        q: "How do watchlists work?",
        a: (
          <>
            Once you&apos;re signed in you can save any ticker to your
            watchlist. The list is tied to your account and persists across
            sessions, so it&apos;s there every time you come back  from any
            device.
          </>
        ),
      },
      {
        q: "Is my account secure?",
        a: (
          <>
            Authentication is handled by <strong>Supabase Auth</strong> using
            signed JSON Web Tokens (JWT), and every watchlist is protected by{" "}
            <strong>row-level security</strong> in the database  meaning you can
            only ever read or modify your own saved tickers, never anyone
            else&apos;s.
          </>
        ),
      },
    ],
  },
  {
    id: "technical",
    title: "Under the hood",
    items: [
      {
        q: "How is the platform built?",
        a: (
          <>
            The site is a <strong>Next.js + React</strong> frontend talking to a{" "}
            <strong>FastAPI</strong> backend. Data lives in{" "}
            <strong>Supabase</strong> (managed Postgres + Auth). Behind that, a{" "}
            medallion data pipeline (Bronze → Silver → Gold) built with{" "}
            <strong>PySpark</strong> and orchestrated by{" "}
            <strong>Apache Airflow</strong> ingests, cleans, and scores the raw
            market data, staging it on <strong>AWS S3</strong> before it&apos;s
            loaded into the database.
          </>
        ),
      },
      {
        q: "What is a medallion pipeline?",
        a: (
          <>
            It&apos;s a layered approach to data engineering. The{" "}
            <strong>Bronze</strong> layer holds the raw scraped data, the{" "}
            <strong>Silver</strong> layer holds it cleaned and standardized, and
            the <strong>Gold</strong> layer holds the finished, analysis-ready
            tables  the indicators and sector aggregates you actually see on the
            site. Each layer builds on the one before it.
          </>
        ),
      },
    ],
  },
  {
    id: "legal",
    title: "Using the data responsibly",
    items: [
      {
        q: "Is any of this investment advice?",
        a: (
          <>
            <strong>No.</strong> Nothing on Meridian Axiom is investment,
            financial, legal, or tax advice, and nothing here is a
            recommendation to buy or sell any security. All data is provided for{" "}
            <strong>informational and educational purposes only</strong>, may be
            delayed or contain errors, and should never be your sole basis for a
            decision. Always do your own research and consider consulting a
            licensed professional.
          </>
        ),
      },
    ],
  },
];

export default function FaqPage() {
  const [open, setOpen] = useState<string | null>("getting-started-0");

  function toggle(key: string) {
    setOpen((prev) => (prev === key ? null : key));
  }

  return (
    <main className={`container ${styles.wrap}`}>
      <div className={styles.head}>
        <span className={styles.eyebrow}>Help center</span>
        <h1 className={styles.title}>Frequently asked questions</h1>
        <p className={styles.subtitle}>
          Everything you might want to know about where our numbers come from,
          what the indicators mean, and how the platform is put together.
        </p>
      </div>

      <div className={styles.layout}>
        <nav className={styles.nav} aria-label="FAQ sections">
          <div className={styles.navHeading}>On this page</div>
          {GROUPS.map((group) => (
            <a key={group.id} href={`#${group.id}`} className={styles.navLink}>
              {group.title}
            </a>
          ))}
        </nav>

        <div className={styles.groups}>
          {GROUPS.map((group) => (
            <section key={group.id} id={group.id} className={styles.group}>
              <h2 className={styles.groupTitle}>{group.title}</h2>
              <div className={styles.list}>
                {group.items.map((item, idx) => {
                  const key = `${group.id}-${idx}`;
                  const isOpen = open === key;
                  return (
                    <div
                      key={key}
                      className={`${styles.item} ${isOpen ? styles.open : ""}`}
                    >
                      <button
                        type="button"
                        className={styles.question}
                        onClick={() => toggle(key)}
                        aria-expanded={isOpen}
                      >
                        <span>{item.q}</span>
                        <svg
                          className={styles.icon}
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <line x1="12" y1="5" x2="12" y2="19" />
                          <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                      </button>
                      {isOpen && <div className={styles.answer}>{item.a}</div>}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>

      <div className={styles.contact}>
        <div className={styles.contactTitle}>Still have a question?</div>
        <p className={styles.contactText}>
          Can&apos;t find what you&apos;re looking for? Learn more about the team
          and the project, or reach out directly.
        </p>
        <div
          style={{
            display: "flex",
            gap: "12px",
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <Link href="/about" className={`${btn.btn} ${btn.primary}`}>
            About us
          </Link>
          <a
            href="mailto:hello@meridianaxiom.markets"
            className={`${btn.btn} ${btn.secondary}`}
          >
            Contact us
          </a>
        </div>
      </div>

      <p className={styles.disclaimer}>
        Market data may be delayed and is provided for informational purposes
        only. Nothing on this site is investment advice.
      </p>
    </main>
  );
}
