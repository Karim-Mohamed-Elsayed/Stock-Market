"use client";

import { useState, useEffect } from "react";

// Hash function to consistently map a ticker to a specific background color
function getTickerColor(symbol: string): string {
  let hash = 0;
  for (let i = 0; i < symbol.length; i++) {
    hash = symbol.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    "#2f6feb", // Brand Blue
    "#0ca30c", // Gain Green
    "#d03b3b", // Loss Red
    "#f5a623", // Warning Orange
    "#8b5cf6", // Purple
    "#ec4899", // Pink
    "#14b8a6", // Teal
    "#f97316", // Bright Orange
  ];
  const index = Math.abs(hash) % colors.length;
  return colors[index];
}

interface Props {
  ticker: string;
  className?: string;
  size?: number;
}

export default function TickerLogo({ ticker, className, size = 16 }: Props) {
  const [attempt, setAttempt] = useState(0); // 0 = EODHD, 1 = FMP, 2 = Placeholder

  // Reset attempt count if the ticker changes
  useEffect(() => {
    setAttempt(0);
  }, [ticker]);

  const normalized = ticker.toUpperCase().replace(".", "-");

  const handleError = () => {
    setAttempt((prev) => prev + 1);
  };

  if (attempt === 0) {
    return (
      <img
        src={`https://eodhd.com/img/logos/US/${normalized}.png`}
        alt={`${ticker} logo`}
        className={className}
        width={size}
        height={size}
        style={{ objectFit: "contain" }}
        loading="lazy"
        onError={handleError}
      />
    );
  }

  if (attempt === 1) {
    return (
      <img
        src={`https://financialmodelingprep.com/image-stock/${normalized}.png`}
        alt={`${ticker} logo`}
        className={className}
        width={size}
        height={size}
        style={{ objectFit: "contain" }}
        loading="lazy"
        onError={handleError}
      />
    );
  }

  // Fallback to stylized circular text placeholder
  const bgColor = getTickerColor(ticker);
  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        backgroundColor: bgColor,
        color: "#ffffff",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: Math.max(9, Math.round(size * 0.55)),
        fontWeight: 700,
        fontFamily: "var(--font-sans)",
        textTransform: "uppercase",
        flexShrink: 0,
      }}
      title={ticker}
    >
      {ticker.charAt(0)}
    </div>
  );
}
