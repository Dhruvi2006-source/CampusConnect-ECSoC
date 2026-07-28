import { format, getDay, parse, startOfWeek } from "date-fns";
import { enUS } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { useEffect, useRef } from "react";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const locales = {
  "en-US": enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

interface EventItem {
  id: string;
  short_id?: string | null;
  title: string;
  description: string | null;
  event_date: string | null;
  start_date?: string | null;
  end_date?: string | null;
  location: string | null;
  banner_url?: string | null;
  clubs: { name: string } | { name: string }[] | null;
}

interface EventsCalendarProps {
  events: EventItem[];
}

export default function EventsCalendar({ events }: EventsCalendarProps) {
  const navigate = useNavigate();
  const calendarRef = useRef<HTMLDivElement>(null);

  const formattedEvents = events.map((e) => {
    const start = e.start_date
      ? new Date(e.start_date)
      : e.event_date
        ? new Date(e.event_date)
        : new Date();
    const end = e.end_date ? new Date(e.end_date) : new Date(start.getTime() + 60 * 60 * 1000);

    return {
      id: e.short_id || e.id,
      title: e.title,
      start,
      end,
      allDay: false,
    };
  });

  useEffect(() => {
    if (!calendarRef.current) return;

    // Find all navigation buttons inside react-big-calendar and add descriptive aria-labels
    const buttons = calendarRef.current.querySelectorAll(".rbc-btn-group button");
    buttons.forEach((btn) => {
      const text = btn.textContent?.toLowerCase() || "";
      if (text === "today") {
        btn.setAttribute("aria-label", "Go to today");
      } else if (text === "back" || text === "prev" || btn.classList.contains("rbc-prev-button")) {
        btn.setAttribute("aria-label", "Previous period");
      } else if (text === "next" || btn.classList.contains("rbc-next-button")) {
        btn.setAttribute("aria-label", "Next period");
      } else if (text === "month") {
        btn.setAttribute("aria-label", "Switch to month view");
      } else if (text === "week") {
        btn.setAttribute("aria-label", "Switch to week view");
      } else if (text === "day") {
        btn.setAttribute("aria-label", "Switch to day view");
      }
    });

    // Ensure all grid cells have proper roles
    const gridCells = calendarRef.current.querySelectorAll(".rbc-day-bg");
    gridCells.forEach((cell, idx) => {
      cell.setAttribute("role", "gridcell");
      cell.setAttribute("tabindex", "0");
      cell.setAttribute("aria-label", `Calendar day ${idx + 1}`);
    });
  }, [events]);

  return (
    <div
      ref={calendarRef}
      className="neu-border bg-white p-4 h-[600px] md:h-[700px] w-full"
      role="region"
      aria-label="Event Calendar Grid"
      tabIndex={0}
    >
      <Calendar
        localizer={localizer}
        events={formattedEvents}
        startAccessor="start"
        endAccessor="end"
        style={{ height: "100%" }}
        views={["month", "week"]}
        view={view}
        onView={(newView) => setView(newView)}
        eventPropGetter={() => ({
          className: "calendar-rsvp-event",
        })}
        onSelectEvent={(event: { id: string }) => {
          navigate(`/events/${event.id}`);
        }}
      />
    </div>
  );
}
