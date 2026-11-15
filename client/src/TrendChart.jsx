import { useEffect, useId, useRef, useState } from 'react';
import { isValidDate, SLOTS } from '../../shared/domain.js';
import './trend-chart.css';

const DAY_MS = 24 * 60 * 60 * 1000;
const HEIGHT = 264;
const PAD = { top: 28, right: 20, bottom: 38, left: 46 };

function dayNumber(value) {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getTime() / DAY_MS;
}

function dateLabel(day, full = false) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    ...(full && { year: 'numeric' }),
    timeZone: 'UTC',
  }).format(new Date(day * DAY_MS));
}

const pointKey = (reading) => `${reading.date}:${reading.slot}`;
const pointLabel = (reading) =>
  `${dateLabel(reading.day, true)}, ${SLOTS.find((slot) => slot.value === reading.slot).label}: ${reading.value} mg/dl`;

// Geometry uses elapsed calendar days, so missing dates keep their actual spacing.
export function buildTrendChart(report, width = 640) {
  if (
    !isValidDate(report?.startDate) ||
    !isValidDate(report?.endDate) ||
    report.startDate > report.endDate
  )
    return null;
  const startDay = dayNumber(report.startDate);
  const endDay = dayNumber(report.endDate);
  const unique = new Map();
  for (const reading of report.readings || []) {
    if (
      !isValidDate(reading.date) ||
      reading.date < report.startDate ||
      reading.date > report.endDate ||
      !SLOTS.some((slot) => slot.value === reading.slot) ||
      !Number.isInteger(reading.value) ||
      reading.value < 40 ||
      reading.value > 600
    )
      continue;
    unique.set(pointKey(reading), { ...reading, day: dayNumber(reading.date) });
  }
  const readings = [...unique.values()].sort(
    (a, b) =>
      a.day - b.day ||
      SLOTS.findIndex((slot) => slot.value === a.slot) -
        SLOTS.findIndex((slot) => slot.value === b.slot),
  );
  if (!readings.length) return null;
  const values = readings.map((reading) => reading.value);
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const padding = Math.max(10, (maximum - minimum) * 0.15);
  const step =
    [10, 20, 25, 50, 100, 200].find(
      (candidate) => candidate >= (maximum - minimum + padding * 2) / 4,
    ) || 200;
  const minY = Math.max(40, Math.floor((minimum - padding) / step) * step);
  const maxY = Math.min(600, Math.ceil((maximum + padding) / step) * step);
  const plotWidth = Math.max(1, width - PAD.left - PAD.right);
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const x = (day) =>
    PAD.left +
    (endDay === startDay
      ? plotWidth / 2
      : ((day - startDay) / (endDay - startDay)) * plotWidth);
  const y = (value) => PAD.top + ((maxY - value) / (maxY - minY)) * plotHeight;
  const yTicks = [minY];
  for (let value = Math.ceil(minY / step) * step; value <= maxY; value += step)
    if (value > minY) yTicks.push(value);
  if (yTicks.at(-1) !== maxY) yTicks.push(maxY);
  const tickCount = Math.min(width < 480 ? 3 : 5, endDay - startDay + 1);
  const xTicks = Array.from(
    { length: tickCount },
    (_, index) =>
      startDay +
      (tickCount === 1
        ? 0
        : Math.round((index * (endDay - startDay)) / (tickCount - 1))),
  );
  const series = SLOTS.map((slot) => {
    const points = readings
      .filter((reading) => reading.slot === slot.value)
      .map((reading) => ({
        ...reading,
        x: x(reading.day),
        y: y(reading.value),
      }));
    const segments = [];
    for (const point of points) {
      const segment = segments.at(-1);
      if (segment && point.day === segment.at(-1).day + 1) segment.push(point);
      else segments.push([point]);
    }
    const paths = segments
      .filter((segment) => segment.length > 1)
      .map((segment) =>
        segment
          .map(
            (point, index) =>
              `${index ? 'L' : 'M'}${point.x.toFixed(2)},${point.y.toFixed(2)}`,
          )
          .join(' '),
      );
    return { slot: slot.value, points, paths };
  });
  return {
    readings,
    series,
    xTicks: xTicks.map((day) => ({ day, x: x(day), label: dateLabel(day) })),
    yTicks: yTicks.map((value) => ({ value, y: y(value) })),
    minY,
    maxY,
    width,
    height: HEIGHT,
  };
}

function Marker({ index, x, y }) {
  if (index === 1)
    return (
      <rect
        className="trend-marker"
        x={x - 3.7}
        y={y - 3.7}
        width="7.4"
        height="7.4"
        rx="1"
      />
    );
  if (index === 2)
    return (
      <path
        className="trend-marker"
        d={`M${x},${y - 5} L${x + 5},${y} L${x},${y + 5} L${x - 5},${y} Z`}
      />
    );
  if (index === 3)
    return (
      <path
        className="trend-marker"
        d={`M${x},${y - 5} L${x + 4.8},${y + 3.8} L${x - 4.8},${y + 3.8} Z`}
      />
    );
  return <circle className="trend-marker" cx={x} cy={y} r="4.1" />;
}

