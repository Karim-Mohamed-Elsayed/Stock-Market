"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import btn from "@/components/Button.module.css";
import TickerLogo from "@/components/TickerLogo";
import TickerTape from "@/components/TickerTape";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  ComposedChart,
  ReferenceArea,
  ReferenceLine,
  Cell,
} from "recharts";

interface SectorReturn {
  gics_sector: string;
  avg_daily_return: number;
}

interface QuoteOut {
  ticker: string;
  price: number | null;
  previous_close: number | null;
  change: number | null;
  change_percent: number | null;
  currency: string | null;
  rsi: number | null;
  gics_sector: string | null;
  volatility: number | null;
}

interface HistoryPoint {
  date: string;
  ticker: string;
  close: number | null;
  daily_return: number | null;
  rolling_30day_stddev: number | null;
  rsi: number | null;
  macd_line: number | null;
  macd_signal_line: number | null;
}

export default function InsightsAndAnalyticsPage() {
  // Insights State
  const [sectors, setSectors] = useState<SectorReturn[]>([]);
  const [quotes, setQuotes] = useState<QuoteOut[]>([]);
  const [volatilityQuotes, setVolatilityQuotes] = useState<QuoteOut[]>([]);
  const [loadingInsights, setLoadingInsights] = useState(true);
  const [expandedSectors, setExpandedSectors] = useState<Record<string, boolean>>({});
  const [rankingMetric, setRankingMetric] = useState<"rsi" | "volatility">("rsi");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [sectorSortOrder, setSectorSortOrder] = useState<"desc" | "asc">("desc");
  const [sectorSearch, setSectorSearch] = useState("");
  const [tickerSearch, setTickerSearch] = useState("");
  const [isSectorSearchOpen, setIsSectorSearchOpen] = useState(false);
  const [isTickerSearchOpen, setIsTickerSearchOpen] = useState(false);
  const [analyticsSearch, setAnalyticsSearch] = useState("");
  const [isAnalyticsDropdownOpen, setIsAnalyticsDropdownOpen] = useState(false);

  // Analytics State
  const [tickers, setTickers] = useState<string[]>([]);
  const [selectedTicker, setSelectedTicker] = useState<string>("AAPL");
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);

  // Fetch Insights
  useEffect(() => {
    const apiUrl = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/v1`;
    let cancelled = false;

    Promise.all([
      fetch(`${apiUrl}/sectors`).then((r) => r.json()),
      fetch(`${apiUrl}/tickers/quotes`).then((r) => r.json()),
    ])
      .then(([sectorsData, quotesData]) => {
        if (!cancelled) {
          if (Array.isArray(sectorsData)) setSectors(sectorsData);
          if (quotesData && typeof quotesData === "object") {
            const quotesArray = Object.values(quotesData) as QuoteOut[];
            
            const rsiQuotes = quotesArray.filter(q => typeof q.rsi === 'number');
            rsiQuotes.sort((a, b) => (b.rsi as number) - (a.rsi as number));
            setQuotes(rsiQuotes);

            const volQuotes = quotesArray.filter(q => typeof q.volatility === 'number');
            volQuotes.sort((a, b) => (b.volatility as number) - (a.volatility as number));
            setVolatilityQuotes(volQuotes);
          }
          setLoadingInsights(false);
        }
      })
      .catch((err) => {
        console.error("Failed to fetch insights data", err);
        if (!cancelled) setLoadingInsights(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch Ticker List for Analytics
  useEffect(() => {
    const apiUrl = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/v1`;
    fetch(`${apiUrl}/tickers`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setTickers(data);
          if (!data.includes("AAPL")) {
            setSelectedTicker(data[0]);
          }
        }
      })
      .catch(console.error);
  }, []);

  // Fetch History for Analytics
  useEffect(() => {
    if (!selectedTicker) return;

    setLoadingAnalytics(true);
    const apiUrl = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/v1`;

    fetch(`${apiUrl}/history/${selectedTicker}?interval=daily`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setHistory(data);
        } else {
          setHistory([]);
        }
        setLoadingAnalytics(false);
      })
      .catch((err) => {
        console.error(err);
        setLoadingAnalytics(false);
      });
  }, [selectedTicker]);

  // Derive datasets for the charts
  const { chartData, histogramData } = useMemo(() => {
    if (!history || history.length === 0) return { chartData: [], histogramData: [] };

    const last30 = history.slice(-40).map((pt) => ({
      ...pt,
      daily_return_pct: pt.daily_return != null ? pt.daily_return * 100 : null,
      volatility: pt.rolling_30day_stddev,
      macd_histogram:
        pt.macd_line != null && pt.macd_signal_line != null
          ? pt.macd_line - pt.macd_signal_line
          : null,
      dayLabel: new Date(pt.date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
    }));

    const bins: Record<string, number> = {};
    history.forEach((pt) => {
      if (pt.daily_return != null) {
        const pct = pt.daily_return * 100;
        const binValue = Math.round(pct * 2) / 2;
        const binKey = `${binValue > 0 ? "+" : ""}${binValue.toFixed(1)}%`;
        bins[binKey] = (bins[binKey] || 0) + 1;
      }
    });

    const sortedBinKeys = Object.keys(bins).sort(
      (a, b) => parseFloat(a) - parseFloat(b)
    );
    const histogram = sortedBinKeys.map((key) => ({
      bin: key,
      frequency: bins[key],
    }));

    return { chartData: last30, histogramData: histogram };
  }, [history]);

  if (loadingInsights) {
    return (
      <>
        <TickerTape />
        <main className="container" style={{ paddingTop: '100px', minHeight: '80vh' }}>
          <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>Loading Insights...</div>
        </main>
      </>
    );
  }

  const lowerSectorSearch = sectorSearch.toLowerCase();
  const displayedSectors = (sectorSortOrder === "desc" ? sectors : [...sectors].reverse()).filter(sector => {
    if (!sectorSearch) return true;
    const matchesSector = sector.gics_sector.toLowerCase().includes(lowerSectorSearch);
    const sectorTickers = quotes.filter(q => q.gics_sector === sector.gics_sector);
    const matchesTicker = sectorTickers.some(q => q.ticker.toLowerCase().includes(lowerSectorSearch));
    return matchesSector || matchesTicker;
  });

  const lowerTickerSearch = tickerSearch.toLowerCase();
  const displayedQuotes = (sortOrder === "desc" ? quotes : [...quotes].reverse()).filter(q => 
    q.ticker.toLowerCase().includes(lowerTickerSearch)
  );
  const displayedVolQuotes = (sortOrder === "desc" ? volatilityQuotes : [...volatilityQuotes].reverse()).filter(q => 
    q.ticker.toLowerCase().includes(lowerTickerSearch)
  );

  return (
    <>
      <TickerTape />
      <main className="container" style={{ paddingTop: '64px', minHeight: '80vh', paddingBottom: '64px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '48px' }}>
        <div>
          <h1 style={{ fontSize: '36px', fontWeight: 700, marginBottom: '8px', color: 'var(--text-primary)' }}>
            Market Insights and Analytics
          </h1>
          <p style={{ fontSize: '16px', color: 'var(--text-secondary)' }}>
            Discover top performing sectors, technically overbought/oversold tickers, and advanced risk & momentum analysis.
          </p>
        </div>
        <Link href="/" className={`${btn.btn} ${btn.secondary}`}>
          &larr; Back to Dashboard
        </Link>
      </div>

      {/* --- Analytics Dashboards Section --- */}
      <div style={{ marginBottom: '80px', paddingBottom: '64px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '40px' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 600, color: 'var(--text-primary)' }}>
            Deep-Dive Ticker Analytics
          </h2>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Select Ticker:</span>
            
            <div style={{ position: 'relative', width: '220px' }}>
              <div 
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 16px', cursor: 'pointer', transition: 'border-color 0.2s' }}
                onClick={() => setIsAnalyticsDropdownOpen(!isAnalyticsDropdownOpen)}
              >
                <span style={{ color: 'var(--brand-text)', fontWeight: 600, fontSize: '16px' }}>{selectedTicker}</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isAnalyticsDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </div>

              {isAnalyticsDropdownOpen && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  marginTop: '8px',
                  background: 'var(--bg-2)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  maxHeight: '300px',
                  display: 'flex',
                  flexDirection: 'column',
                  zIndex: 50,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                  overflow: 'hidden'
                }}>
                  <div style={{ padding: '12px', borderBottom: '1px solid var(--border)', background: 'var(--bg-1)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-3)', borderRadius: '16px', padding: '6px 12px' }}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px' }}>
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                      </svg>
                      <input
                        autoFocus
                        value={analyticsSearch}
                        onChange={(e) => setAnalyticsSearch(e.target.value)}
                        placeholder="Search tickers..."
                        style={{ border: 'none', background: 'transparent', color: 'var(--text-primary)', outline: 'none', width: '100%', fontSize: '14px' }}
                      />
                    </div>
                  </div>

                  <div style={{ overflowY: 'auto', flex: 1 }}>
                    {tickers.filter(t => t.toLowerCase().includes(analyticsSearch.toLowerCase())).map((t) => (
                      <div 
                        key={t}
                        style={{ padding: '12px 16px', cursor: 'pointer', color: t === selectedTicker ? 'var(--brand)' : 'var(--text-primary)', fontWeight: t === selectedTicker ? 700 : 500, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                        onMouseDown={() => {
                          setSelectedTicker(t);
                          setIsAnalyticsDropdownOpen(false);
                          setAnalyticsSearch("");
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-3)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        {t}
                        {t === selectedTicker && (
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"></polyline>
                          </svg>
                        )}
                      </div>
                    ))}
                    {tickers.filter(t => t.toLowerCase().includes(analyticsSearch.toLowerCase())).length === 0 && (
                      <div style={{ padding: '16px', color: 'var(--text-tertiary)', textAlign: 'center', fontSize: '14px' }}>No tickers found</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {loadingAnalytics ? (
          <div style={{ textAlign: "center", padding: "100px", color: "var(--text-secondary)" }}>
            Loading historical data for {selectedTicker}...
          </div>
        ) : chartData.length === 0 ? (
          <div style={{ textAlign: "center", padding: "100px", color: "var(--text-tertiary)" }}>
            No historical data found for {selectedTicker}.
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: 'repeat(auto-fit, minmax(600px, 1fr))', gap: "48px" }}>
            
            {/* Dashboard 1: Risk & Return */}
            <section
              style={{
                background: "var(--bg-1)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-lg)",
                padding: "24px",
              }}
            >
              <h2 style={{ fontSize: "20px", fontWeight: 600, marginBottom: "24px" }}>
                Risk & Return Performance Dashboard
              </h2>

              {/* Upper Panel: Dual-Axis Line Chart */}
              <div style={{ height: 300, marginBottom: "32px" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="dayLabel" stroke="var(--text-tertiary)" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                    <YAxis
                      yAxisId="left"
                      tickFormatter={(val) => `${val}%`}
                      stroke="var(--brand)"
                      domain={[-5, 5]}
                      tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      stroke="#e89e3a" // Orange
                      domain={[0, "dataMax + 0.01"]}
                      tickFormatter={(val) => val.toFixed(3)}
                      tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: "var(--bg-2)", borderColor: "var(--border)", color: "#fff" }}
                      itemStyle={{ color: "#fff" }}
                      labelStyle={{ color: "var(--text-tertiary)", marginBottom: "4px" }}
                    />
                    <Legend wrapperStyle={{ paddingTop: "10px" }} />
                    <ReferenceLine y={0} yAxisId="left" stroke="var(--border-strong)" />
                    
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="daily_return_pct"
                      name="Daily Return (%)"
                      stroke="var(--brand)"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 6 }}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="volatility"
                      name="Volatility (Rolling 30-Day StdDev)"
                      stroke="#e89e3a"
                      strokeWidth={2}
                      dot={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {/* Lower Panel: Histogram */}
              <div style={{ height: 250 }}>
                <h3 style={{ fontSize: "14px", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "16px", textAlign: "center" }}>
                  Daily Returns Distribution (Full History)
                </h3>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={histogramData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="bin" stroke="var(--text-tertiary)" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                    <YAxis stroke="var(--text-tertiary)" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "var(--bg-2)", borderColor: "var(--border)" }}
                      itemStyle={{ color: "#fff" }}
                      cursor={{ fill: 'var(--bg-3)' }}
                    />
                    <Bar dataKey="frequency" name="Frequency" fill="#698bb3" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* Dashboard 2: Key Indicator Oscillator */}
            <section
              style={{
                background: "var(--bg-1)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-lg)",
                padding: "24px",
              }}
            >
              <h2 style={{ fontSize: "20px", fontWeight: 600, marginBottom: "24px" }}>
                Key Indicator Oscillator Dashboard
              </h2>

              {/* Top Panel: RSI */}
              <div style={{ height: 250, marginBottom: "32px" }}>
                <h3 style={{ fontSize: "14px", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "16px", textAlign: "center" }}>
                  Relative Strength Index (RSI)
                </h3>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="dayLabel" stroke="var(--text-tertiary)" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                    <YAxis domain={[0, 100]} stroke="var(--text-tertiary)" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "var(--bg-2)", borderColor: "var(--border)", color: "#fff" }}
                      itemStyle={{ color: "#fff" }}
                      labelStyle={{ color: "var(--text-secondary)", marginBottom: "4px" }}
                    />
                    
                    <ReferenceArea y1={70} y2={100} fill="rgba(208, 59, 59, 0.1)" />
                    <ReferenceArea y1={0} y2={30} fill="rgba(12, 163, 12, 0.1)" />
                    
                    <ReferenceLine y={70} stroke="var(--loss)" strokeDasharray="3 3" label={{ position: 'insideTopLeft', value: '70 (OVERBOUGHT)', fill: 'var(--loss)', fontSize: 11 }} />
                    <ReferenceLine y={30} stroke="var(--gain)" strokeDasharray="3 3" label={{ position: 'insideBottomLeft', value: '30 (OVERSOLD)', fill: 'var(--gain)', fontSize: 11 }} />
                    
                    <Line
                      type="monotone"
                      dataKey="rsi"
                      name="RSI"
                      stroke="#4386cc"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Bottom Panel: MACD */}
              <div style={{ height: 250 }}>
                <h3 style={{ fontSize: "14px", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "16px", textAlign: "center" }}>
                  Moving Average Convergence Divergence (MACD)
                </h3>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="dayLabel" stroke="var(--text-tertiary)" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                    <YAxis stroke="var(--text-tertiary)" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "var(--bg-2)", borderColor: "var(--border)", color: "#fff" }}
                      itemStyle={{ color: "#fff" }}
                      labelStyle={{ color: "var(--text-secondary)", marginBottom: "4px" }}
                    />
                    <Legend wrapperStyle={{ paddingTop: "10px" }} />
                    
                    <ReferenceLine y={0} stroke="var(--border-strong)" />
                    
                    <Bar dataKey="macd_histogram" name="MACD Histogram" maxBarSize={10}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={(entry.macd_histogram || 0) >= 0 ? "rgba(105, 139, 179, 0.7)" : "rgba(208, 59, 59, 0.7)"} />
                      ))}
                    </Bar>
                    
                    <Line
                      type="monotone"
                      dataKey="macd_line"
                      name="MACD Line"
                      stroke="#4a82f0"
                      strokeWidth={2}
                      dot={false}
                    />
                    
                    <Line
                      type="monotone"
                      dataKey="macd_signal_line"
                      name="Signal Line"
                      stroke="#ef4444"
                      strokeWidth={2}
                      dot={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

            </section>
          </div>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
        
        {/* Sectors Table */}
        <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 600 }}>Sector Performance Ranking</h2>
            <div style={{ position: 'relative', width: '48px', height: '48px' }}>
              <div style={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: '8px', background: isSectorSearchOpen ? 'var(--bg-1)' : 'transparent', border: isSectorSearchOpen ? '1px solid var(--border)' : '1px solid transparent', borderRadius: '24px', height: '48px', padding: isSectorSearchOpen ? '0 16px' : '0', transition: 'all 0.2s', zIndex: 20 }}>
                {isSectorSearchOpen && (
                  <input 
                    autoFocus
                    type="text" 
                    placeholder="Search sectors or tickers..." 
                    value={sectorSearch}
                    onChange={(e) => setSectorSearch(e.target.value)}
                    style={{ border: 'none', background: 'transparent', color: 'var(--text-primary)', outline: 'none', width: '200px', fontSize: '16px' }}
                  />
                )}
                <button 
                  onClick={() => setIsSectorSearchOpen(!isSectorSearchOpen)} 
                  style={{ background: isSectorSearchOpen ? 'transparent' : 'var(--bg-1)', border: isSectorSearchOpen ? 'none' : '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', borderRadius: '24px', flexShrink: 0, transition: 'all 0.2s' }}
                  title="Search"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                  </svg>
                </button>
              </div>
            </div>
          </div>
          <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '550px' }}>
            <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
              <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-2)', zIndex: 10 }}>
                <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-tertiary)', fontSize: '14px', textTransform: 'uppercase' }}>
                  <th style={{ padding: '16px 12px' }}>Rank</th>
                  <th style={{ padding: '16px 12px' }}>GICS Sector</th>
                  <th 
                    style={{ padding: '16px 12px', textAlign: 'right', cursor: 'pointer', userSelect: 'none', transition: 'color 0.2s' }}
                    onClick={() => setSectorSortOrder(prev => prev === "desc" ? "asc" : "desc")}
                    onMouseEnter={(e) => e.currentTarget.style.color = 'var(--brand)'}
                    onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-tertiary)'}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                      Avg Daily Return
                      <span style={{ fontSize: '10px', color: 'var(--brand)' }}>{sectorSortOrder === "desc" ? "▼" : "▲"}</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {displayedSectors.map((sector, idx) => {
                  const isGain = sector.avg_daily_return >= 0;
                  const matchesSector = sector.gics_sector.toLowerCase().includes(lowerSectorSearch);
                  let sectorTickers = quotes.filter(q => q.gics_sector === sector.gics_sector);
                  
                  const isExpanded = expandedSectors[sector.gics_sector] || (sectorSearch !== "" && !matchesSector);
                  
                  if (sectorSearch !== "" && !matchesSector) {
                    sectorTickers = sectorTickers.filter(q => q.ticker.toLowerCase().includes(lowerSectorSearch));
                  }
                  
                  sectorTickers.sort((a, b) => a.ticker.localeCompare(b.ticker));

                  return (
                    <React.Fragment key={sector.gics_sector}>
                      <tr 
                        style={{ borderBottom: isExpanded ? 'none' : '1px solid var(--border)', fontSize: '16px', cursor: 'pointer', transition: 'background 0.2s' }}
                        onClick={() => setExpandedSectors(prev => ({...prev, [sector.gics_sector]: !prev[sector.gics_sector]}))}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-3)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <td style={{ padding: '24px 12px', color: 'var(--text-secondary)' }}>#{sectorSortOrder === "desc" ? idx + 1 : displayedSectors.length - idx}</td>
                        <td style={{ padding: '24px 12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '16px' }}>
                          <span style={{ 
                            display: 'inline-block', 
                            transition: 'transform 0.2s', 
                            transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                            color: 'var(--text-tertiary)',
                            fontSize: '16px'
                          }}>
                            ▶
                          </span>
                          {sector.gics_sector}
                        </td>
                        <td style={{ padding: '24px 12px', textAlign: 'right', fontWeight: 700, fontSize: '18px', color: isGain ? 'var(--gain)' : 'var(--loss)' }}>
                          {isGain ? "+" : ""}{sector.avg_daily_return.toFixed(2)}%
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr style={{ borderBottom: '1px solid var(--border)' }}>
                          <td colSpan={3} style={{ padding: '0 8px 16px 8px' }}>
                            <div style={{ 
                              background: 'var(--bg-1)', 
                              padding: '16px', 
                              borderRadius: '8px',
                              display: 'flex',
                              flexWrap: 'wrap',
                              gap: '8px',
                              border: '1px solid var(--border)'
                            }}>
                              {sectorTickers.length > 0 ? sectorTickers.map(t => (
                                <Link key={t.ticker} href={`/markets/${t.ticker}`} style={{ 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  gap: '8px', 
                                  background: 'var(--bg-2)', 
                                  padding: '8px 16px', 
                                  borderRadius: '20px',
                                  fontSize: '15px',
                                  textDecoration: 'none',
                                  color: 'var(--text-primary)',
                                  border: '1px solid var(--border)',
                                  fontWeight: 600,
                                  transition: 'border-color 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--text-secondary)'}
                                onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
                                >
                                  <TickerLogo ticker={t.ticker} size={24} />
                                  <span>{t.ticker}</span>
                                </Link>
                              )) : (
                                <span style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>No tickers found for this sector.</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
                {displayedSectors.length === 0 && (
                  <tr>
                    <td colSpan={3} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-tertiary)' }}>No sector data available.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Ticker Rankings Table */}
        <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '24px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', marginBottom: '24px', gap: '16px' }}>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 600 }}>Ticker Rankings</h2>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', transform: 'translateX(-80px)' }}>
              <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-1)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <button 
                  onClick={() => setRankingMetric("rsi")}
                  style={{ 
                    padding: '6px 16px', 
                    borderRadius: '6px', 
                    fontSize: '13px', 
                    fontWeight: 600, 
                    background: rankingMetric === "rsi" ? 'var(--bg-3)' : 'transparent',
                    color: rankingMetric === "rsi" ? 'var(--text-primary)' : 'var(--text-secondary)',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >RSI</button>
                <button 
                  onClick={() => setRankingMetric("volatility")}
                  style={{ 
                    padding: '6px 16px', 
                    borderRadius: '6px', 
                    fontSize: '13px', 
                    fontWeight: 600, 
                    background: rankingMetric === "volatility" ? 'var(--bg-3)' : 'transparent',
                    color: rankingMetric === "volatility" ? 'var(--text-primary)' : 'var(--text-secondary)',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >Volatility</button>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <div style={{ position: 'relative', width: '48px', height: '48px' }}>
                <div style={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: '8px', background: isTickerSearchOpen ? 'var(--bg-1)' : 'transparent', border: isTickerSearchOpen ? '1px solid var(--border)' : '1px solid transparent', borderRadius: '24px', height: '48px', padding: isTickerSearchOpen ? '0 16px' : '0', transition: 'all 0.2s', zIndex: 20 }}>
                  {isTickerSearchOpen && (
                    <input 
                      autoFocus
                      type="text" 
                      placeholder="Search tickers..." 
                      value={tickerSearch}
                      onChange={(e) => setTickerSearch(e.target.value)}
                      style={{ border: 'none', background: 'transparent', color: 'var(--text-primary)', outline: 'none', width: '200px', fontSize: '16px' }}
                    />
                  )}
                  <button 
                    onClick={() => setIsTickerSearchOpen(!isTickerSearchOpen)} 
                    style={{ background: isTickerSearchOpen ? 'transparent' : 'var(--bg-1)', border: isTickerSearchOpen ? 'none' : '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', borderRadius: '24px', flexShrink: 0, transition: 'all 0.2s' }}
                    title="Search"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8"></circle>
                      <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div style={{ overflowX: 'auto', overflowY: 'auto', flex: 1, minHeight: 0, maxHeight: '550px' }}>
            <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-2)', zIndex: 10 }}>
                <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-tertiary)', fontSize: '14px', textTransform: 'uppercase' }}>
                  <th style={{ padding: '16px 12px', width: '15%' }}>Rank</th>
                  <th style={{ padding: '16px 12px', width: '35%' }}>Ticker</th>
                  <th style={{ padding: '16px 12px', width: '25%' }}>
                    {rankingMetric === "rsi" ? "Status" : ""}
                  </th>
                  <th 
                    style={{ padding: '16px 12px', textAlign: 'right', width: '25%', cursor: 'pointer', userSelect: 'none', transition: 'color 0.2s' }}
                    onClick={() => setSortOrder(prev => prev === "desc" ? "asc" : "desc")}
                    onMouseEnter={(e) => e.currentTarget.style.color = 'var(--brand)'}
                    onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-tertiary)'}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                      {rankingMetric === "rsi" ? "RSI (14)" : "30d Volatility"}
                      <span style={{ fontSize: '10px', color: 'var(--brand)' }}>{sortOrder === "desc" ? "▼" : "▲"}</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rankingMetric === "rsi" ? (
                  displayedQuotes.map((quote, idx) => {
                    const rsi = quote.rsi as number;
                    let status = "Neutral";
                    let statusColor = "var(--text-secondary)";
                    if (rsi >= 70) {
                      status = "Overbought";
                      statusColor = "var(--loss)";
                    } else if (rsi <= 30) {
                      status = "Oversold";
                      statusColor = "var(--gain)";
                    }
                    return (
                      <tr key={quote.ticker} style={{ borderBottom: '1px solid var(--border)', fontSize: '16px' }}>
                        <td style={{ padding: '24px 12px', color: 'var(--text-secondary)' }}>#{sortOrder === "desc" ? idx + 1 : displayedQuotes.length - idx}</td>
                        <td style={{ padding: '24px 12px' }}>
                          <Link href={`/markets/${quote.ticker}`} style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-primary)', textDecoration: 'none' }}>
                            <TickerLogo ticker={quote.ticker} size={32} />
                            <span style={{ fontWeight: 700 }}>{quote.ticker}</span>
                          </Link>
                        </td>
                        <td style={{ padding: '24px 12px', color: statusColor, fontWeight: 600 }}>
                          {status}
                        </td>
                        <td style={{ padding: '24px 12px', textAlign: 'right', fontWeight: 600, fontSize: '18px', fontFamily: 'var(--font-mono)' }}>
                          {rsi.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  displayedVolQuotes.map((quote, idx) => {
                    const vol = quote.volatility as number;
                    const volPercent = (vol * 100).toFixed(2);
                    return (
                      <tr key={quote.ticker} style={{ borderBottom: '1px solid var(--border)', fontSize: '16px' }}>
                        <td style={{ padding: '24px 12px', color: 'var(--text-secondary)' }}>#{sortOrder === "desc" ? idx + 1 : displayedVolQuotes.length - idx}</td>
                        <td style={{ padding: '24px 12px' }}>
                          <Link href={`/markets/${quote.ticker}`} style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-primary)', textDecoration: 'none' }}>
                            <TickerLogo ticker={quote.ticker} size={32} />
                            <span style={{ fontWeight: 700 }}>{quote.ticker}</span>
                          </Link>
                        </td>
                        <td style={{ padding: '24px 12px' }}></td>
                        <td style={{ padding: '24px 12px', textAlign: 'right', fontWeight: 600, fontSize: '18px', fontFamily: 'var(--font-mono)' }}>
                          {volPercent}%
                        </td>
                      </tr>
                    );
                  })
                )}
                {rankingMetric === "rsi" && displayedQuotes.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-tertiary)' }}>No RSI data available.</td>
                  </tr>
                )}
                {rankingMetric === "volatility" && displayedVolQuotes.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-tertiary)' }}>No Volatility data available.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
    </>
  );
}
