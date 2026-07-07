"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import CandlestickChart from "@/components/CandlestickChart";
import SectorPreview from "@/components/SectorPreview";
import TickerTape from "@/components/TickerTape";
import TickerLogo from "@/components/TickerLogo";
import { getHistoryOhlc, type Interval, type OhlcHistoryPoint } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import btn from "@/components/Button.module.css";

import styles from "./page.module.css";

const FEATURES = [
  {
    title: "Live quotes",
    text: "On-demand quotes pulled straight from the market, cached for a fast, low-latency read.",
    icon: (
      <path
        d="M4 15l4-5 3 3 6-8 3 4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    ),
  },
  {
    title: "Technical indicators",
    text: "SMA 50/200, RSI-14, MACD, and Golden/Death Cross signals computed daily and hourly.",
    icon: (
      <path
        d="M3 12h3l2 5 4-14 2 9h4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    ),
  },
  {
    title: "Sector heatmap",
    text: "Daily returns rolled up across all 11 GICS sectors, so you can see where money is moving.",
    icon: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.6" fill="none" />
        <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.6" fill="none" />
        <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.6" fill="none" />
        <rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.6" fill="none" />
      </>
    ),
  },
  {
    title: "Personal watchlists",
    text: "Save the tickers you track. Your list follows you across sessions, backed by your account.",
    icon: (
      <path
        d="M12 4l2.2 4.8 5.1.5-3.8 3.6 1 5.1L12 15.6 7.5 18l1-5.1L4.7 9.3l5.1-.5z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        fill="none"
      />
    ),
  },
];

const STEPS = [
  {
    title: "Create your account",
    text: "Sign up with an email and password. No brokerage link, no card required.",
  },
  {
    title: "Browse the market",
    text: "Search the S&P 500, filter by GICS sector, and drill into a ticker's price history and indicators.",
  },
  {
    title: "Build your watchlist",
    text: "Save tickers you care about and check back on live quotes whenever you sign in.",
  },
];

export default function Home() {
  const { profile, isLoading } = useAuth();
  const isLoggedIn = !isLoading && profile !== null;

  const [interval, setInterval] = useState<Interval>("daily");
  const [nvdaData, setNvdaData] = useState<OhlcHistoryPoint[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    getHistoryOhlc("NVDA", interval)
      .then((points) => {
        if (!cancelled) setNvdaData(points);
      })
      .catch(() => {
        if (!cancelled) setNvdaData(null);
      });
    return () => {
      cancelled = true;
    };
  }, [interval]);

  return (
    <main>
      <TickerTape />

      <section className={styles.hero}>
        <div className={`${styles.fullContainer} ${styles.heroGrid}`}>
          <div>
            <span className={styles.eyebrow}>
              <span className={styles.dot} />
              S&amp;P 500 coverage, updated daily
            </span>
            <h1 className={styles.title}>
              Data-driven insights to time
              <br />
              your next big trade.
            </h1>
            <p className={styles.subtitle}>
              Axiom tracks every S&amp;P 500 constituent, layers on the
              technical indicators traders actually use, and lets you save a
              watchlist — all in one dashboard.
            </p>
            <div className={styles.heroActions}>
              {!isLoggedIn && (
                <>
                  <Link href="/register" className={`${btn.btn} ${btn.primary} ${btn.lg}`}>
                    Create free account
                  </Link>
                  <Link href="/login" className={`${btn.btn} ${btn.secondary} ${btn.lg}`}>
                    Log in
                  </Link>
                </>
              )}
            </div>
            <div className={styles.heroMeta}>
              <div className={styles.heroMetaItem}>
                <span className={styles.heroMetaValue}>500+</span>
                <span className={styles.heroMetaLabel}>Tickers tracked</span>
              </div>
              <div className={styles.heroMetaItem}>
                <span className={styles.heroMetaValue}>11</span>
                <span className={styles.heroMetaLabel}>GICS sectors</span>
              </div>
              <div className={styles.heroMetaItem}>
                <span className={styles.heroMetaValue}>6</span>
                <span className={styles.heroMetaLabel}>Technical indicators</span>
              </div>
              <div className={styles.heroMetaItem}>
                <span className={styles.heroMetaValue}>Daily / hourly</span>
                <span className={styles.heroMetaLabel}>Update cadence</span>
              </div>
            </div>
          </div>

          <div className={styles.panel}>
            <div className={styles.panelHeader} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div className={styles.panelTitle} style={{ flexDirection: 'row', alignItems: 'center', gap: '8px' }}>
                <TickerLogo ticker="NVDA" size={18} />
                <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'baseline', gap: '6px' }}>
                  <span className={styles.panelSymbol}>NVDA</span>
                  <span className={styles.panelName}>NVIDIA Corp</span>
                </div>
              </div>
              <div className={styles.panelChip} style={{ margin: 0 }}>
                <button 
                  className={`${styles.chip} ${interval === "daily" ? styles.chipActive : ""}`} 
                  onClick={() => setInterval("daily")}
                >
                  1D
                </button>
                <button 
                  className={`${styles.chip} ${interval === "hourly" ? styles.chipActive : ""}`} 
                  onClick={() => setInterval("hourly")}
                >
                  1H
                </button>
              </div>
            </div>
            <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
              {nvdaData ? (
                <CandlestickChart 
                  symbol="NVDA" 
                  interval={interval} 
                  data={nvdaData} 
                  showSma1={false} 
                  showSma2={false} 
                  showRsi={false} 
                  showVolume={false}
                  showLegend={false} 
                />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-tertiary)' }}>Loading...</div>
              )}
            </div>
            <Link href="/markets/NVDA" className={styles.panelLink}>
              View live NVDA chart &rarr;
            </Link>
          </div>
        </div>
      </section>

      <section className={styles.section} id="features">
        <div className={styles.fullContainer}>
          <div className={styles.sectionHead}>
            <div className={styles.sectionLabel}>Platform</div>
            <h2 className={styles.sectionTitle}>Everything the dashboard needs, nothing it doesn&apos;t</h2>
            <p className={styles.sectionSubtitle}>
              Built on a medallion data pipeline that scrapes, cleans, and
              scores the S&amp;P 500 — surfaced through a fast API.
            </p>
          </div>

          <div className={styles.features}>
            {FEATURES.map((feature) => (
              <div className={styles.feature} key={feature.title}>
                <span className={styles.featureIcon}>
                  <svg width="18" height="18" viewBox="0 0 24 24">
                    {feature.icon}
                  </svg>
                </span>
                <span className={styles.featureTitle}>{feature.title}</span>
                <p className={styles.featureText}>{feature.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.section} id="sectors">
        <div className={styles.fullContainer}>
          <div className={styles.sectionHead}>
            <div className={styles.sectionLabel}>Sector performance</div>
            <h2 className={styles.sectionTitle}>See where the market is moving</h2>
            <p className={styles.sectionSubtitle}>
              Average daily return rolled up by GICS sector, computed from the
              Gold layer of the data pipeline.
            </p>
          </div>
          <SectorPreview />
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '32px' }}>
            <Link href="/insights" className={`${btn.btn} ${btn.primary}`}>
              See more insights
            </Link>
          </div>
        </div>
      </section>

      <section className={styles.section} id="markets">
        <div className={styles.fullContainer}>
          <div className={styles.sectionHead}>
            <div className={styles.sectionLabel}>How it works</div>
            <h2 className={styles.sectionTitle}>Set up in three steps</h2>
          </div>

          <div className={styles.steps}>
            {STEPS.map((step, index) => (
              <div className={styles.step} key={step.title}>
                <div className={styles.stepIndex}>{`0${index + 1}`}</div>
                <div className={styles.stepTitle}>{step.title}</div>
                <p className={styles.stepText}>{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.cta}>
        <div className={styles.fullContainer}>
          <div className={styles.ctaCard}>
            <div>
              <div className={styles.ctaTitle}>Ready to track the market your way?</div>
              <p className={styles.ctaText}>
                Create a free account and start building your watchlist in
                under a minute.
              </p>
            </div>
            <div className={styles.ctaActions}>
              {!isLoggedIn && (
                <Link href="/register" className={`${btn.btn} ${btn.primary} ${btn.lg}`}>
                  Create free account
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
