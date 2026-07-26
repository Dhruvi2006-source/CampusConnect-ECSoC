import { Link, useParams } from "react-router-dom";
import { useQuery, useMutation } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import { useState, useEffect } from "react";
import { User } from "@supabase/supabase-js";
import { SiteShell } from "@/components/site/SiteShell";
import { SkeletonEventDetails } from "@/components/events/SkeletonEventDetails";
import { formatEventDateRange, getGoogleCalendarUrl } from "@/lib/utils";
import { toast } from "sonner";
import {
  ArrowLeft,
  Calendar,
  Check,
  Copy,
  Download,
  Link as LinkIcon,
  MapPin,
  MapPinOff,
  Share2,
  Users,
  X,
  CheckCircle,
  Clock,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { OptimizedImage } from "@/components/media/OptimizedImage";
import { parseCoordinates } from "@/lib/eventUtils";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";

function rsvpRowsToCsv(rows: { name: string; email: string; rsvp_date: string; status: string }[]) {
  const headers = ["User Name", "Email", "RSVP Date", "Status"];
  const escape = (val: string) => {
    const str = String(val ?? "");
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push([r.name, r.email, r.rsvp_date, r.status].map(escape).join(","));
  }
  return lines.join("\n");
}

function downloadCsv(csvContent: string, filename: string) {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

interface Profile {
  first_name: string;
  last_name: string;
  avatar_url: string | null;
}

interface EventRsvp {
  id: string;
  user_id: string;
  status: string;
  checked_in: boolean;
  rsvp_at: string;
  profiles: Profile | Profile[] | null;
}

interface EventWaitlist {
  id: string;
  user_id: string;
  created_at: string;
  profiles: Profile | Profile[] | null;
}

export default function EventDetailsPage() {
  const { eventId = "" } = useParams();
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);
  const [copied, setCopied] = useState(false);
  const [idCopied, setIdCopied] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
  }, [supabase]);

  const {
    data: event,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["event", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select(
          `
          id, title, description, event_date, start_date, end_date, location, banner_url, created_by, max_attendees, requires_approval,
          clubs (name, slug),
          event_rsvps (id, user_id, status, checked_in, rsvp_at, profiles (first_name, last_name, avatar_url)),
          event_waitlist (id, user_id, created_at, profiles (first_name, last_name, avatar_url))
        `,
        )
        .eq("id", eventId)
        .single();

      if (error) {
        // Fallback to mock data in development if db fails or doesn't exist
        if (import.meta.env.DEV && eventId.startsWith("mock-")) {
          return {
            id: eventId,
            // Mock data has no real owner; use a placeholder so this branch's
            // type matches the real Supabase row (which always has
            // created_by) instead of silently omitting the field.
            created_by: "mock-user-1",
            title:
              eventId === "mock-1"
                ? "Hackathon 2024"
                : eventId === "mock-2"
                  ? "Watercolor Workshop"
                  : "Open Mic Night",
            description:
              eventId === "mock-1"
                ? "Annual college hackathon. Build something awesome in 24 hours!"
                : eventId === "mock-2"
                  ? "Learn the basics of watercolor painting with live demonstrations."
                  : "Showcase your music talent or just come to enjoy the acoustic performances.",
            event_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            start_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            end_date: new Date(
              Date.now() + 7 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000,
            ).toISOString(),
            location:
              eventId === "mock-1"
                ? "Main Auditorium, Thapar Institute of Engineering and Technology, Patiala, Punjab"
                : eventId === "mock-2"
                  ? "Art Block, Jawaharlal Nehru University, New Delhi"
                  : "Student Activity Centre, IIT Bombay, Powai, Mumbai",
            banner_url: null as string | null,
            max_attendees: eventId === "mock-1" ? 1 : null,
            clubs: [
              {
                name:
                  eventId === "mock-1"
                    ? "Tech Club"
                    : eventId === "mock-2"
                      ? "Art & Design"
                      : "Music Society",
                slug:
                  eventId === "mock-1"
                    ? "tech-club"
                    : eventId === "mock-2"
                      ? "art-design"
                      : "music-society",
              },
            ],
            requires_approval: true,
            event_rsvps:
              eventId === "mock-1"
                ? [
                    {
                      id: "rsvp-1",
                      user_id: "user-1",
                      status: "approved",
                      checked_in: false,
                      rsvp_at: new Date().toISOString(),
                      profiles: { first_name: "John", last_name: "Doe", avatar_url: null },
                    },
                    {
                      id: "rsvp-2",
                      user_id: "user-2",
                      status: "waitlisted",
                      checked_in: false,
                      rsvp_at: new Date().toISOString(),
                      profiles: { first_name: "Alice", last_name: "Smith", avatar_url: null },
                    },
                    {
                      id: "rsvp-3",
                      user_id: "user-3",
                      status: "rejected",
                      checked_in: false,
                      rsvp_at: new Date().toISOString(),
                      profiles: { first_name: "Bob", last_name: "Johnson", avatar_url: null },
                    },
                  ]
                : [],
            event_waitlist:
              eventId === "mock-1"
                ? [
                    {
                      id: "wait-1",
                      user_id: "user-4",
                      created_at: new Date().toISOString(),
                      profiles: { first_name: "Emma", last_name: "Brown", avatar_url: null },
                    },
                  ]
                : [],
            attendee_count: eventId === "mock-1" ? 1 : 0,
          };
        }
        throw error;
      }
      return data;
    },
  });

  const toggleWaitlist = useMutation({
    mutationFn: async ({ isOnWaitlist }: { isOnWaitlist: boolean }) => {
      if (!user) throw new Error("Please log in to join waitlist");
      if (eventId.startsWith("mock-")) {
        return;
      }

      if (isOnWaitlist) {
        const { error } = await supabase
          .from("event_waitlist")
          .delete()
          .eq("event_id", eventId)
          .eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("event_waitlist")
          .insert({ event_id: eventId, user_id: user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      refetch();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update waitlist status. Please try again.");
    },
  });

  const toggleRsvp = useMutation({
    mutationFn: async ({ eventId, hasRsvpd }: { eventId: string; hasRsvpd: boolean }) => {
      if (!user) throw new Error("Please log in to RSVP");
      if (eventId.startsWith("mock-")) {
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const { error } = await supabase.functions.invoke("toggle-rsvp", {
        body: { eventId, hasRsvpd },
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (error) throw error;
    },
    onSuccess: () => {
      refetch();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update RSVP. Please try again.");
    },
  });

  const exportCsv = useMutation({
    mutationFn: async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const { data, error } = await supabase.functions.invoke("export-event-rsvps", {
        body: { eventId: event!.id },
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (error) throw error;
      return data as {
        rows: { name: string; email: string; rsvp_date: string; status: string }[];
      };
    },
    onSuccess: (data) => {
      const csv = rsvpRowsToCsv(data.rows);
      const safeTitle = (event?.title ?? "event").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
      downloadCsv(csv, `${safeTitle}-rsvps.csv`);
      toast.success("RSVP list exported.");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to export RSVP list.");
    },
  });

  const isOrganizer = user && event?.created_by === user.id;

  // Local state for optimistic updates during dragging
  const [columns, setColumns] = useState<{
    waitlisted: {
      id: string;
      userId: string;
      name: string;
      avatarUrl: string | null;
      rsvpId?: string;
    }[];
    approved: {
      id: string;
      userId: string;
      name: string;
      avatarUrl: string | null;
      rsvpId: string;
    }[];
    rejected: {
      id: string;
      userId: string;
      name: string;
      avatarUrl: string | null;
      rsvpId: string;
    }[];
  }>({ waitlisted: [], approved: [], rejected: [] });

  useEffect(() => {
    if (!event) return;

    const typedEvent = event as unknown as {
      event_waitlist: EventWaitlist[];
      event_rsvps: EventRsvp[];
    };

    const waitlistCards = (typedEvent.event_waitlist || []).map((w: EventWaitlist) => {
      const profile = (Array.isArray(w.profiles) ? w.profiles[0] : w.profiles) as Profile | null;
      return {
        id: `waitlist-${w.id}`,
        userId: w.user_id,
        name: profile ? `${profile.first_name} ${profile.last_name}` : "Unknown User",
        avatarUrl: profile?.avatar_url || null,
      };
    });

    const rsvpWaitlistCards = (typedEvent.event_rsvps || [])
      .filter((r: EventRsvp) => r.status === "waitlisted")
      .map((r: EventRsvp) => {
        const profile = (Array.isArray(r.profiles) ? r.profiles[0] : r.profiles) as Profile | null;
        return {
          id: `rsvp-${r.id}`,
          userId: r.user_id,
          rsvpId: r.id,
          name: profile ? `${profile.first_name} ${profile.last_name}` : "Unknown User",
          avatarUrl: profile?.avatar_url || null,
        };
      });

    const approvedCards = (typedEvent.event_rsvps || [])
      .filter((r: EventRsvp) => r.status === "approved" || !r.status)
      .map((r: EventRsvp) => {
        const profile = (Array.isArray(r.profiles) ? r.profiles[0] : r.profiles) as Profile | null;
        return {
          id: `rsvp-${r.id}`,
          userId: r.user_id,
          rsvpId: r.id,
          name: profile ? `${profile.first_name} ${profile.last_name}` : "Unknown User",
          avatarUrl: profile?.avatar_url || null,
        };
      });

    const rejectedCards = (typedEvent.event_rsvps || [])
      .filter((r: EventRsvp) => r.status === "rejected")
      .map((r: EventRsvp) => {
        const profile = (Array.isArray(r.profiles) ? r.profiles[0] : r.profiles) as Profile | null;
        return {
          id: `rsvp-${r.id}`,
          userId: r.user_id,
          rsvpId: r.id,
          name: profile ? `${profile.first_name} ${profile.last_name}` : "Unknown User",
          avatarUrl: profile?.avatar_url || null,
        };
      });

    setColumns({
      waitlisted: [...waitlistCards, ...rsvpWaitlistCards],
      approved: approvedCards,
      rejected: rejectedCards,
    });
  }, [event]);

  const updateRsvpStatus = useMutation({
    mutationFn: async ({
      userId,
      rsvpId,
      newStatus,
    }: {
      userId: string;
      rsvpId?: string;
      newStatus: "waitlisted" | "approved" | "rejected";
    }) => {
      if (eventId.startsWith("mock-")) {
        return;
      }

      if (newStatus === "approved") {
        if (rsvpId) {
          const { error } = await supabase
            .from("event_rsvps")
            .update({ status: "approved" })
            .eq("id", rsvpId);
          if (error) throw error;
        } else {
          // Promote from event_waitlist to approved
          const { error: insertError } = await supabase
            .from("event_rsvps")
            .insert({ event_id: eventId, user_id: userId, status: "approved" });
          if (insertError) throw insertError;

          const { error: deleteError } = await supabase
            .from("event_waitlist")
            .delete()
            .eq("event_id", eventId)
            .eq("user_id", userId);
          if (deleteError) throw deleteError;
        }
      } else if (newStatus === "rejected") {
        if (rsvpId) {
          const { error } = await supabase
            .from("event_rsvps")
            .update({ status: "rejected" })
            .eq("id", rsvpId);
          if (error) throw error;
        } else {
          // Promote from event_waitlist to rejected
          const { error: insertError } = await supabase
            .from("event_rsvps")
            .insert({ event_id: eventId, user_id: userId, status: "rejected" });
          if (insertError) throw insertError;

          const { error: deleteError } = await supabase
            .from("event_waitlist")
            .delete()
            .eq("event_id", eventId)
            .eq("user_id", userId);
          if (deleteError) throw deleteError;
        }
      } else if (newStatus === "waitlisted") {
        if (rsvpId) {
          const { error } = await supabase
            .from("event_rsvps")
            .update({ status: "waitlisted" })
            .eq("id", rsvpId);
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      toast.success("RSVP status updated!");
      refetch();
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update RSVP status.");
      refetch();
    },
  });

  const onDragEnd = (result: DropResult) => {
    const { source, destination } = result;

    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index)
      return;

    const sourceColId = source.droppableId as keyof typeof columns;
    const destColId = destination.droppableId as keyof typeof columns;

    const sourceList = Array.from(columns[sourceColId]);
    const destList = Array.from(columns[destColId]);

    const [movedCard] = sourceList.splice(source.index, 1);
    destList.splice(destination.index, 0, movedCard);

    setColumns({
      ...columns,
      [sourceColId]: sourceList,
      [destColId]: destList,
    });

    updateRsvpStatus.mutate({
      userId: movedCard.userId,
      rsvpId: movedCard.rsvpId,
      newStatus: destColId as "waitlisted" | "approved" | "rejected",
    });
  };

  if (isLoading) {
    return <SkeletonEventDetails />;
  }

  if (!event) {
    return (
      <SiteShell>
        <section className="bg-cream px-4 py-20 md:px-6">
          <div className="mx-auto max-w-md neu-border bg-white p-8 text-center">
            <h1 className="text-3xl font-black">Event Not Found</h1>
            <p className="mt-4 font-mono text-sm leading-6">
              The event you are looking for does not exist, has been removed, or the link is
              incorrect.
            </p>
            <Link
              to="/events"
              className="neu-press mt-6 inline-flex items-center gap-2 border-2 border-black bg-lime px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider"
            >
              <ArrowLeft size={14} /> Back to Events
            </Link>
          </div>
        </section>
      </SiteShell>
    );
  }

  const rsvps = Array.isArray(event.event_rsvps) ? event.event_rsvps : [];
  const hasRsvpd = user ? rsvps.some((r) => r.user_id === user.id) : false;

  const rawWaitlist = (event as Record<string, unknown>).event_waitlist;
  const waitlist = Array.isArray(rawWaitlist)
    ? [...(rawWaitlist as { id: string; user_id: string; created_at?: string }[])].sort(
        (a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime(),
      )
    : [];
  const isOnWaitlist = user ? waitlist.some((w) => w.user_id === user.id) : false;
  const waitlistPosition =
    user && isOnWaitlist ? waitlist.findIndex((w) => w.user_id === user.id) + 1 : 0;

  const club = event.clubs ? (Array.isArray(event.clubs) ? event.clubs[0] : event.clubs) : null;
  const coordsCheck = event.location
    ? parseCoordinates(event.location)
    : { isCoordinates: false, isValid: true };

  const googleCalendarUrl = getGoogleCalendarUrl({
    title: event.title,
    description: event.description || "",
    event_date: event.event_date || "",
    start_date: event.start_date,
    end_date: event.end_date,
    location: event.location || "",
  });

  const handleRsvpClick = () => {
    if (!user) {
      toast.error("Please log in to RSVP");
      return;
    }
    if (hasRsvpd) {
      setConfirmOpen(true);
      return;
    }
    toggleRsvp.mutate({ eventId: event.id, hasRsvpd: false });
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      toast.success("Event link copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link.");
    }
  };

  const handleCopyEventId = async () => {
    try {
      await navigator.clipboard.writeText(event.id);
      setIdCopied(true);
      toast.success("Event ID copied to clipboard!");
      setTimeout(() => setIdCopied(false), 2000);
    } catch {
      toast.error("Failed to copy event ID.");
    }
  };

  const handleConfirmCancel = () => {
    toggleRsvp.mutate({ eventId: event.id, hasRsvpd: true });
    setConfirmOpen(false);
  };

  const attendeeCount =
    ((event as Record<string, unknown>).attendee_count as number) ?? rsvps.length;
  const maxAttendees = (event as Record<string, unknown>).max_attendees as
    number | null | undefined;
  const isAtCapacity =
    maxAttendees !== null &&
    maxAttendees !== undefined &&
    maxAttendees > 0 &&
    attendeeCount >= maxAttendees;

  return (
    <SiteShell>
      {/* Top navigation header */}
      <nav className="border-b-2 border-black bg-white px-4 py-4 md:px-6">
        <div className="mx-auto max-w-4xl">
          <Link
            to="/events"
            className="inline-flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-wider hover:underline"
          >
            <ArrowLeft size={14} /> Back to Events
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative w-full overflow-hidden border-b-2 border-black bg-peach/30">
        {event.banner_url ? (
          <div className="absolute inset-0">
            <OptimizedImage
              src={event.banner_url}
              alt={`${event.title} event banner`}
              className="h-full w-full object-cover"
              width={1344}
              height={700}
              responsiveWidths={[448, 672, 896, 1344]}
              sizes="100vw"
              priority
              fallback={
                <div className="h-full w-full bg-gradient-to-br from-peach via-pink-200 to-lime/40" />
              }
            />
            <div className="absolute inset-0 bg-black/50" />
          </div>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-peach via-pink-200 to-lime/40" />
        )}

        <div className="relative mx-auto flex min-h-[50vh] max-w-4xl flex-col justify-end px-4 py-16 md:min-h-[60vh] md:px-6 md:py-24">
          <div className="mb-4">
            <span className="neu-border inline-block bg-white px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-wider text-black">
              Event Details
            </span>
          </div>

          <div className="flex items-center gap-3">
            <h1
              className={`text-4xl font-black tracking-tight md:text-6xl ${event.banner_url ? "text-white" : "text-black"}`}
            >
              {event.title}
            </h1>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={handleCopyEventId}
                    variant="outline"
                    size="icon"
                    className="neu-border h-8 w-8 shrink-0 bg-white text-black transition-all duration-300 hover:scale-105 active:scale-95"
                    aria-label="Copy Event ID"
                  >
                    {idCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Copy Event ID</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          {club && (
            <p
              className={`mt-4 font-mono text-base font-bold ${event.banner_url ? "text-white/90" : "text-black/80"}`}
            >
              Organized by:{" "}
              <Link to={`/clubs/${club.slug}`} className="underline hover:opacity-80">
                {club.name}
              </Link>
            </p>
          )}

          <div
            className={`mt-8 flex flex-wrap gap-4 font-mono text-sm font-bold sm:gap-8 ${event.banner_url ? "text-white" : "text-black"}`}
          >
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              <span>{formatEventDateRange(event)}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              <span>{event.location || "TBA"}</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              <span>{attendeeCount} RSVP&apos;d</span>
            </div>
          </div>

          <div className="mt-8 hidden items-center gap-4 md:flex">
            {hasRsvpd ? (
              <button
                onClick={handleRsvpClick}
                disabled={toggleRsvp.isPending}
                className="neu-border bg-lime px-8 py-4 font-mono text-base font-bold uppercase tracking-wider text-black transition-all duration-300 hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {toggleRsvp.isPending ? "Updating..." : "RSVP'd ✓"}
              </button>
            ) : isAtCapacity ? (
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => {
                    if (!user) {
                      toast.error("Please log in to join waitlist");
                      return;
                    }
                    toggleWaitlist.mutate({ isOnWaitlist });
                  }}
                  disabled={toggleWaitlist.isPending}
                  className={`neu-border px-8 py-4 font-mono text-base font-bold uppercase tracking-wider transition-all duration-300 hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 ${
                    isOnWaitlist ? "bg-amber-300 text-black" : "bg-black text-cream"
                  }`}
                >
                  {toggleWaitlist.isPending
                    ? "Updating..."
                    : isOnWaitlist
                      ? "On Waitlist ✓"
                      : "Join Waitlist"}
                </button>
                {isOnWaitlist && waitlistPosition > 0 && (
                  <span
                    className={`font-mono text-xs font-bold ${event.banner_url ? "text-white" : "text-black"}`}
                  >
                    You are #{waitlistPosition} on the waitlist
                  </span>
                )}
              </div>
            ) : (
              <button
                onClick={handleRsvpClick}
                disabled={toggleRsvp.isPending}
                className="neu-border bg-black px-8 py-4 font-mono text-base font-bold uppercase tracking-wider text-cream transition-all duration-300 hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {toggleRsvp.isPending ? "Updating..." : "RSVP NOW"}
              </button>
            )}
            <span
              className={`font-mono text-sm font-bold ${event.banner_url ? "text-white/80" : "text-black/60"}`}
            >
              {attendeeCount} {maxAttendees ? `/ ${maxAttendees}` : ""} people going
              {isAtCapacity && !hasRsvpd && " (At Capacity)"}
            </span>
          </div>
        </div>
      </section>

      {/* Details Container */}
      <section className="bg-cream px-4 py-12 md:px-6">
        <div className="mx-auto max-w-4xl neu-border bg-white p-6 md:p-8">
          {/* Action buttons (Copy Link / Add to Calendar) */}
          <div className="flex flex-wrap items-center gap-4 border-b-2 border-black pb-8">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={handleCopyLink}
                    variant="outline"
                    className="neu-border neu-press h-12 bg-white px-5 font-mono text-sm font-bold uppercase tracking-wider transition-all duration-300 hover:scale-105 active:scale-95"
                  >
                    {copied ? (
                      <Check className="mr-2 h-4 w-4" />
                    ) : (
                      <LinkIcon className="mr-2 h-4 w-4" />
                    )}
                    {copied ? "Copied" : "Copy Link"}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Copy Event Link</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {isOrganizer && (
              <Button
                onClick={() => exportCsv.mutate()}
                disabled={exportCsv.isPending}
                variant="outline"
                className="neu-border neu-press h-12 bg-white px-5 font-mono text-sm font-bold uppercase tracking-wider transition-all duration-300 hover:scale-105 active:scale-95"
              >
                <Download className="mr-2 h-4 w-4" />
                {exportCsv.isPending ? "Exporting..." : "Export CSV"}
              </Button>
            )}

            {hasRsvpd && googleCalendarUrl && (
              <a
                href={googleCalendarUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="neu-border flex items-center gap-2 bg-white px-5 py-3 font-mono text-sm font-bold uppercase tracking-wider transition-all duration-300 hover:scale-105 active:scale-95"
              >
                <Calendar aria-hidden="true" size={14} strokeWidth={3} />
                Add to Google Calendar
              </a>
            )}
          </div>

          {/* Description */}
          <div className="mt-8">
            <h2 className="font-display text-xl font-bold uppercase tracking-tight text-blue-900">
              About the Event
            </h2>
            {event.description ? (
              <p className="mt-4 whitespace-pre-line text-base leading-7 text-black/80">
                {event.description}
              </p>
            ) : (
              <p className="mt-4 font-mono text-sm italic text-black/40">
                No description provided for this event.
              </p>
            )}
          </div>

          {/* Map Embed */}
          {event.location && event.location.toLowerCase() !== "online" && (
            <div className="mt-8">
              <h2 className="font-display text-xl font-bold uppercase tracking-tight text-blue-900">
                Location
              </h2>
              {!coordsCheck.isValid ? (
                <div className="neu-border mt-4 flex items-start gap-4 bg-peach/20 p-5">
                  <div className="shrink-0 rounded-none border-2 border-black bg-white p-2 text-[#e53935]">
                    <MapPinOff className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="mb-1 font-display text-lg font-bold text-black">
                      Unable to load map preview
                    </h3>
                    <p className="mb-3 font-mono text-xs leading-relaxed text-gray-700">
                      The coordinates provided (<code>{event.location}</code>) are invalid. Latitude
                      must be between -90 and 90, and Longitude between -180 and 180.
                    </p>
                    <a
                      href={`https://www.google.com/maps/search/?q=${encodeURIComponent(event.location)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-mono text-xs font-bold underline hover:no-underline text-black"
                    >
                      Search location on Google Maps anyway ↗
                    </a>
                  </div>
                </div>
              ) : (
                <>
                  <iframe
                    className="neu-border mt-4 w-full"
                    height="300"
                    loading="lazy"
                    src={`https://maps.google.com/maps?q=${encodeURIComponent(event.location)}&output=embed`}
                    title="Event location map"
                  />
                  <a
                    href={`https://www.google.com/maps/search/?q=${encodeURIComponent(event.location)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block font-mono text-xs font-bold underline text-blue-500"
                  >
                    View larger map ↗
                  </a>
                </>
              )}
            </div>
          )}

          {/* Social Share Buttons */}
          <div className="mt-10 border-t-2 border-black pt-6">
            <h3 className="font-mono text-xs font-bold uppercase text-blue-900">
              Share with Friends
            </h3>
            <div className="mt-4 flex flex-wrap gap-2">
              <a
                href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(window.location.href)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="neu-border px-4 py-2 font-mono text-xs font-bold uppercase hover:bg-[#1DA1F2] hover:text-white transition-colors text-black"
              >
                Twitter
              </a>
              <a
                href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="neu-border px-4 py-2 font-mono text-xs font-bold uppercase hover:bg-[#0A66C2] hover:text-white transition-colors text-black"
              >
                LinkedIn
              </a>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`Check out this event: ${event.title} - ${window.location.href}`)}`}
                target="_blank"
                rel="noopener noreferrer"

                className="neu-border px-4 py-2 font-mono text-xs font-bold uppercase hover:bg-[#25D366] hover:text-white transition-colors text-black"
              >
                WhatsApp
              </a>
            </div>
          </div>

          {/* Kanban Board for Organizer */}
          {isOrganizer && (
            <div className="mt-12 border-t-4 border-black pt-10">
              <h2 className="font-display text-2xl font-black uppercase tracking-tight text-black mb-6">
                Attendee Manager
              </h2>
              <DragDropContext onDragEnd={onDragEnd}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Waitlisted Column */}
                  <div className="flex flex-col border-4 border-black bg-amber-50 p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <h3 className="font-display text-lg font-bold uppercase tracking-wider text-black mb-4 border-b-2 border-black pb-2 flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Clock size={18} className="text-amber-600" /> Waitlisted
                      </span>
                      <span className="bg-black text-white px-2 py-0.5 text-xs font-mono">
                        {columns.waitlisted.length}
                      </span>
                    </h3>
                    <Droppable droppableId="waitlisted">
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={`flex-1 min-h-[300px] space-y-3 p-1 transition-colors ${
                            snapshot.isDraggingOver ? "bg-amber-100/50" : ""
                          }`}
                        >
                          {columns.waitlisted.map((card, index) => (
                            <Draggable key={card.id} draggableId={card.id} index={index}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  className={`border-2 border-black bg-white p-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center justify-between ${
                                    snapshot.isDragging
                                      ? "rotate-2 scale-105 z-50 bg-amber-50/90"
                                      : ""
                                  }`}
                                >
                                  <div className="flex items-center gap-3 min-w-0">
                                    {card.avatarUrl ? (
                                      <img
                                        src={card.avatarUrl}
                                        alt={card.name}
                                        className="h-10 w-10 border-2 border-black object-cover rounded-none"
                                      />
                                    ) : (
                                      <div className="flex h-10 w-10 items-center justify-center border-2 border-black bg-lime text-xs font-mono font-bold uppercase text-black select-none">
                                        {card.name.substring(0, 2)}
                                      </div>
                                    )}
                                    <div className="min-w-0">
                                      <p className="truncate font-mono text-sm font-bold text-black">
                                        {card.name}
                                      </p>
                                      <p className="font-mono text-[9px] text-black/60 uppercase">
                                        {card.rsvpId ? "Requested" : "Waitlist"}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex gap-1 ml-2">
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            size="icon"
                                            variant="outline"
                                            className="h-7 w-7 border border-black rounded-none bg-emerald-50 hover:bg-emerald-200"
                                            onClick={() =>
                                              updateRsvpStatus.mutate({
                                                userId: card.userId,
                                                rsvpId: card.rsvpId,
                                                newStatus: "approved",
                                              })
                                            }
                                          >
                                            <CheckCircle size={14} className="text-emerald-700" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>Approve RSVP</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>

                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            size="icon"
                                            variant="outline"
                                            className="h-7 w-7 border border-black rounded-none bg-rose-50 hover:bg-rose-200"
                                            onClick={() =>
                                              updateRsvpStatus.mutate({
                                                userId: card.userId,
                                                rsvpId: card.rsvpId,
                                                newStatus: "rejected",
                                              })
                                            }
                                          >
                                            <X size={14} className="text-rose-700" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>Reject RSVP</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </div>

                  {/* Approved Column */}
                  <div className="flex flex-col border-4 border-black bg-emerald-50 p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <h3 className="font-display text-lg font-bold uppercase tracking-wider text-black mb-4 border-b-2 border-black pb-2 flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <CheckCircle size={18} className="text-emerald-600" /> Approved
                      </span>
                      <span className="bg-black text-white px-2 py-0.5 text-xs font-mono">
                        {columns.approved.length}
                      </span>
                    </h3>
                    <Droppable droppableId="approved">
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={`flex-1 min-h-[300px] space-y-3 p-1 transition-colors ${
                            snapshot.isDraggingOver ? "bg-emerald-100/50" : ""
                          }`}
                        >
                          {columns.approved.map((card, index) => (
                            <Draggable key={card.id} draggableId={card.id} index={index}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  className={`border-2 border-black bg-white p-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center justify-between ${
                                    snapshot.isDragging
                                      ? "rotate-2 scale-105 z-50 bg-emerald-50/90"
                                      : ""
                                  }`}
                                >
                                  <div className="flex items-center gap-3 min-w-0">
                                    {card.avatarUrl ? (
                                      <img
                                        src={card.avatarUrl}
                                        alt={card.name}
                                        className="h-10 w-10 border-2 border-black object-cover rounded-none"
                                      />
                                    ) : (
                                      <div className="flex h-10 w-10 items-center justify-center border-2 border-black bg-lime text-xs font-mono font-bold uppercase text-black select-none">
                                        {card.name.substring(0, 2)}
                                      </div>
                                    )}
                                    <div className="min-w-0">
                                      <p className="truncate font-mono text-sm font-bold text-black">
                                        {card.name}
                                      </p>
                                      <p className="font-mono text-[9px] text-black/60 uppercase">
                                        Approved
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex gap-1 ml-2">
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            size="icon"
                                            variant="outline"
                                            className="h-7 w-7 border border-black rounded-none bg-amber-50 hover:bg-amber-200"
                                            onClick={() =>
                                              updateRsvpStatus.mutate({
                                                userId: card.userId,
                                                rsvpId: card.rsvpId,
                                                newStatus: "waitlisted",
                                              })
                                            }
                                          >
                                            <Clock size={14} className="text-amber-700" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>Move to Waitlist</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>

                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            size="icon"
                                            variant="outline"
                                            className="h-7 w-7 border border-black rounded-none bg-rose-50 hover:bg-rose-200"
                                            onClick={() =>
                                              updateRsvpStatus.mutate({
                                                userId: card.userId,
                                                rsvpId: card.rsvpId,
                                                newStatus: "rejected",
                                              })
                                            }
                                          >
                                            <X size={14} className="text-rose-700" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>Reject RSVP</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </div>

                  {/* Rejected Column */}
                  <div className="flex flex-col border-4 border-black bg-rose-50 p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <h3 className="font-display text-lg font-bold uppercase tracking-wider text-black mb-4 border-b-2 border-black pb-2 flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <X size={18} className="text-rose-600" /> Rejected
                      </span>
                      <span className="bg-black text-white px-2 py-0.5 text-xs font-mono">
                        {columns.rejected.length}
                      </span>
                    </h3>
                    <Droppable droppableId="rejected">
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={`flex-1 min-h-[300px] space-y-3 p-1 transition-colors ${
                            snapshot.isDraggingOver ? "bg-rose-100/50" : ""
                          }`}
                        >
                          {columns.rejected.map((card, index) => (
                            <Draggable key={card.id} draggableId={card.id} index={index}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  className={`border-2 border-black bg-white p-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center justify-between ${
                                    snapshot.isDragging
                                      ? "rotate-2 scale-105 z-50 bg-rose-50/90"
                                      : ""
                                  }`}
                                >
                                  <div className="flex items-center gap-3 min-w-0">
                                    {card.avatarUrl ? (
                                      <img
                                        src={card.avatarUrl}
                                        alt={card.name}
                                        className="h-10 w-10 border-2 border-black object-cover rounded-none"
                                      />
                                    ) : (
                                      <div className="flex h-10 w-10 items-center justify-center border-2 border-black bg-lime text-xs font-mono font-bold uppercase text-black select-none">
                                        {card.name.substring(0, 2)}
                                      </div>
                                    )}
                                    <div className="min-w-0">
                                      <p className="truncate font-mono text-sm font-bold text-black">
                                        {card.name}
                                      </p>
                                      <p className="font-mono text-[9px] text-black/60 uppercase">
                                        Rejected
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex gap-1 ml-2">
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            size="icon"
                                            variant="outline"
                                            className="h-7 w-7 border border-black rounded-none bg-amber-50 hover:bg-amber-200"
                                            onClick={() =>
                                              updateRsvpStatus.mutate({
                                                userId: card.userId,
                                                rsvpId: card.rsvpId,
                                                newStatus: "waitlisted",
                                              })
                                            }
                                          >
                                            <Clock size={14} className="text-amber-700" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>Move to Waitlist</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>

                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            size="icon"
                                            variant="outline"
                                            className="h-7 w-7 border border-black rounded-none bg-emerald-50 hover:bg-emerald-200"
                                            onClick={() =>
                                              updateRsvpStatus.mutate({
                                                userId: card.userId,
                                                rsvpId: card.rsvpId,
                                                newStatus: "approved",
                                              })
                                            }
                                          >
                                            <CheckCircle size={14} className="text-emerald-700" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>Approve RSVP</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </div>
                </div>
              </DragDropContext>
            </div>
          )}
        </div>
      </section>

      {/* Sticky Mobile RSVP Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-between border-t-2 border-black bg-white p-4 pb-6 shadow-lg md:hidden">
        <div className="flex flex-col">
          <span className="font-mono text-xs font-bold uppercase text-black/60">
            {attendeeCount} {maxAttendees ? `/ ${maxAttendees}` : ""} going
          </span>
          {isOnWaitlist && waitlistPosition > 0 && (
            <span className="font-mono text-[10px] font-bold text-amber-700">
              Waitlist position: #{waitlistPosition}
            </span>
          )}
        </div>
        {hasRsvpd ? (
          <button
            onClick={handleRsvpClick}
            disabled={toggleRsvp.isPending}
            className="neu-border bg-lime px-6 py-3 font-mono text-sm font-bold uppercase tracking-wider text-black transition-all duration-300 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {toggleRsvp.isPending ? "Updating..." : "RSVP'd ✓"}
          </button>
        ) : isAtCapacity ? (
          <button
            onClick={() => {
              if (!user) {
                toast.error("Please log in to join waitlist");
                return;
              }
              toggleWaitlist.mutate({ isOnWaitlist });
            }}
            disabled={toggleWaitlist.isPending}
            className={`neu-border px-6 py-3 font-mono text-sm font-bold uppercase tracking-wider transition-all duration-300 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 ${
              isOnWaitlist ? "bg-amber-300 text-black" : "bg-black text-cream"
            }`}
          >
            {toggleWaitlist.isPending
              ? "Updating..."
              : isOnWaitlist
                ? "On Waitlist ✓"
                : "Join Waitlist"}
          </button>
        ) : (
          <button
            onClick={handleRsvpClick}
            disabled={toggleRsvp.isPending}
            className="neu-border bg-black px-6 py-3 font-mono text-sm font-bold uppercase tracking-wider text-cream transition-all duration-300 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {toggleRsvp.isPending ? "Updating..." : "RSVP NOW"}
          </button>
        )}
      </div>

      {/* RSVP Cancel Confirmation Modal */}
      <ConfirmModal
        open={confirmOpen}
        title="Cancel RSVP"
        description="Are you sure you want to cancel your RSVP for this event? Your spot will be released."
        onConfirm={handleConfirmCancel}
        onCancel={() => setConfirmOpen(false)}
      />
    </SiteShell>
  );
}
