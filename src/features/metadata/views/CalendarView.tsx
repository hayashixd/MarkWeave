import { useMemo, useState } from 'react';
import type { QueryResultRow } from '../types';

interface CalendarViewProps {
  rows: QueryResultRow[];
  dateField: string; // 'date' | 'created' | 'modified'
  onRowClick: (row: QueryResultRow) => void;
}

export function CalendarView({ rows, dateField, onRowClick }: CalendarViewProps) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const byDate = useMemo(() => {
    const map = new Map<string, QueryResultRow[]>();
    for (const row of rows) {
      const dateVal = row.fields[dateField] ?? row.fields['modified'] ?? row.fields['modified_at'];
      if (!dateVal) continue;
      const dateStr = String(dateVal).slice(0, 10); // "YYYY-MM-DD"
      if (!map.has(dateStr)) map.set(dateStr, []);
      map.get(dateStr)!.push(row);
    }
    return map;
  }, [rows, dateField]);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0=Sun
  // Convert to Monday-based: 0=Mon ... 6=Sun
  const startOffset = (firstDayOfWeek + 6) % 7;

  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const prevMonth = () => {
    if (month === 0) {
      setYear(year - 1);
      setMonth(11);
    } else {
      setMonth(month - 1);
    }
  };

  const nextMonth = () => {
    if (month === 11) {
      setYear(year + 1);
      setMonth(0);
    } else {
      setMonth(month + 1);
    }
  };

  return (
    <div className="metadata-calendar-view" style={{ padding: '8px' }}>
      {/* Navigation */}
      <div
        className="calendar-nav"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          marginBottom: '8px',
          fontSize: '0.9rem',
          fontWeight: 600,
        }}
      >
        <button
          onClick={prevMonth}
          style={{
            background: 'none',
            border: '1px solid var(--border-color, #e2e8f0)',
            borderRadius: '4px',
            cursor: 'pointer',
            padding: '2px 8px',
            fontSize: '0.9rem',
            color: 'var(--text-color, #2d3748)',
          }}
          aria-label="前の月"
        >
          ‹
        </button>
        <span>
          {year}年 {month + 1}月
        </span>
        <button
          onClick={nextMonth}
          style={{
            background: 'none',
            border: '1px solid var(--border-color, #e2e8f0)',
            borderRadius: '4px',
            cursor: 'pointer',
            padding: '2px 8px',
            fontSize: '0.9rem',
            color: 'var(--text-color, #2d3748)',
          }}
          aria-label="次の月"
        >
          ›
        </button>
      </div>

      {/* Calendar Grid */}
      <div
        className="calendar-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: '1px',
          fontSize: '0.8rem',
        }}
      >
        {/* Day headers */}
        {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => (
          <div
            key={d}
            className="day-header"
            style={{
              textAlign: 'center',
              padding: '4px 2px',
              fontWeight: 600,
              color: 'var(--text-muted, #718096)',
              borderBottom: '1px solid var(--border-color, #e2e8f0)',
            }}
          >
            {d}
          </div>
        ))}

        {/* Empty cells before first day */}
        {Array.from({ length: startOffset }, (_, i) => (
          <div key={`empty-${i}`} style={{ minHeight: '40px' }} />
        ))}

        {/* Day cells */}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const entries = byDate.get(dateStr) ?? [];
          const isToday = dateStr === todayStr;

          return (
            <div
              key={day}
              className={`calendar-day${entries.length ? ' has-entries' : ''}`}
              style={{
                minHeight: '40px',
                padding: '2px 4px',
                border: '1px solid var(--border-color, #edf2f7)',
                borderRadius: '3px',
                background: isToday
                  ? 'var(--calendar-today-bg, rgba(49, 130, 206, 0.08))'
                  : entries.length
                    ? 'var(--calendar-entry-bg, rgba(49, 130, 206, 0.03))'
                    : 'transparent',
                overflow: 'hidden',
              }}
            >
              <span
                className="day-num"
                style={{
                  display: 'inline-block',
                  fontSize: '0.75rem',
                  fontWeight: isToday ? 700 : 400,
                  color: isToday
                    ? 'var(--link-color, #3182ce)'
                    : 'var(--text-muted, #718096)',
                  marginBottom: '1px',
                }}
              >
                {day}
              </span>
              {entries.map((row) => (
                <button
                  key={row.path}
                  className="calendar-entry"
                  onClick={() => onRowClick(row)}
                  title={row.title ?? row.name}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    background: 'var(--calendar-chip-bg, rgba(49, 130, 206, 0.12))',
                    color: 'var(--link-color, #3182ce)',
                    border: 'none',
                    borderRadius: '2px',
                    padding: '1px 3px',
                    fontSize: '0.7rem',
                    cursor: 'pointer',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    marginBottom: '1px',
                    lineHeight: 1.3,
                  }}
                >
                  {row.title ?? row.name}
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
