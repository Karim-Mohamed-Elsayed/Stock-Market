import type { Metadata } from "next";
import Link from "next/link";

import btn from "@/components/Button.module.css";
import styles from "./about.module.css";

export const metadata: Metadata = {
  title: "About Us — Meridian Axiom",
  description:
    "Meet the six-person team behind Meridian Axiom and the story of why we turned an S&P 500 data pipeline into a live market dashboard.",
};

const WHY = [
  {
    title: "Turn raw data into something usable",
    text: "We had built a full medallion data pipeline for the S&P 500 — but a pile of Parquet files isn't a product. We wanted to put a real interface on top of all that engineering.",
    icon: (
      <path
        d="M4 15l4-5 3 3 6-8 3 4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    ),
  },
  {
    title: "Make market analytics approachable",
    text: "Indicators like RSI, MACD, and moving-average crosses are powerful but intimidating. We wanted to surface them clearly, in plain language, so anyone can read the market at a glance.",
    icon: (
      <>
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" fill="none" />
        <path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </>
    ),
  },
  {
    title: "Learn by building end to end",
    text: "As a team we wanted to own the whole stack — ingestion, transformation, an API, auth, and a polished frontend — and ship it as one coherent, working product.",
    icon: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.7" fill="none" />
        <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.7" fill="none" />
        <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.7" fill="none" />
        <rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.7" fill="none" />
      </>
    ),
  },
];

interface Member {
  name: string;
  initials: string;
  role: string;
  bio: string;
  why: string;
}

// Placeholder cards — each developer can replace their name, bio, and note.
const TEAM: Member[] = [
  {
    name: "Team Member One",
    initials: "01",
    role: "Data Engineering",
    bio: "Designed the medallion pipeline — scraping the constituent list, ingesting OHLCV data, and staging it through the Bronze, Silver, and Gold layers.",
    why: "\"I love the moment messy raw data becomes something clean and trustworthy that other people can actually build on.\"",
  },
  {
    name: "Team Member Two",
    initials: "02",
    role: "Backend & API",
    bio: "Built the FastAPI service — the endpoints for tickers, prices, sectors, and live quotes that the whole frontend runs on.",
    why: "\"A fast, well-shaped API is invisible when it works — and that quiet reliability is exactly what I wanted to get right.\"",
  },
  {
    name: "Team Member Three",
    initials: "03",
    role: "Frontend & UI",
    bio: "Crafted the Next.js interface — the charts, dashboards, and the overall look and feel of the dashboard you're using now.",
    why: "\"Data only matters if people can read it. I wanted the market to feel legible, not overwhelming.\"",
  },
  {
    name: "Team Member Four",
    initials: "04",
    role: "Data Analysis",
    bio: "Defined and validated the technical indicators — SMA, RSI-14, MACD, volatility, and the Golden/Death Cross signals.",
    why: "\"Getting the math right so a signal means what it claims to mean was the part I cared about most.\"",
  },
  {
    name: "Team Member Five",
    initials: "05",
    role: "Cloud & DevOps",
    bio: "Wired up the infrastructure — Airflow orchestration, AWS S3 storage, Supabase, and the deployments that keep everything running.",
    why: "\"Turning a project that runs on one laptop into something that runs reliably in the cloud is a puzzle I really enjoy.\"",
  },
  {
    name: "Team Member Six",
    initials: "06",
    role: "Product & QA",
    bio: "Shaped the product experience and tested the golden paths — from browsing a chart to signing up and saving a watchlist.",
    why: "\"I wanted every corner of the app to feel intentional, and to break things before our users ever could.\"",
  },
];

function LinkedInIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M6.94 5a2 2 0 1 1-4-.02 2 2 0 0 1 4 .02zM7 8.48H3V21h4V8.48zm6.32 0H9.34V21h3.94v-6.57c0-3.66 4.77-4 4.77 0V21H22v-7.93c0-6.17-7.06-5.94-8.72-2.91l.04-1.68z" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2C6.48 2 2 6.58 2 12.25c0 4.53 2.87 8.37 6.84 9.73.5.1.68-.22.68-.49 0-.24-.01-.87-.01-1.71-2.78.62-3.37-1.37-3.37-1.37-.46-1.18-1.11-1.5-1.11-1.5-.9-.64.07-.62.07-.62 1 .07 1.53 1.05 1.53 1.05.89 1.56 2.34 1.11 2.91.85.09-.66.35-1.11.63-1.37-2.22-.26-4.56-1.14-4.56-5.06 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05a9.36 9.36 0 0 1 5 0c1.91-1.33 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.93-2.34 4.79-4.57 5.05.36.32.68.94.68 1.9 0 1.37-.01 2.48-.01 2.82 0 .27.18.6.69.49A10.02 10.02 0 0 0 22 12.25C22 6.58 17.52 2 12 2z" />
    </svg>
  );
}