export default function TrendChart({ report }) {
  const id = useId();
  const chartRef = useRef(null);
  const [width, setWidth] = useState(640);
  const [focusedKey, setFocusedKey] = useState(null);
  const hasReadings = Boolean(report?.readings?.length);
  useEffect(() => {
    if (!chartRef.current || typeof ResizeObserver === 'undefined')
      return undefined;
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width > 0)
        setWidth(Math.max(260, Math.round(entry.contentRect.width)));
    });
    observer.observe(chartRef.current);
    return () => observer.disconnect();
  }, [hasReadings]);
  const chart = buildTrendChart(report, width);
  const focusedReading = chart?.readings.find(
    (reading) => pointKey(reading) === focusedKey,
  );
  if (!chart)
    return (
      <div className="trend-empty">
        <h3>No readings to chart</h3>
        <p>Recorded readings will appear here for this date range.</p>
      </div>
    );
  const dateCount = new Set(chart.readings.map((reading) => reading.date)).size;
  const description = `${chart.readings.length} readings across ${dateCount} ${dateCount === 1 ? 'date' : 'dates'}, in mg/dl. Each line represents one time slot. Lines connect consecutive dates only; gaps mean no reading was recorded. The vertical axis scales to the readings shown.`;

  return (
    <figure className="trend-chart" aria-labelledby={`${id}-heading`}>
      <figcaption className="trend-caption">
        <div>
          <h3 id={`${id}-heading`}>Readings over time</h3>
          <p>
            {chart.readings.length} readings across {dateCount}{' '}
            {dateCount === 1 ? 'date' : 'dates'} · mg/dl
          </p>
        </div>
        <span className="trend-axis-note">Axis scales to recorded values</span>
      </figcaption>
      <ul className="trend-legend" aria-label="Time slots">
        {SLOTS.map((slot, index) => (
          <li key={slot.value} className={`trend-series-${index}`}>
            <svg width="27" height="14" viewBox="0 0 27 14" aria-hidden="true">
              <line className="trend-line" x1="0" x2="27" y1="7" y2="7" />
              <Marker index={index} x={13.5} y={7} />
            </svg>
            <span>{slot.label}</span>
          </li>
        ))}
      </ul>
      <details className="trend-data">
        <summary>
          View readings as a table <span>{chart.readings.length}</span>
        </summary>
        <div
          className="trend-table-scroll"
          tabIndex="0"
          role="region"
          aria-label="Recorded values table"
        >
          <table>
            <caption>Recorded values in this report</caption>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Time slot</th>
                <th scope="col">Glucose (mg/dl)</th>
              </tr>
            </thead>
            <tbody>
              {chart.readings.map((reading) => (
                <tr key={pointKey(reading)}>
                  <td>{dateLabel(reading.day, true)}</td>
                  <td>
                    {SLOTS.find((slot) => slot.value === reading.slot).label}
                  </td>
                  <td>{reading.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <div ref={chartRef} className="trend-plot">
        <svg
          viewBox={`0 0 ${chart.width} ${chart.height}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-labelledby={`${id}-title ${id}-description`}
        >
          <title id={`${id}-title`}>
            Glucose readings by date and time slot
          </title>
          <desc id={`${id}-description`}>{description}</desc>
          <g aria-hidden="true">
            <text className="trend-unit" x={PAD.left} y="13">
              mg/dl
            </text>
            {chart.yTicks.map((tick) => (
              <g key={tick.value}>
                <line
                  className="trend-grid"
                  x1={PAD.left}
                  x2={chart.width - PAD.right}
                  y1={tick.y}
                  y2={tick.y}
                />
                <text
                  className="trend-tick"
                  x={PAD.left - 10}
                  y={tick.y + 4}
                  textAnchor="end"
                >
                  {tick.value}
                </text>
              </g>
            ))}
            {chart.xTicks.map((tick) => (
              <text
                className="trend-tick"
                key={tick.day}
                x={tick.x}
                y={chart.height - 13}
                textAnchor="middle"
              >
                {tick.label}
              </text>
            ))}
          </g>
          {chart.series.map((series, index) => (
            <g className={`trend-series-${index}`} key={series.slot}>
              {series.paths.map((path, segment) => (
                <path
                  className="trend-line"
                  d={path}
                  key={segment}
                  fill="none"
                  aria-hidden="true"
                />
              ))}
              {series.points.map((point) => (
                <g
                  className="trend-point"
                  key={pointKey(point)}
                  tabIndex="0"
                  role="img"
                  aria-label={pointLabel(point)}
                  onFocus={() => setFocusedKey(pointKey(point))}
                  onBlur={() => setFocusedKey(null)}
                >
                  <title>{pointLabel(point)}</title>
                  <circle
                    className="trend-focus-ring"
                    cx={point.x}
                    cy={point.y}
                    r="8"
                  />
                  <Marker index={index} x={point.x} y={point.y} />
                </g>
              ))}
            </g>
          ))}
        </svg>
      </div>
      <p className="trend-point-detail">
        {focusedReading
          ? pointLabel(focusedReading)
          : 'Tab to a point for its exact reading, or open the table.'}
      </p>
      <p className="trend-explanation">
        Lines join consecutive dates within the same time slot. Gaps mean no
        reading was recorded.
      </p>
    </figure>
  );
}
