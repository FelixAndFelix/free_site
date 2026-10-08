import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { VOTE_VALUES, type VoteHistoryDay } from "@free-site/shared";
import { useI18n } from "../../i18n";
import { VOTE_META } from "../../votes";

const HEIGHT = 220;
const MARGIN = { top: 12, right: 16, bottom: 28, left: 32 };
const DEFAULT_WIDTH = 600;
// Drawn last on top, so the most common overlap (two lines at 0) shows green above the others.
const DRAW_ORDER = [...VOTE_VALUES].reverse();

type DayStyle = "short" | "medium" | "long";
const DAY_OPTIONS: Record<DayStyle, Intl.DateTimeFormatOptions> = {
  short: { day: "numeric", month: "short", timeZone: "UTC" },
  medium: { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" },
  long: { weekday: "short", day: "numeric", month: "long", timeZone: "UTC" },
};

/**
 * Formats a YYYY-MM-DD day for axis labels ("short"), table rows ("medium") or the tooltip ("long").
 * @param {string} locale
 * @param {string} day
 * @param {DayStyle} style
 */
function formatDay(locale: string, day: string, style: DayStyle): string {
  return new Intl.DateTimeFormat(locale, DAY_OPTIONS[style]).format(new Date(`${day}T00:00:00Z`));
}

/**
 * Integer y-axis ticks from 0 to at least the maximum, at most about five of them.
 * @param {number} maximum
 */
function yTicks(maximum: number): number[] {
  const step = Math.max(1, Math.ceil(maximum / 4));
  const top = Math.max(step, Math.ceil(maximum / step) * step);
  return Array.from({ length: top / step + 1 }, (_, index) => index * step);
}

/**
 * Indices of the days that get an x-axis label: every step-th day from the first, with a whole
 * number of days between labels. The last day always gets a label; if it is closer than one step
 * to the label before it, it replaces that label instead of crowding it.
 * @param {number} count
 * @param {number} plotWidth
 */
function xLabelIndices(count: number, plotWidth: number): number[] {
  const maxLabels = Math.max(2, Math.floor(plotWidth / 70));
  const step = Math.max(1, Math.ceil((count - 1) / (maxLabels - 1)));
  const indices = [];
  for (let index = 0; index < count; index += step) indices.push(index);
  const last = count - 1;
  if (indices.at(-1) === last) return indices;
  if (last - indices.at(-1)! < step && indices.length > 1) indices.pop();
  indices.push(last);
  return indices;
}

/** Tracks the rendered width of an element, so the SVG draws at real pixel size and text never scales. */
function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(DEFAULT_WIDTH);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry!.contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { ref, width };
}

/**
 * Line chart of the vote counts per day, one line per vote value, with a crosshair tooltip
 * (pointer and arrow keys) and a table view, so no value is reachable only by hovering.
 * @param {{history: VoteHistoryDay[]}} props
 */