export default function AboutPage() {
  return (
    <main className={`container ${styles.wrap}`}>
      {/* Hero */}
      <section className={styles.hero}>
        <span className={styles.eyebrow}>Our story</span>
        <h1 className={styles.title}>
          We built the dashboard we wished existed.
        </h1>
        <p className={styles.lead}>
          Meridian Axiom started as a data-engineering project and grew into a
          full market dashboard for the S&amp;P 500. We&apos;re a team of six who
          wanted to take a pile of raw market data all the way to a product you
          can actually use — and learn the entire stack while doing it.
        </p>
      </section>

      {/* Why we made this */}
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <div className={styles.sectionLabel}>Why we made this</div>
          <h2 className={styles.sectionTitle}>From a data pipeline to a product</h2>
          <p className={styles.sectionSubtitle}>
            The engineering was only half the challenge. Here&apos;s what drove
            us to turn it into something people can open in a browser.
          </p>
        </div>
        <div className={styles.why}>
          {WHY.map((item) => (
            <div key={item.title} className={styles.whyCard}>
              <span className={styles.whyIcon}>
                <svg width="22" height="22" viewBox="0 0 24 24">
                  {item.icon}
                </svg>
              </span>
              <div className={styles.whyTitle}>{item.title}</div>
              <p className={styles.whyText}>{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Stats */}
      <section className={styles.section}>
        <div className={styles.stats}>
          <div className={styles.statItem}>
            <div className={styles.statValue}>500+</div>
            <span className={styles.statLabel}>Tickers tracked</span>
          </div>
          <div className={styles.statItem}>
            <div className={styles.statValue}>11</div>
            <span className={styles.statLabel}>GICS sectors</span>
          </div>
          <div className={styles.statItem}>
            <div className={styles.statValue}>6</div>
            <span className={styles.statLabel}>Technical indicators</span>
          </div>
          <div className={styles.statItem}>
            <div className={styles.statValue}>6</div>
            <span className={styles.statLabel}>People on the team</span>
          </div>
        </div>
      </section>

      {/* Team */}
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <div className={styles.sectionLabel}>The team</div>
          <h2 className={styles.sectionTitle}>Meet the builders</h2>
          <p className={styles.sectionSubtitle}>
            Six people, one stack — from data ingestion to the interface in
            front of you.
          </p>
        </div>
        <div className={styles.team}>
          {TEAM.map((member) => (
            <article key={member.name} className={styles.member}>
              <div className={styles.avatar}>{member.initials}</div>
              <div className={styles.memberName}>{member.name}</div>
              <div className={styles.memberRole}>{member.role}</div>
              <p className={styles.memberBio}>{member.bio}</p>
              <div className={styles.memberWhyLabel}>In their words</div>
              <p className={styles.memberWhy}>{member.why}</p>
              <div className={styles.memberLinks}>
                <a
                  href="#"
                  className={styles.memberLink}
                  aria-label={`${member.name} on LinkedIn`}
                >
                  <LinkedInIcon />
                </a>
                <a
                  href="#"
                  className={styles.memberLink}
                  aria-label={`${member.name} on GitHub`}
                >
                  <GitHubIcon />
                </a>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Closing CTA */}
      <section className={styles.cta}>
        <div className={styles.ctaTitle}>Explore what we built</div>
        <p className={styles.ctaText}>
          Dive into live charts, sector rankings, and technical analytics for the
          entire S&amp;P 500 — no account required to look around.
        </p>
        <div className={styles.ctaActions}>
          <Link href="/markets/AAPL" className={`${btn.btn} ${btn.primary} ${btn.lg}`}>
            Explore the markets
          </Link>
          <Link href="/faq" className={`${btn.btn} ${btn.secondary} ${btn.lg}`}>
            Read the FAQ
          </Link>
        </div>
      </section>
    </main>
  );
}
