import { useEffect, useMemo, useRef, useState } from 'react';
import type { CalendarEvent, HouseholdSnapshot } from '../shared/contracts';
import { conflictIds, dateAt, dateLabel, dayNumber, distanceLabel, eventBounds, overview, zoomOrigin } from './time';

const categoryIcons = { travel: '↗', school: '▤', activity: '◇', health: '+', social: '✳' };
export function Timeline({ snapshot, onOpen }: { snapshot: HouseholdSnapshot; onOpen: (event: CalendarEvent) => void }) {
  const initial = overview(snapshot.today);
  const [origin, setOrigin] = useState(initial.origin);
  const [span, setSpan] = useState(initial.days);
  const [width, setWidth] = useState(900);
  const viewport = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; origin: number } | null>(null);
  const today = dayNumber(snapshot.today);
  const scale = width / span;
  const center = origin + span / 2;
  const minCenter = today - 730, maxCenter = today + 730;
  const conflicts = useMemo(() => conflictIds(snapshot.events), [snapshot.events]);
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const update = () => setWidth(element.clientWidth || 900);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  function zoom(nextSpan: number) {
    setOrigin(zoomOrigin(origin, scale, width / nextSpan, width / 2));
    setSpan(nextSpan);
  }
  function move(next: number) { setOrigin(Math.min(maxCenter - span / 2, Math.max(minCenter - span / 2, next))); }
  const visible = snapshot.events.map((event) => ({ event, bounds: eventBounds(event, snapshot.household.timeZone) }))
    .filter(({ bounds }) => bounds[0] < origin + span && bounds[1] > origin)
    .sort((a, b) => a.bounds[0] - b.bounds[0] || a.event.id.localeCompare(b.event.id));
  const laneEnds: number[] = [];
  const laidOut = visible.map(({ event, bounds }) => {
    const x = Math.max(0, (bounds[0] - origin) * scale);
    const eventWidth = Math.min(width - x, Math.max(span <= 7 ? 170 : 145, (bounds[1] - Math.max(origin, bounds[0])) * scale - 4));
    let lane = laneEnds.findIndex((end) => end + 10 <= x);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = x + eventWidth;
    return { event, bounds, x, eventWidth, lane };
  });
  const months: { day: number; end: number }[] = [];
  let month = new Date(`${dateAt(origin)}T00:00:00Z`);
  month = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1));
  while (month.getTime() / 86_400_000 < origin + span) {
    const day = month.getTime() / 86_400_000;
    month = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1));
    months.push({ day, end: month.getTime() / 86_400_000 });
  }
  const ticks = Array.from({ length: Math.ceil(span) + 1 }, (_, i) => Math.floor(origin) + i);
  const mode = span <= 2 ? 'day' : span <= 14 ? 'week' : 'month';
  const trackHeight = Math.max(300, laneEnds.length * 66 + 56);
  return <section className="calendar-section" aria-label="Spatial calendar">
    <div className="calendar-toolbar">
      <div className="period-controls">
        <button className="icon-button" aria-label="Previous period" disabled={center <= minCenter} onClick={() => move(origin - (span > 14 ? span / 3 : span))}>‹</button>
        <button className="today-button" onClick={() => { setOrigin(span > 14 ? overview(snapshot.today).origin : today + .5 - span / 2); }}>Today</button>
        <button className="icon-button" aria-label="Next period" disabled={center >= maxCenter} onClick={() => move(origin + (span > 14 ? span / 3 : span))}>›</button>
        <span className="range-label">{dateLabel(origin, { month: 'short', year: 'numeric' })}{span > 14 && ` — ${dateLabel(origin + span - 1, { month: 'short', year: 'numeric' })}`}</span>
      </div>
      <div className="view-switch" aria-label="Calendar detail level">{(['Month', 'Week', 'Day'] as const).map((label) => <button key={label} aria-pressed={mode === label.toLowerCase()} onClick={() => zoom(label === 'Month' ? initial.days : label === 'Week' ? 7 : 1)}>{label}</button>)}</div>
    </div>
    <div className="timeline-viewport" ref={viewport} data-testid="timeline-viewport" data-origin={origin} data-scale={scale} data-center={center} data-width={width}>
      <div className="month-axis">{months.map(({ day, end }) => <div className="month-label" key={day} style={{ left: Math.max(0, (day - origin) * scale), width: (Math.min(end, origin + span) - Math.max(day, origin)) * scale }}><span>{dateLabel(day, { month: span > 14 ? 'long' : 'short' })}</span><small>{dateLabel(day, { year: 'numeric' })}</small></div>)}</div>
      <div className="date-axis" aria-hidden="true">{ticks.map((day) => <div key={day} className={`date-tick ${day === today ? 'current-date' : ''}`} style={{ left: (day - origin) * scale, width: scale }}>
        {(scale > 24 || new Date(day * 86_400_000).getUTCDay() === 1) && <><span>{dateLabel(day, { day: 'numeric' })}</span>{scale > 70 && <small>{dateLabel(day, { weekday: 'short' })}</small>}</>}
      </div>)}{span <= 2 && Array.from({ length: Math.ceil(span * 24) }, (_, i) => { const hour = Math.ceil(origin * 24) + i; return <small className="hour-tick" key={hour} style={{ left: (hour / 24 - origin) * scale }}>{hour % 24 === 0 ? '12a' : hour % 24 < 12 ? `${hour % 24}a` : hour % 24 === 12 ? '12p' : `${hour % 24 - 12}p`}</small>; })}</div>
      <div className="timeline-pan" tabIndex={0} aria-label="Calendar timeline. Use left and right arrow keys to move through time." onKeyDown={(event) => { if (event.target !== event.currentTarget) return; if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); move(origin + (event.key === 'ArrowLeft' ? -1 : 1) * span / 4); } }}
        onWheel={(event) => { if (Math.abs(event.deltaX) > 0 || event.shiftKey) move(origin + (event.deltaX || event.deltaY) / scale); }}
        onPointerDown={(event) => { if ((event.target as HTMLElement).closest('button')) return; drag.current = { x: event.clientX, origin }; event.currentTarget.setPointerCapture(event.pointerId); }}
        onPointerMove={(event) => { if (drag.current) move(drag.current.origin + (drag.current.x - event.clientX) / scale); }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
        <div className="timeline-track" style={{ height: trackHeight }}>
          {ticks.map((day) => <div key={day} className={`day-column ${[0, 6].includes(new Date(day * 86_400_000).getUTCDay()) ? 'weekend' : ''}`} style={{ left: (day - origin) * scale, width: scale }} />)}
          {today + .5 >= origin && today + .5 < origin + span && <div className="today-line" style={{ left: (today + .5 - origin) * scale }}><span>Today</span></div>}
          {laidOut.map(({ event, bounds, x, eventWidth, lane }) => <button key={event.id} data-event-id={event.id} className={`timeline-event category-${event.category}`} style={{ left: x, top: 38 + lane * 66, width: eventWidth }} onClick={() => onOpen(event)} aria-label={`${event.title}, ${distanceLabel(bounds[0], snapshot.today)}${conflicts.has(event.id) ? ', scheduling conflict' : ''}`}>
            <span className="event-name"><span aria-hidden="true">{categoryIcons[event.category]}</span> {event.title}</span>
            <span className="event-meta">{conflicts.has(event.id) ? '⚑ Overlap · ' : ''}{span > 14 ? dateLabel(bounds[0]) : event.time.kind === 'allDay' ? 'All day' : new Intl.DateTimeFormat('en-US', { timeZone: snapshot.household.timeZone, hour: 'numeric', minute: '2-digit' }).format(new Date(event.time.start))}<span className="event-person">{snapshot.members.find((member) => member.id === event.participantIds[0])?.name.split(' ')[0] ?? 'Family'}</span></span>
          </button>)}
          {!visible.length && <div className="timeline-empty"><span>◎</span><strong>A little breathing room.</strong><p>No events in this view. Move through time or select more calendars.</p></div>}
        </div>
      </div>
    </div>
    <div className="timeline-footer"><span className="pan-hint">↔ Drag or shift-scroll to explore</span><label className="zoom-control"><span>Overview</span><input aria-label="Zoom level" type="range" min="0" max="100" step="0.1" value={100 * (1 - Math.log(span) / Math.log(initial.days))} onChange={(event) => zoom(Math.exp(Math.log(initial.days) * (1 - Number(event.target.value) / 100)))} /><span>Detail</span></label></div>
    <label className="time-position"><span className="sr-only">Move through time</span><input aria-label="Move through time" type="range" min={minCenter} max={maxCenter} step="0.25" value={center} onChange={(event) => move(Number(event.target.value) - span / 2)} /></label>
    <div className="calendar-legend"><span><i className="legend-dot travel" />Travel</span><span><i className="legend-dot school" />School</span><span><i className="legend-dot activity" />Activities</span><span><i className="legend-dot health" />Health</span><span><i className="legend-dot social" />Social</span><span className="zone-label">{snapshot.household.timeZone.replaceAll('_', ' ')}</span></div>
  </section>;
}