export function HistoryChart({ history }: { history: VoteHistoryDay[] }) {
  const { t, locale } = useI18n();
  const { ref, width } = useWidth();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const plotWidth = Math.max(1, width - MARGIN.left - MARGIN.right);
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const maximum = Math.max(...history.flatMap(({ counts }) => VOTE_VALUES.map((value) => counts[value])));
  const ticks = yTicks(maximum);
  const top = ticks.at(-1)!;
  const x = (index: number) =>
    MARGIN.left + (history.length === 1 ? plotWidth / 2 : (index / (history.length - 1)) * plotWidth);
  const y = (count: number) => MARGIN.top + plotHeight - (count / top) * plotHeight;
  const last = history.length - 1;

  /** Snaps the crosshair to the day nearest to the pointer. */
  function handlePointer(event: PointerEvent<SVGSVGElement>) {
    const left = event.currentTarget.getBoundingClientRect().left;
    const ratio = (event.clientX - left - MARGIN.left) / plotWidth;
    setActiveIndex(Math.min(last, Math.max(0, Math.round(ratio * last))));
  }

  /** Moves the crosshair with the arrow keys, for keyboard users. */
  function handleKey(event: KeyboardEvent<SVGSVGElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const step = event.key === "ArrowLeft" ? -1 : 1;
    setActiveIndex((index) => Math.min(last, Math.max(0, (index ?? last) + step)));
  }

  const active = activeIndex === null ? null : history[activeIndex]!;
  // Beside the crosshair rather than over it, so the tooltip never covers the dots it describes.
  const TOOLTIP_WIDTH = 160;
  const crosshairX = activeIndex === null ? 0 : x(activeIndex);
  const tooltipLeft =
    crosshairX + 12 + TOOLTIP_WIDTH <= width ? crosshairX + 12 : Math.max(0, crosshairX - 12 - TOOLTIP_WIDTH);

  return (
    <figure className="history-chart">
      <div className="chart-legend">
        {VOTE_VALUES.map((value) => (
          <span key={value} className="vote-legend-item">
            <span className="line-key" style={{ background: VOTE_META[value].color }} aria-hidden="true" />
            {t(VOTE_META[value].labelKey)}
          </span>
        ))}
      </div>
      <div ref={ref} className="chart-area">
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={t("chart.label", {
            from: formatDay(locale, history[0]!.day, "long"),
            to: formatDay(locale, history[last]!.day, "long"),
          })}
          tabIndex={0}
          onPointerMove={handlePointer}
          onPointerLeave={() => setActiveIndex(null)}
          onKeyDown={handleKey}
          onBlur={() => setActiveIndex(null)}
        >
          {ticks.map((tick) => (
            <g key={tick}>
              <line className="grid-line" x1={MARGIN.left} x2={width - MARGIN.right} y1={y(tick)} y2={y(tick)} />
              <text className="axis-label" x={MARGIN.left - 8} y={y(tick)} textAnchor="end" dominantBaseline="middle">
                {tick}
              </text>
            </g>
          ))}
          {xLabelIndices(history.length, plotWidth).map((index) => (
            <text
              key={index}
              className="axis-label"
              x={x(index)}
              y={HEIGHT - 8}
              textAnchor={history.length === 1 ? "middle" : index === 0 ? "start" : index === last ? "end" : "middle"}
            >
              {formatDay(locale, history[index]!.day, "short")}
            </text>
          ))}
          {activeIndex !== null && (
            <line className="crosshair" x1={x(activeIndex)} x2={x(activeIndex)} y1={MARGIN.top} y2={MARGIN.top + plotHeight} />
          )}
          {DRAW_ORDER.map((value) => (
            <g key={value}>
              {history.length > 1 && (
                <polyline
                  className="series-line"
                  stroke={VOTE_META[value].color}
                  points={history.map(({ counts }, index) => `${x(index)},${y(counts[value])}`).join(" ")}
                />
              )}
              <circle
                className="series-dot"
                fill={VOTE_META[value].color}
                cx={x(activeIndex ?? last)}
                cy={y(history[activeIndex ?? last]!.counts[value])}
                r={4}
              />
            </g>
          ))}
        </svg>
        {active && (
          <div className="chart-tooltip" style={{ left: tooltipLeft }} role="status">
            <div className="muted">{formatDay(locale, active.day, "long")}</div>
            {VOTE_VALUES.map((value) => (
              <div key={value} className="tooltip-row">
                <span className="line-key" style={{ background: VOTE_META[value].color }} aria-hidden="true" />
                <strong>{active.counts[value]}</strong>
                <span className="muted">{t(VOTE_META[value].labelKey)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <details className="chart-table">
        <summary>{t("chart.showTable")}</summary>
        <table>
          <thead>
            <tr>
              <th scope="col">{t("chart.day")}</th>
              {VOTE_VALUES.map((value) => (
                <th key={value} scope="col">
                  {t(VOTE_META[value].labelKey)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...history].reverse().map(({ day, counts }) => (
              <tr key={day}>
                <th scope="row">{formatDay(locale, day, "medium")}</th>
                {VOTE_VALUES.map((value) => (
                  <td key={value}>{counts[value]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
