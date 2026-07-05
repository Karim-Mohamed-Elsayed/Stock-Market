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

import styles from "./CandlestickChart.module.css";

interface Props {
  symbol: string;
  interval: Interval;
  data: OhlcHistoryPoint[];
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

export default function CandlestickChart({ symbol, interval, data }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const sma1SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const sma2SeriesRef = useRef<ISeriesApi<"Line"> | null>(null);

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
    });
    candleSeries.priceScale().applyOptions({ scaleMargins: { top: 0.08, bottom: 0.28 } });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
      color: gainBg,
    });
    volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });

    const sma1Series = chart.addSeries(LineSeries, {
      color: "#f5a623",
      lineWidth: 1,
      priceScaleId: "right",
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });
    const sma2Series = chart.addSeries(LineSeries, {
      color: "#8b5cf6",
      lineWidth: 1,
      priceScaleId: "right",
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });

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

    return () => {
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      sma1SeriesRef.current = null;
      sma2SeriesRef.current = null;
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

    chartRef.current?.timeScale().fitContent();
  }, [bars]);

  const isGain = legend ? legend.close >= legend.open : true;

  return (
    <div className={styles.wrap}>
      <div className={styles.legend}>
        <span className={styles.legendSymbol}>{symbol}</span>
        {legend && (
          <>
            <span className={isGain ? "gain" : "loss"}>O {legend.open.toFixed(2)}</span>
            <span className={isGain ? "gain" : "loss"}>H {legend.high.toFixed(2)}</span>
            <span className={isGain ? "gain" : "loss"}>L {legend.low.toFixed(2)}</span>
            <span className={isGain ? "gain" : "loss"}>C {legend.close.toFixed(2)}</span>
            {legend.volume !== null && (
              <span className={styles.legendMuted}>Vol {formatVolume(legend.volume)}</span>
            )}
            {legend.sma1 !== null && (
              <span className={styles.smaFast}>
                {interval === "daily" ? "SMA 50" : "SMA short"} {legend.sma1.toFixed(2)}
              </span>
            )}
            {legend.sma2 !== null && (
              <span className={styles.smaSlow}>
                {interval === "daily" ? "SMA 200" : "SMA long"} {legend.sma2.toFixed(2)}
              </span>
            )}
          </>
        )}
      </div>
      <div ref={containerRef} className={styles.chart} />
      {bars.length === 0 && <div className={styles.empty}>No OHLC data for this range.</div>}
    </div>
  );
}
