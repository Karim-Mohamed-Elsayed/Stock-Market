"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";

import styles from "./TickerList.module.css";
import TickerLogo from "./TickerLogo";
import { listTickerQuotes, type QuoteOut } from "@/lib/api";

interface Props {
  tickers: string[];
  activeTicker: string;
  isOpen?: boolean;
  onClose?: () => void;
}

export default function TickerList({ tickers, activeTicker, isOpen = false, onClose }: Props) {
  const [filter, setFilter] = useState("");
  const [quotes, setQuotes] = useState<Record<string, QuoteOut>>({});

  useEffect(() => {
    listTickerQuotes()
      .then((data) => setQuotes(data))
      .catch(() => {
        // fail quiet
      });
  }, []);

  const filtered = useMemo(() => {
    const needle = filter.trim().toUpperCase();
    if (!needle) return tickers;
    return tickers.filter((ticker) => ticker.includes(needle));
  }, [tickers, filter]);

  return (
    <aside className={`${styles.aside} ${isOpen ? styles.asideOpen : ""}`}>
      <div className={styles.asideHeader}>
        <input
          type="text"
          className={styles.filter}
          placeholder="Filter tickers…"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        />
        {onClose && (
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close watchlist"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>
      <div className={styles.count}>
        {filtered.length} of {tickers.length} tickers
      </div>

      <div className={styles.tableHeader}>
        <span className={styles.colSymbol}>Symbol</span>
        <span className={styles.colLast}>Last</span>
        <span className={styles.colChg}>Chg</span>
        <span className={styles.colChgPct}>Chg%</span>
      </div>

      <ul className={styles.list}>
        {filtered.map((ticker) => {
          const q = quotes[ticker];
          const priceStr = q?.price != null ? q.price.toFixed(2) : "—";
          const changeStr = q?.change != null ? (q.change >= 0 ? "+" : "") + q.change.toFixed(2) : "—";
          const changePctStr = q?.change_percent != null ? (q.change_percent >= 0 ? "+" : "") + q.change_percent.toFixed(2) + "%" : "—";
          const isGain = q?.change != null ? q.change >= 0 : null;

          return (
            <li key={ticker}>
              <Link
                href={`/markets/${ticker}`}
                className={`${styles.item} ${ticker === activeTicker ? styles.itemActive : ""}`}
              >
                <div className={styles.colSymbol}>
                  <TickerLogo
                    ticker={ticker}
                    className={styles.logo}
                    size={28}
                  />
                  <span className={styles.symbolName}>{ticker}</span>
                </div>
                <div className={styles.colLast}>
                  {priceStr}
                </div>
                <div className={`${styles.colChg} ${isGain === true ? styles.gain : isGain === false ? styles.loss : ""}`}>
                  {changeStr}
                </div>
                <div className={`${styles.colChgPct} ${isGain === true ? styles.gain : isGain === false ? styles.loss : ""}`}>
                  {changePctStr}
                </div>
              </Link>
            </li>
          );
        })}
        {filtered.length === 0 && <li className={styles.empty}>No matches.</li>}
      </ul>
    </aside>
  );
}

