import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { TEMP_USER_ID } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart3,
  Calendar,
  Flame,
  PenTool,
  BookOpen,
  TrendingUp,
} from "lucide-react";

export default function WritingStats() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/stats", { userId: TEMP_USER_ID }],
    queryFn: async () => {
      const r = await apiRequest("GET", `/api/stats?userId=${TEMP_USER_ID}`, undefined);
      return r.json() as Promise<any>;
    },
  });

  const { data: streak } = useQuery({
    queryKey: ["/api/writing-streak", { userId: TEMP_USER_ID }],
    queryFn: async () => {
      const r = await apiRequest(
        "GET",
        `/api/writing-streak?userId=${TEMP_USER_ID}`,
        undefined
      );
      return r.json() as Promise<{ streak: number }>;
    },
  });

  const { data: activities } = useQuery({
    queryKey: ["/api/writing-activities-30d", { userId: TEMP_USER_ID }],
    queryFn: async () => {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 30);
      const r = await apiRequest(
        "GET",
        `/api/writing-activities?userId=${TEMP_USER_ID}&startDate=${start.toISOString()}&endDate=${end.toISOString()}`,
        undefined
      );
      return r.json() as Promise<any[]>;
    },
  });

  // Compute stats from activities
  const dailyWords = computeDailyWords(activities || []);
  const totalWordsAllTime = stats?.totalWords ?? 0;
  const totalBooks = stats?.totalBooks ?? 0;
  const completedBooks = stats?.completedBooks ?? 0;
  const inProgressBooks = stats?.inProgressBooks ?? totalBooks - completedBooks;

  // Words today/week/month
  const today = new Date().toISOString().split("T")[0];
  const wordsToday = dailyWords.find((d) => d.date === today)?.words ?? 0;

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const wordsThisWeek = dailyWords
    .filter((d) => d.date >= weekAgo.toISOString().split("T")[0])
    .reduce((sum, d) => sum + d.words, 0);

  const wordsThisMonth = dailyWords.reduce((sum, d) => sum + d.words, 0);

  const activeDays = dailyWords.filter((d) => d.words > 0).length;
  const avgPerSession = activeDays > 0 ? Math.round(wordsThisMonth / activeDays) : 0;

  // Most productive day of week
  const dayOfWeekTotals = [0, 0, 0, 0, 0, 0, 0]; // Sun-Sat
  for (const d of dailyWords) {
    const dayIdx = new Date(d.date + "T12:00:00").getDay();
    dayOfWeekTotals[dayIdx] += d.words;
  }
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const bestDayIdx = dayOfWeekTotals.indexOf(Math.max(...dayOfWeekTotals));
  const bestDay = dayOfWeekTotals[bestDayIdx] > 0 ? dayNames[bestDayIdx] : "N/A";

  // Max bar height for the chart
  const maxWords = Math.max(...dailyWords.map((d) => d.words), 1);

  if (statsLoading) {
    return (
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          <Skeleton className="h-10 w-48" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array(8)
              .fill(0)
              .map((_, i) => (
                <Skeleton key={i} className="h-28" />
              ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="h-6 w-6" />
            Writing Statistics
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track your writing progress and habits
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={<PenTool className="h-5 w-5" />}
            label="Words today"
            value={wordsToday.toLocaleString()}
          />
          <StatCard
            icon={<Calendar className="h-5 w-5" />}
            label="Words this week"
            value={wordsThisWeek.toLocaleString()}
          />
          <StatCard
            icon={<TrendingUp className="h-5 w-5" />}
            label="Words this month"
            value={wordsThisMonth.toLocaleString()}
          />
          <StatCard
            icon={<BarChart3 className="h-5 w-5" />}
            label="All time"
            value={totalWordsAllTime.toLocaleString()}
          />
          <StatCard
            icon={<TrendingUp className="h-5 w-5" />}
            label="Avg per session"
            value={avgPerSession.toLocaleString()}
          />
          <StatCard
            icon={<Calendar className="h-5 w-5" />}
            label="Best day"
            value={bestDay}
          />
          <StatCard
            icon={<Flame className="h-5 w-5" />}
            label="Current streak"
            value={`${streak?.streak ?? 0} days`}
          />
          <StatCard
            icon={<BookOpen className="h-5 w-5" />}
            label="Books"
            value={`${completedBooks} done / ${inProgressBooks} active`}
          />
        </div>

        {/* Words per day chart (last 30 days) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Words per day (last 30 days)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-1 h-40">
              {dailyWords.map((d) => {
                const height = maxWords > 0 ? (d.words / maxWords) * 100 : 0;
                return (
                  <div
                    key={d.date}
                    className="flex-1 flex flex-col items-center justify-end"
                    title={`${d.date}: ${d.words} words`}
                  >
                    <div
                      className="w-full bg-primary rounded-t-sm min-h-[2px] transition-all"
                      style={{ height: `${Math.max(height, 2)}%` }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between text-xs text-muted-foreground mt-2">
              <span>{dailyWords[0]?.date ?? ""}</span>
              <span>{dailyWords[dailyWords.length - 1]?.date ?? ""}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          {icon}
          <span className="text-xs font-medium">{label}</span>
        </div>
        <p className="text-lg font-bold text-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}

function computeDailyWords(activities: any[]): { date: string; words: number }[] {
  const now = new Date();
  const days: { date: string; words: number }[] = [];

  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    days.push({ date: d.toISOString().split("T")[0], words: 0 });
  }

  for (const a of activities) {
    const aDate = typeof a.activityDate === "string"
      ? a.activityDate.split("T")[0]
      : new Date(a.activityDate).toISOString().split("T")[0];
    const entry = days.find((d) => d.date === aDate);
    if (entry) {
      entry.words += a.wordCount || 0;
    }
  }

  return days;
}
