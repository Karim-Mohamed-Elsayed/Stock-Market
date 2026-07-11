"use client";

import { useEffect, useMemo, useState, useRef } from "react";

import CandlestickChart from "@/components/CandlestickChart";
import TickerList from "@/components/TickerList";
import TickerTape from "@/components/TickerTape";
import { ApiError, type Interval, type OhlcHistoryPoint, getHistoryOhlc, listTickers } from "@/lib/api";

import styles from "./TickerChartPage.module.css";

interface Props {
  ticker: string;
}

export default function TickerChartPage({ ticker }: Props) {
  const [interval, setSelectedInterval] = useState<Interval>("daily");
  const [data, setData] = useState<OhlcHistoryPoint[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tickers, setTickers] = useState<string[]>([]);
  const [showSma1, setShowSma1] = useState(false);
  const [showSma2, setShowSma2] = useState(false);
  const [showVolume, setShowVolume] = useState(true);
  const [showCandles, setShowCandles] = useState(true);
  const [showLegend, setShowLegend] = useState(true);
  const [showRsi, setShowRsi] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Collapse sidebar on mount if on mobile viewport
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth <= 860) {
      setIsSidebarOpen(false);
    }
  }, []);

  // Close mobile sidebar when active ticker changes (on mobile only)
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth <= 860) {
      setIsSidebarOpen(false);
    }
  }, [ticker]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

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
        // Aside list is a convenience nav, not core to the chart  fail quiet.
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
      <TickerTape />
      <div className={styles.layoutWrapper}>
        <div className={`container ${styles.layout} ${isSidebarOpen ? styles.layoutSidebarOpen : ""}`}>
          <div className={styles.panel}>
            <div className={styles.toolbar}>
              {/* Left: price + change */}
              <div className={styles.toolbarLeft}>
                {latest?.close != null && (
                  <div className={styles.panelPrice}>
                    <span className={styles.panelPriceValue}>{latest.close.toFixed(2)}</span>
                    {change !== null && changePercent !== null && (
                      <span className={`mono ${isGain ? "gain" : "loss"}`} style={{ fontSize: 11, fontWeight: 600 }}>
                        {isGain ? "+" : ""}{change.toFixed(2)} ({isGain ? "+" : ""}{changePercent.toFixed(2)}%)
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Right: View Type dropdown + chips */}
              <div className={styles.toolbarRight}>
                <div className={styles.dropdownContainer} ref={dropdownRef}>
                  <span className={styles.dropdownLabel}>View Type</span>
                  <div className={styles.customDropdown}>
                    <button
                      type="button"
                      className={styles.dropdownTrigger}
                      onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    >
                      <span>{interval === "daily" ? "1 Day" : "1 Hour"}</span>
                      <svg
                        className={`${styles.arrowIcon} ${isDropdownOpen ? styles.arrowOpen : ""}`}
                        width="10"
                        height="6"
                        viewBox="0 0 10 6"
                        fill="none"
                      >
                        <path
                          d="M1 1L5 5L9 1"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                    {isDropdownOpen && (
                      <div className={styles.dropdownMenu}>
                        <button
                          type="button"
                          className={`${styles.dropdownItem} ${interval === "daily" ? styles.dropdownItemActive : ""}`}
                          onClick={() => { setSelectedInterval("daily"); setIsDropdownOpen(false); }}
                        >
                          1 Day
                        </button>
                        <button
                          type="button"
                          className={`${styles.dropdownItem} ${interval === "hourly" ? styles.dropdownItemActive : ""}`}
                          onClick={() => { setSelectedInterval("hourly"); setIsDropdownOpen(false); }}
                        >
                          1 Hour
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className={styles.panelChip}>
                  <button type="button" className={`${styles.chip} ${showSma1 ? styles.chipActive : ""}`} onClick={() => setShowSma1(!showSma1)}>
                    {interval === "daily" ? "SMA 50" : "SMA Short"}
                  </button>
                  <button type="button" className={`${styles.chip} ${showSma2 ? styles.chipActive : ""}`} onClick={() => setShowSma2(!showSma2)}>
                    {interval === "daily" ? "SMA 200" : "SMA Long"}
                  </button>
                  <button type="button" className={`${styles.chip} ${showVolume ? styles.chipActive : ""}`} onClick={() => setShowVolume(!showVolume)}>
                    Volume
                  </button>
                  <button type="button" className={`${styles.chip} ${showCandles ? styles.chipActive : ""}`} onClick={() => setShowCandles(!showCandles)}>
                    Candles
                  </button>
                  <button type="button" className={`${styles.chip} ${showLegend ? styles.chipActive : ""}`} onClick={() => setShowLegend(!showLegend)}>
                    Info
                  </button>
                  <button type="button" className={`${styles.chip} ${showRsi ? styles.chipActive : ""}`} onClick={() => setShowRsi(!showRsi)}>
                    RSI
                  </button>
                  <button type="button" className={`${styles.chip} ${isSidebarOpen ? styles.chipActive : ""}`} onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
                    Watchlist
                  </button>
                </div>
              </div>
            </div>

            {loading ? (
              <div className={styles.status}>Loading {interval} history for {ticker}…</div>
            ) : emptyMessage ? (
              <div className={styles.status}>{emptyMessage}</div>
            ) : (
              <CandlestickChart
                symbol={ticker}
                interval={interval}
                data={data ?? []}
                showSma1={showSma1}
                showSma2={showSma2}
                showVolume={showVolume}
                showCandles={showCandles}
                showLegend={showLegend}
                showRsi={showRsi}
              />
            )}

            {latest && !loading && !emptyMessage && (
              <div className={styles.chartFooter}>
                {latest.signal && <span>Signal: {latest.signal}</span>}
                {latest.rsi != null && <span>RSI-14: {latest.rsi.toFixed(1)}</span>}
                {latest.macd_line != null && <span>MACD: {latest.macd_line.toFixed(2)}</span>}
              </div>
            )}
          </div>

          <TickerList
            tickers={tickers}
            activeTicker={ticker}
            isOpen={isSidebarOpen}
          />

        </div>
      </div>
    </main>
  );
}
