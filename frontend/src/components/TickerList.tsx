"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import styles from "./TickerList.module.css";

interface Props {
  tickers: string[];
  activeTicker: string;
}

export default function TickerList({ tickers, activeTicker }: Props) {
  const [filter, setFilter] = useState("");

  const filtered = useMemo(() => {
    const needle = filter.trim().toUpperCase();
    if (!needle) return tickers;
    return tickers.filter((ticker) => ticker.includes(needle));
  }, [tickers, filter]);

  return (
    <aside className={styles.aside}>
      <input
        type="text"
        className={styles.filter}
        placeholder="Filter tickers…"
        value={filter}
        onChange={(event) => setFilter(event.target.value)}
      />
      <div className={styles.count}>
        {filtered.length} of {tickers.length} tickers
      </div>
      <ul className={styles.list}>
        {filtered.map((ticker) => (
          <li key={ticker}>
            <Link
              href={`/markets/${ticker}`}
              className={`${styles.item} ${ticker === activeTicker ? styles.itemActive : ""}`}
            >
              {ticker}
            </Link>
          </li>
        ))}
        {filtered.length === 0 && <li className={styles.empty}>No matches.</li>}
      </ul>
    </aside>
  );
}
