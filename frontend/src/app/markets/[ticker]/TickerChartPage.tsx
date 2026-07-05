"use client";

import { useEffect, useMemo, useState } from "react";

import CandlestickChart from "@/components/CandlestickChart";
import TickerList from "@/components/TickerList";
import { ApiError, type Interval, type OhlcHistoryPoint, getHistoryOhlc, listTickers } from "@/lib/api";

import styles from "./TickerChartPage.module.css";

const INTERVALS: { value: Interval; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "hourly", label: "Hourly" },
];

interface Props {
  ticker: string;
}

export default function TickerChartPage({ ticker }: Props) {
  const [interval, setSelectedInterval] = useState<Interval>("daily");
  const [data, setData] = useState<OhlcHistoryPoint[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tickers, setTickers] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    // Reset synchronously so stale data/errors from the previous ticker or
    // interval don't flash while the new request is in flight.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);

    getHistoryOhlc(ticker, interval)
      .then((points) => {
        if (cancelled) return;
        setData(points);
      })
      .catch((err) => {
        if (cancelled) return;
        setData(null);
        setError(
          err instanceof ApiError
            ? err.message
            : "Couldn't reach the market data service. Check that the API is running.",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [ticker, interval]);

  useEffect(() => {
    let cancelled = false;
    listTickers()
      .then((results) => {
        if (!cancelled) setTickers(results);
      })
      .catch(() => {
        // Aside list is a convenience nav, not core to the chart — fail quiet.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const latest = data && data.length > 0 ? data[data.length - 1] : null;
  const previous = data && data.length > 1 ? data[data.length - 2] : null;
  const change =
    latest?.close != null && previous?.close != null ? latest.close - previous.close : null;
  const changePercent =
    change !== null && previous?.close ? (change / previous.close) * 100 : null;
  const isGain = (change ?? 0) >= 0;

  const emptyMessage = useMemo(() => {
    if (error) return error;
    if (!loading && (!data || data.length === 0)) {
      return `No ${interval} history found for '${ticker}'.`;
    }
    return null;
  }, [error, loading, data, interval, ticker]);

  return (
    <main className={styles.main}>
      <div className={`container ${styles.layout}`}>
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <div className={styles.panelTitle}>
              <span className={styles.panelSymbol}>{ticker}</span>
              {latest?.gics_sector && <span className={styles.panelName}>{latest.gics_sector}</span>}
            </div>
            {latest?.close != null && (
              <div className={styles.panelPrice}>
                <div className={styles.panelPriceValue}>{latest.close.toFixed(2)}</div>
                {change !== null && changePercent !== null && (
                  <div className={`mono ${isGain ? "gain" : "loss"}`} style={{ fontSize: 12, fontWeight: 600 }}>
                    {isGain ? "+" : ""}
                    {change.toFixed(2)} ({isGain ? "+" : ""}
                    {changePercent.toFixed(2)}%)
                  </div>
                )}
              </div>
            )}
          </div>

          <div className={styles.panelChip}>
            {INTERVALS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`${styles.chip} ${interval === option.value ? styles.chipActive : ""}`}
                onClick={() => setSelectedInterval(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className={styles.status}>Loading {interval} history for {ticker}…</div>
          ) : emptyMessage ? (
            <div className={styles.status}>{emptyMessage}</div>
          ) : (
            <CandlestickChart symbol={ticker} interval={interval} data={data ?? []} />
          )}

          {latest && !loading && !emptyMessage && (
            <div className={styles.chartFooter}>
              {latest.signal && <span>Signal: {latest.signal}</span>}
              {latest.rsi != null && <span>RSI-14: {latest.rsi.toFixed(1)}</span>}
              {latest.macd_line != null && <span>MACD: {latest.macd_line.toFixed(2)}</span>}
            </div>
          )}
        </div>

        <TickerList tickers={tickers} activeTicker={ticker} />
      </div>
    </main>
  );
}
