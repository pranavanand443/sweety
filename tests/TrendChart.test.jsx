// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import TrendChart, { buildTrendChart } from '../client/src/TrendChart.jsx';

afterEach(cleanup);

const row = (date, slot = 'morning_fasting', value = 120) => ({
  id: `${date}-${slot}`,
  date,
  slot,
  value,
});
const report = (
  readings = [],
  startDate = '2026-11-01',
  endDate = '2026-11-30',
) => ({ startDate, endDate, readings });

describe('Trend chart geometry', () => {
  it('spaces points by calendar date instead of their position in the reading array', () => {
    const chart = buildTrendChart(
      report([row('2026-11-01'), row('2026-11-02'), row('2026-11-10')]),
    );
    const [first, second, tenth] = chart.series[0].points;
    expect(tenth.x - first.x).toBeCloseTo((second.x - first.x) * 9);
    expect(chart.series[0].paths).toHaveLength(1);
    expect(chart.series[0].paths[0].split('L')).toHaveLength(2);
    expect(chart.series[0].paths[0]).not.toContain(tenth.x.toFixed(2));
  });

  it('keeps four time-slot series independent when several readings share a date', () => {
    const chart = buildTrendChart(
      report([
        row('2026-11-01'),
        row('2026-11-01', 'after_breakfast', 140),
        row('2026-11-02', 'after_breakfast', 145),
        row('2026-11-03', 'after_dinner', 130),
      ]),
    );
    expect(chart.series).toHaveLength(4);
    expect(chart.series[0].points[0].x).toBe(chart.series[1].points[0].x);
    expect(chart.series.map((series) => series.paths.length)).toEqual([
      0, 1, 0, 0,
    ]);
  });

  it('does not draw a connecting line across missing dates or across time slots', () => {
    const chart = buildTrendChart(
      report([
        row('2026-11-01'),
        row('2026-11-03'),
        row('2026-11-02', 'after_lunch'),
      ]),
    );
    expect(chart.series.every((series) => series.paths.length === 0)).toBe(
      true,
    );
    expect(chart.readings).toHaveLength(3);
  });

  it.each([40, 120, 600])(
    'keeps a single value of %s within a finite, nonzero scale',
    (value) => {
      const chart = buildTrendChart(
        report(
          [row('2026-11-15', 'morning_fasting', value)],
          '2026-11-15',
          '2026-11-15',
        ),
        300,
      );
      const point = chart.series[0].points[0];
      expect(Number.isFinite(point.x) && Number.isFinite(point.y)).toBe(true);
      expect(chart.maxY).toBeGreaterThan(chart.minY);
      expect(chart.minY).toBeGreaterThanOrEqual(40);
      expect(chart.maxY).toBeLessThanOrEqual(600);
      expect(chart.series[0].paths).toEqual([]);
      expect(chart.xTicks).toHaveLength(1);
      expect(JSON.stringify(chart)).not.toMatch(/NaN|Infinity/);
    },
  );

  it('handles leap days and excludes values outside the selected report', () => {
    const chart = buildTrendChart(
      report(
        [row('2024-02-28'), row('2024-02-29'), row('2024-03-01')],
        '2024-02-01',
        '2024-02-29',
      ),
    );
    expect(chart.readings.map((reading) => reading.date)).toEqual([
      '2024-02-28',
      '2024-02-29',
    ]);
    expect(chart.series[0].paths).toHaveLength(1);
    expect(chart.xTicks.at(-1).label).toBe('29 Feb');
  });
});

describe('Accessible trend chart', () => {
  it('shows a friendly empty state without invalid SVG geometry', () => {
    const { container } = render(<TrendChart report={report()} />);
    expect(screen.getByText('No readings to chart')).toBeVisible();
    expect(container.querySelector('svg')).toBeNull();
  });

  it('describes units and missing dates, labels every time slot and exposes focusable exact values', () => {
    render(
      <TrendChart report={report([row('2026-11-15', 'after_lunch', 132)])} />,
    );
    expect(
      screen.getByRole('img', {
        name: /Glucose readings by date and time slot/,
      }),
    ).toHaveAccessibleName(/in mg\/dl/);
    const legend = screen.getByRole('list', { name: 'Time slots' });
    expect(within(legend).getAllByRole('listitem')).toHaveLength(4);
    const point = screen.getByRole('img', {
      name: '15 Nov 2026, After lunch: 132 mg/dl',
    });
    expect(point).toHaveAttribute('tabindex', '0');
    fireEvent.focus(point);
    expect(
      screen.getByText('15 Nov 2026, After lunch: 132 mg/dl', {
        selector: 'p',
      }),
    ).toBeVisible();
    expect(
      screen.getByText(/Gaps mean no reading was recorded/, { selector: 'p' }),
    ).toBeVisible();
  });

  it('offers an accessible native disclosure containing every recorded value', () => {
    render(
      <TrendChart
        report={report([
          row('2026-11-15', 'after_lunch', 132),
          row('2026-11-16', 'after_dinner', 145),
        ])}
      />,
    );
    const summary = screen.getByText(/View readings as a table/, {
      selector: 'summary',
    });
    fireEvent.click(summary);
    expect(summary.parentElement).toHaveAttribute('open');
    const table = screen.getByRole('table', {
      name: 'Recorded values in this report',
    });
    expect(
      within(table).getByRole('columnheader', { name: 'Glucose (mg/dl)' }),
    ).toBeVisible();
    expect(within(table).getAllByRole('row')).toHaveLength(3);
    expect(within(table).getByRole('cell', { name: '132' })).toBeVisible();
    expect(within(table).getByRole('cell', { name: '145' })).toBeVisible();
    fireEvent.click(summary);
    expect(summary.parentElement).not.toHaveAttribute('open');
  });
});
