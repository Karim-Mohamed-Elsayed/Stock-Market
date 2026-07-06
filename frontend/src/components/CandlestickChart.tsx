"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CandlestickSeries,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  LineStyle,
  createChart,
  createTextWatermark,
  type CandlestickData,
  type HistogramData,
  type IChartApi,
  type ISeriesApi,
  type LineData,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";

import type { Interval, OhlcHistoryPoint } from "@/lib/api";
import TickerLogo from "@/components/TickerLogo";

import styles from "./CandlestickChart.module.css";

interface Props {
  symbol: string;
  interval: Interval;
  data: OhlcHistoryPoint[];
  showSma1?: boolean;
  showSma2?: boolean;
  showVolume?: boolean;
  showCandles?: boolean;
  showLegend?: boolean;
  showRsi?: boolean;
}

interface Bar {
  time: Time;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
  sma1: number | null;
  sma2: number | null;
  rsi: number | null;
  macd: number | null;
  signal: string | null;
}

function cssVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

// "2024-06-17 13:30:00" -> seconds since epoch. Daily bars ("2024-06-17") are
// passed straight through as business-day strings; lightweight-charts parses
// those natively without a time component.
function toChartTime(date: string): Time {
  if (!date.includes(" ")) return date as Time;
  return (Date.parse(`${date.replace(" ", "T")}Z`) / 1000) as UTCTimestamp;
}

function formatVolume(volume: number): string {
  if (volume >= 1_000_000_000) return `${(volume / 1_000_000_000).toFixed(2)}B`;
  if (volume >= 1_000_000) return `${(volume / 1_000_000).toFixed(2)}M`;
  if (volume >= 1_000) return `${(volume / 1_000).toFixed(2)}K`;
  return volume.toFixed(0);
}

