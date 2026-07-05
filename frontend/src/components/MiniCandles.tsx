const CANDLES = [
  { open: 42, close: 48, high: 51, low: 40 },
  { open: 48, close: 45, high: 50, low: 43 },
  { open: 45, close: 52, high: 54, low: 44 },
  { open: 52, close: 50, high: 55, low: 48 },
  { open: 50, close: 58, high: 60, low: 49 },
  { open: 58, close: 55, high: 61, low: 53 },
  { open: 55, close: 60, high: 63, low: 54 },
  { open: 60, close: 57, high: 62, low: 55 },
  { open: 57, close: 63, high: 65, low: 56 },
  { open: 63, close: 61, high: 66, low: 59 },
  { open: 61, close: 68, high: 70, low: 60 },
  { open: 68, close: 65, high: 71, low: 63 },
  { open: 65, close: 70, high: 73, low: 64 },
  { open: 70, close: 66, high: 72, low: 64 },
  { open: 66, close: 62, high: 68, low: 60 },
  { open: 62, close: 67, high: 69, low: 60 },
  { open: 67, close: 73, high: 75, low: 65 },
  { open: 73, close: 71, high: 76, low: 69 },
  { open: 71, close: 78, high: 80, low: 70 },
  { open: 78, close: 82, high: 84, low: 76 },
  { open: 82, close: 79, high: 85, low: 77 },
  { open: 79, close: 85, high: 87, low: 78 },
];

const WIDTH = 560;
const HEIGHT = 200;
const PADDING_Y = 12;
const SLOT = WIDTH / CANDLES.length;
const CANDLE_WIDTH = Math.min(24, SLOT * 0.55);

function scaleY(value: number) {
  const usable = HEIGHT - PADDING_Y * 2;
  return HEIGHT - PADDING_Y - (value / 100) * usable;
}

export default function MiniCandles() {
  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      width="100%"
      height={HEIGHT}
      role="img"
      aria-label="Illustrative price chart"
    >
      {[25, 50, 75].map((y) => (
        <line
          key={y}
          x1={0}
          x2={WIDTH}
          y1={scaleY(y)}
          y2={scaleY(y)}
          stroke="var(--border)"
          strokeWidth={1}
        />
      ))}
      {CANDLES.map((candle, index) => {
        const isGain = candle.close >= candle.open;
        const color = isGain ? "var(--gain)" : "var(--loss)";
        const x = index * SLOT + SLOT / 2;
        const bodyTop = scaleY(Math.max(candle.open, candle.close));
        const bodyBottom = scaleY(Math.min(candle.open, candle.close));
        const bodyHeight = Math.max(2, bodyBottom - bodyTop);

        return (
          <g key={index}>
            <line
              x1={x}
              x2={x}
              y1={scaleY(candle.high)}
              y2={scaleY(candle.low)}
              stroke={color}
              strokeWidth={1.5}
            />
            <rect
              x={x - CANDLE_WIDTH / 2}
              y={bodyTop}
              width={CANDLE_WIDTH}
              height={bodyHeight}
              rx={1.5}
              fill={color}
            />
          </g>
        );
      })}
    </svg>
  );
}
