"use client";

import { useEffect, useState } from "react";

import styles from "./SectorPreview.module.css";

interface SectorReturn {
  gics_sector: string;
  avg_daily_return: number | null;
}

const FALLBACK: SectorReturn[] = [
  { gics_sector: "Information Technology", avg_daily_return: 1.24 },
  { gics_sector: "Health Care", avg_daily_return: -0.42 },
  { gics_sector: "Financials", avg_daily_return: 0.68 },
  { gics_sector: "Consumer Discretionary", avg_daily_return: -0.15 },
  { gics_sector: "Communication Services", avg_daily_return: 0.93 },
  { gics_sector: "Industrials", avg_daily_return: 0.21 },
  { gics_sector: "Consumer Staples", avg_daily_return: -0.08 },
  { gics_sector: "Energy", avg_daily_return: -1.35 },
  { gics_sector: "Utilities", avg_daily_return: 0.44 },
  { gics_sector: "Real Estate", avg_daily_return: -0.61 },
  { gics_sector: "Materials", avg_daily_return: 0.12 },
];

const BAR_SCALE_MAX = 1.5; // % move that fills the meter track

export default function SectorPreview() {
  const [sectors, setSectors] = useState<SectorReturn[]>(FALLBACK);

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    let cancelled = false;

    fetch(`${apiUrl}/sectors`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: SectorReturn[]) => {
        if (!cancelled && Array.isArray(data) && data.length > 0) {
          setSectors(data);
        }
      })
      .catch(() => {
        // Gold pipeline may not have populated sector_daily_returns yet;
        // keep the illustrative fallback so the section still reads well.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className={styles.grid}>
      {sectors.map((sector) => {
        const value = sector.avg_daily_return ?? 0;
        const isGain = value >= 0;
        const width = Math.min(100, (Math.abs(value) / BAR_SCALE_MAX) * 100);

        return (
          <div className={styles.cell} key={sector.gics_sector}>
            <span className={styles.name}>{sector.gics_sector}</span>
            <span className={`${styles.value} ${isGain ? "gain" : "loss"}`}>
              {isGain ? "+" : ""}
              {value.toFixed(2)}%
            </span>
            <div className={styles.bar}>
              <div
                className={styles.barFill}
                style={{
                  width: `${width}%`,
                  background: isGain ? "var(--gain)" : "var(--loss)",
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