export default function CandlestickChart({
  symbol,
  interval,
  data,
  showSma1 = true,
  showSma2 = true,
  showVolume = true,
  showCandles = true,
  showLegend = true,
  showRsi = false,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const sma1SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const sma2SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const rsiSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);

  const bars = useMemo<Bar[]>(() => {
    const rows = data
      .filter(
        (point) =>
          point.open !== null && point.high !== null && point.low !== null && point.close !== null,
      )
      .map((point) => ({
        time: toChartTime(point.date),
        open: point.open as number,
        high: point.high as number,
        low: point.low as number,
        close: point.close as number,
        volume: point.volume,
        sma1: interval === "daily" ? point.sma_50 : point.sma_short,
        sma2: interval === "daily" ? point.sma_200 : point.sma_long,
        rsi: point.rsi,
        macd: point.macd_line,
        signal: point.signal,
      }));
    rows.sort((a, b) => (a.time > b.time ? 1 : a.time < b.time ? -1 : 0));
    return rows;
  }, [data, interval]);

  const [legend, setLegend] = useState<Bar | null>(null);
  const barsRef = useRef<Bar[]>([]);

  useEffect(() => {
    barsRef.current = bars;
    // Resets the legend to the latest bar whenever a new dataset (ticker or
    // interval switch) comes in, overriding whatever the crosshair last set.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLegend(bars.length > 0 ? bars[bars.length - 1] : null);
  }, [bars]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const gain = cssVar("--gain", "#0ca30c");
    const loss = cssVar("--loss", "#d03b3b");
    const gainBg = cssVar("--gain-bg", "rgba(12, 163, 12, 0.14)");
    const bg = cssVar("--bg-1", "#10141b");
    const border = cssVar("--border", "#262d3a");
    const textSecondary = cssVar("--text-secondary", "#9aa5b6");
    const textTertiary = cssVar("--text-tertiary", "#656f82");
    const fontFamily = cssVar("--font-mono", "monospace");

    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { color: bg },
        textColor: textSecondary,
        fontFamily,
        // Keep the built-in TradingView attribution logo (library license
        // requirement) rather than stripping it without adding notice
        // elsewhere.
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: border, style: LineStyle.Solid },
      },
      rightPriceScale: {
        borderColor: border,
      },
      timeScale: {
        borderColor: border,
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: textTertiary, labelBackgroundColor: cssVar("--bg-3", "#1d232f") },
        horzLine: { color: textTertiary, labelBackgroundColor: cssVar("--bg-3", "#1d232f") },
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: gain,
      downColor: loss,
      borderUpColor: gain,
      borderDownColor: loss,
      wickUpColor: gain,
      wickDownColor: loss,
      priceScaleId: "right",
      visible: showCandles,
    });
    candleSeries.priceScale().applyOptions({ scaleMargins: { top: 0.08, bottom: 0.28 } });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
      color: gainBg,
      visible: showVolume,
    });
    volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });

    const sma1Series = chart.addSeries(LineSeries, {
      color: "#f5a623",
      lineWidth: 1,
      priceScaleId: "right",
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
      visible: showSma1,
    });
    const sma2Series = chart.addSeries(LineSeries, {
      color: "#8b5cf6",
      lineWidth: 1,
      priceScaleId: "right",
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
      visible: showSma2,
    });

    const rsiSeries = chart.addSeries(LineSeries, {
      color: "#2f6feb",
      lineWidth: 2,
      priceScaleId: "left",
      priceLineVisible: true,
      lastValueVisible: true,
      crosshairMarkerVisible: false,
      visible: showRsi,
    });
    chart.priceScale("left").applyOptions({ scaleMargins: { top: 0.65, bottom: 0.05 } });

    createTextWatermark(chart.panes()[0], {
      visible: true,
      lines: [
        {
          text: symbol,
          color: "rgba(255, 255, 255, 0.06)",
          fontSize: 96,
        },
      ],
    });

    chart.subscribeCrosshairMove((param) => {
      const currentBars = barsRef.current;
      if (!param.time) {
        setLegend(currentBars.length > 0 ? currentBars[currentBars.length - 1] : null);
        return;
      }
      const candle = param.seriesData.get(candleSeries) as CandlestickData<Time> | undefined;
      if (!candle) return;
      const volumePoint = param.seriesData.get(volumeSeries) as HistogramData<Time> | undefined;
      const match = currentBars.find((bar) => bar.time === param.time);
      setLegend({
        time: candle.time,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: volumePoint?.value ?? match?.volume ?? null,
        sma1: match?.sma1 ?? null,
        sma2: match?.sma2 ?? null,
        rsi: match?.rsi ?? null,
        macd: match?.macd ?? null,
        signal: match?.signal ?? null,
      });
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;
    sma1SeriesRef.current = sma1Series;
    sma2SeriesRef.current = sma2Series;
    rsiSeriesRef.current = rsiSeries;

    return () => {
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      sma1SeriesRef.current = null;
      sma2SeriesRef.current = null;
      rsiSeriesRef.current = null;
    };
    // Re-created per symbol so the watermark and a fresh crosshair subscription
    // always match the ticker currently on screen; bars are read via barsRef
    // rather than closed over, so they're intentionally not a dependency.
  }, [symbol]);

  useEffect(() => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current) return;

    const gain = cssVar("--gain-bg", "rgba(12, 163, 12, 0.14)");
    const loss = cssVar("--loss-bg", "rgba(208, 59, 59, 0.14)");

    candleSeriesRef.current.setData(
      bars.map<CandlestickData<Time>>((bar) => ({
        time: bar.time,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
      })),
    );

    volumeSeriesRef.current.setData(
      bars
        .filter((bar) => bar.volume !== null)
        .map<HistogramData<Time>>((bar) => ({
          time: bar.time,
          value: bar.volume as number,
          color: bar.close >= bar.open ? gain : loss,
        })),
    );

    sma1SeriesRef.current?.setData(
      bars
        .filter((bar) => bar.sma1 !== null)
        .map<LineData<Time>>((bar) => ({ time: bar.time, value: bar.sma1 as number })),
    );
    sma2SeriesRef.current?.setData(
      bars
        .filter((bar) => bar.sma2 !== null)
        .map<LineData<Time>>((bar) => ({ time: bar.time, value: bar.sma2 as number })),
    );
    rsiSeriesRef.current?.setData(
      bars
        .filter((bar) => bar.rsi !== null)
        .map<LineData<Time>>((bar) => ({ time: bar.time, value: bar.rsi as number })),
    );

    if (bars.length > 14) {
      chartRef.current?.timeScale().setVisibleLogicalRange({
        from: bars.length - 14,
        to: bars.length - 1,
      });
    } else {
      chartRef.current?.timeScale().fitContent();
    }
  }, [bars]);

  useEffect(() => {
    sma1SeriesRef.current?.applyOptions({ visible: showSma1 });
  }, [showSma1]);

  useEffect(() => {
    sma2SeriesRef.current?.applyOptions({ visible: showSma2 });
  }, [showSma2]);

  useEffect(() => {
    volumeSeriesRef.current?.applyOptions({ visible: showVolume });
  }, [showVolume]);

  useEffect(() => {
    candleSeriesRef.current?.applyOptions({ visible: showCandles });
  }, [showCandles]);

  useEffect(() => {
    rsiSeriesRef.current?.applyOptions({ visible: showRsi });
    chartRef.current?.priceScale("left").applyOptions({ visible: showRsi });
  }, [showRsi]);

  const isGain = legend ? legend.close >= legend.open : true;
  const changeVal = legend ? legend.close - legend.open : 0;
  const changePct = legend && legend.open !== 0 ? (changeVal / legend.open) * 100 : 0;
  const changeSign = changeVal >= 0 ? "+" : "";

  return (
    <div className={styles.wrap}>
      {showLegend && (
        <div className={`${styles.legend} ${showRsi ? styles.legendShifted : ""}`}>
          {/* Row 1: Logo · Symbol · interval — OHLC */}
          <div className={styles.legendRow1}>
            <TickerLogo ticker={symbol} size={18} className={styles.legendLogo} />
            <span className={styles.legendSymbol}>{symbol}</span>
            <span className={styles.legendDot}>·</span>
            <span className={styles.legendInterval}>{interval === "daily" ? "1D" : "1H"}</span>
            {legend && (
              <>
                <span className={styles.legendSep}>—</span>
                <span className={styles.legendOhlcLabel}>O</span>
                <span className={isGain ? "gain" : "loss"}>{legend.open.toFixed(2)}</span>
                <span className={styles.legendOhlcLabel}>H</span>
                <span className={isGain ? "gain" : "loss"}>{legend.high.toFixed(2)}</span>
                <span className={styles.legendOhlcLabel}>L</span>
                <span className={isGain ? "gain" : "loss"}>{legend.low.toFixed(2)}</span>
                <span className={styles.legendOhlcLabel}>C</span>
                <span className={isGain ? "gain" : "loss"}>{legend.close.toFixed(2)}</span>
                <span className={`${styles.legendChange} ${isGain ? "gain" : "loss"}`}>
                  {changeSign}{changeVal.toFixed(2)} ({changeSign}{changePct.toFixed(2)}%)
                </span>
              </>
            )}
          </div>

          {/* Row 2: Bid/Sell — Ask/Buy boxes */}
          {legend && (
            <div className={styles.legendRow2}>
              <span className={styles.bidBox}>
                <span className={styles.bidLabel}>SELL</span>
                <span className={styles.bidPrice}>{legend.close.toFixed(2)}</span>
              </span>
              <span className={styles.spread}>0.00</span>
              <span className={styles.askBox}>
                <span className={styles.askLabel}>BUY</span>
                <span className={styles.askPrice}>{legend.close.toFixed(2)}</span>
              </span>
            </div>
          )}

          {/* Row 3: Vol + SMAs */}
          {legend && (
            <div className={styles.legendRow3}>
              {legend.volume !== null && showVolume && (
                <span className={styles.legendMuted}>Vol <span className={styles.legendVolVal}>{formatVolume(legend.volume)}</span></span>
              )}
              {legend.sma1 !== null && showSma1 && (
                <span className={styles.smaFast}>
                  {interval === "daily" ? "SMA 50" : "SMA short"} {legend.sma1.toFixed(2)}
                </span>
              )}
              {legend.sma2 !== null && showSma2 && (
                <span className={styles.smaSlow}>
                  {interval === "daily" ? "SMA 200" : "SMA long"} {legend.sma2.toFixed(2)}
                </span>
              )}
              {legend.rsi !== null && showRsi && (
                <span style={{ color: "#2f6feb", fontWeight: 600 }}>
                  RSI {legend.rsi.toFixed(2)}
                </span>
              )}
            </div>
          )}
        </div>
      )}
      <div ref={containerRef} className={styles.chart} />
      {bars.length === 0 && <div className={styles.empty}>No OHLC data for this range.</div>}
    </div>
  );
}
