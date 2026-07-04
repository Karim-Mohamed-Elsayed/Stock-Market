"use client";

import { useEffect, useState } from "react";

import { getQuote, type QuoteOut } from "@/lib/api";

import styles from "./TickerTape.module.css";

const SYMBOLS = ["AAPL", "MSFT", "NVDA", "AMZN", "GOOGL", "META", "TSLA", "JPM", "XOM", "UNH"];

const FALLBACK: QuoteOut[] = [
  { ticker: "AAPL", price: 213.43, previous_close: 211.02, change: 2.41, change_percent: 1.14, currency: "USD" },
  { ticker: "MSFT", price: 441.58, previous_close: 445.1, change: -3.52, change_percent: -0.79, currency: "USD" },
  { ticker: "NVDA", price: 128.34, previous_close: 124.9, change: 3.44, change_percent: 2.75, currency: "USD" },
  { ticker: "AMZN", price: 197.22, previous_close: 195.8, change: 1.42, change_percent: 0.73, currency: "USD" },
  { ticker: "GOOGL", price: 178.9, previous_close: 180.55, change: -1.65, change_percent: -0.91, currency: "USD" },
  { ticker: "META", price: 596.1, previous_close: 588.3, change: 7.8, change_percent: 1.33, currency: "USD" },
  { ticker: "TSLA", price: 248.6, previous_close: 259.1, change: -10.5, change_percent: -4.05, currency: "USD" },
  { ticker: "JPM", price: 234.15, previous_close: 232.4, change: 1.75, change_percent: 0.75, currency: "USD" },
];

function formatPrice(value: number | null) {
  if (value === null) return "—";
  return value.toFixed(2);
}

function formatChange(quote: QuoteOut) {
  if (quote.change === null || quote.change_percent === null) return "—";
  const sign = quote.change >= 0 ? "+" : "";
  return `${sign}${quote.change.toFixed(2)} (${sign}${quote.change_percent.toFixed(2)}%)`;
}

export default function TickerTape() {
  const [quotes, setQuotes] = useState<QuoteOut[]>(FALLBACK);

  useEffect(() => {
    let cancelled = false;

    async function loadQuotes() {
      const results = await Promise.allSettled(SYMBOLS.map((symbol) => getQuote(symbol)));
      const resolved = results
        .filter((result): result is PromiseFulfilledResult<QuoteOut> => result.status === "fulfilled")
        .map((result) => result.value)
        // A 200 response with a null price (e.g. the quote provider is
        // unreachable) resolves the promise but carries no usable data —
        // treat it the same as a failed fetch so the fallback tape isn't
        // replaced with a row of dashes.
        .filter((quote) => quote.price !== null);

      if (!cancelled && resolved.length > 0) {
        setQuotes(resolved);
      }
    }

    loadQuotes();
    return () => {
      cancelled = true;
    };
  }, []);

  const looped = [...quotes, ...quotes];

  return (
    <div className={styles.tape} aria-label="Live market quotes">
      <div className={styles.track}>
        {looped.map((quote, index) => {
          const isGain = (quote.change ?? 0) >= 0;
          return (
            <span className={styles.item} key={`${quote.ticker}-${index}`}>
              <span className={styles.symbol}>{quote.ticker}</span>
              <span className={styles.price}>{formatPrice(quote.price)}</span>
              <span className={`${styles.change} ${isGain ? "gain" : "loss"}`}>
                {formatChange(quote)}
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
