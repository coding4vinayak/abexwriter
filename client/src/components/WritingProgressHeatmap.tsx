import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import CalendarHeatmap from "react-calendar-heatmap";
import { Tooltip } from "react-tooltip";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";
import { TEMP_USER_ID, formatDate } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { WritingActivity } from "@shared/schema";
import "react-calendar-heatmap/dist/styles.css";
import { Calendar, Medal, TrendingUp } from "lucide-react";

// Custom styles for the heatmap
import "./WritingProgressHeatmap.css";

interface HeatmapValue {
  date: string;
  count: number;
  wordCount: number;
}

export default function WritingProgressHeatmap() {
  const [heatmapValues, setHeatmapValues] = useState<HeatmapValue[]>([]);
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 120); // 4 months ago
    return date;
  });
  const [endDate, setEndDate] = useState(() => new Date());
  const [maxValue, setMaxValue] = useState(0);
  const [totalDays, setTotalDays] = useState(0);
  const [activeDays, setActiveDays] = useState(0);

  // Fetch writing activities
  const { data: activities, isLoading } = useQuery({
    queryKey: ["/api/writing-activities", { userId: TEMP_USER_ID }],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/writing-activities?userId=${TEMP_USER_ID}&startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`,
        undefined
      );
      return res.json() as Promise<WritingActivity[]>;
    }
  });

  // Fetch writing streak
  const { data: streakData, isLoading: isLoadingStreak } = useQuery({
    queryKey: ["/api/writing-streak", { userId: TEMP_USER_ID }],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/writing-streak?userId=${TEMP_USER_ID}`,
        undefined
      );
      return res.json() as Promise<{ streak: number }>;
    }
  });

  // Process activities into heatmap format
  useEffect(() => {
    if (!activities) return;

    // Group activities by date and sum word counts
    const groupedByDate = activities.reduce((acc: Record<string, { count: number, wordCount: number }>, activity) => {
      const dateKey = new Date(activity.activityDate).toISOString().split('T')[0];
      
      if (!acc[dateKey]) {
        acc[dateKey] = { count: 0, wordCount: 0 };
      }
      
      acc[dateKey].count += 1;
      acc[dateKey].wordCount += activity.wordCount;
      
      return acc;
    }, {});
    
    // Convert to array format required by heatmap
    const values = Object.entries(groupedByDate).map(([date, data]) => ({
      date,
      count: data.count,
      wordCount: data.wordCount
    }));
    
    setHeatmapValues(values);
    
    // Calculate maximum value for scaling
    const maxCount = Math.max(...values.map(v => v.wordCount), 0);
    setMaxValue(maxCount);
    
    // Calculate active days percentage
    const dateDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24));
    setTotalDays(dateDiff);
    setActiveDays(values.length);
    
  }, [activities, startDate, endDate]);

  // Calculate classname based on value
  const getClassForValue = (value: HeatmapValue | null) => {
    if (!value || value.wordCount === 0) {
      return 'color-empty';
    }
    
    // Calculate which intensity to use based on word count and max value
    const intensity = Math.min(4, Math.ceil((value.wordCount / (maxValue || 1)) * 4));
    return `color-scale-${intensity}`;
  };

  const formatTooltipData = (value: HeatmapValue | null) => {
    if (!value || !value.wordCount) {
      return 'No writing activity';
    }
    
    return `${formatDate(value.date)}: ${value.wordCount} words written`;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">Writing Progress</CardTitle>
          <Calendar className="h-5 w-5 text-gray-500" />
        </div>
        <CardDescription>
          Track your daily writing activity
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-4 w-full" />
            <div className="flex justify-between mt-4">
              <Skeleton className="h-12 w-1/3" />
              <Skeleton className="h-12 w-1/3" />
            </div>
          </div>
        ) : (
          <>
            <div className="text-xs text-gray-500 mb-1">
              Last {totalDays} days of activity
            </div>
            <div className="border border-gray-200 rounded-md p-2 pb-0.5 bg-gray-50">
              <CalendarHeatmap
                startDate={startDate}
                endDate={endDate}
                values={heatmapValues}
                classForValue={(value: any) => getClassForValue(value as HeatmapValue | null)}
                titleForValue={(value: any) => formatTooltipData(value as HeatmapValue | null)}
                tooltipDataAttrs={(value: any) => {
                  return {
                    'data-tooltip-id': 'heatmap-tooltip',
                    'data-tooltip-content': formatTooltipData(value as HeatmapValue | null),
                  };
                }}
                showWeekdayLabels={true}
                horizontal={true}
              />
            </div>
            
            <Tooltip id="heatmap-tooltip" />
            
            <div className="text-xs text-gray-500 flex items-center mt-1 mb-4">
              <span className="mr-2">Less</span>
              <div className="flex items-center">
                <div className="h-3 w-3 bg-gray-100 border border-gray-200 rounded-sm mr-1"></div>
                <div className="h-3 w-3 color-scale-1 border border-gray-200 rounded-sm mr-1"></div>
                <div className="h-3 w-3 color-scale-2 border border-gray-200 rounded-sm mr-1"></div>
                <div className="h-3 w-3 color-scale-3 border border-gray-200 rounded-sm mr-1"></div>
                <div className="h-3 w-3 color-scale-4 border border-gray-200 rounded-sm mr-1"></div>
              </div>
              <span className="ml-1">More</span>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center p-3 border border-gray-200 rounded-md bg-gray-50">
                <div className="w-8 h-8 bg-amber-50 rounded-full flex items-center justify-center mr-3">
                  <TrendingUp className="h-4 w-4 text-amber-600" />
                </div>
                <div>
                  <div className="text-xl font-semibold">
                    {activeDays > 0 ? `${Math.round((activeDays / totalDays) * 100)}%` : '0%'}
                  </div>
                  <div className="text-xs text-gray-500">Active days</div>
                </div>
              </div>
              
              <div className="flex items-center p-3 border border-gray-200 rounded-md bg-gray-50">
                <div className="w-8 h-8 bg-indigo-50 rounded-full flex items-center justify-center mr-3">
                  <Medal className="h-4 w-4 text-indigo-600" />
                </div>
                <div>
                  <div className="text-xl font-semibold">
                    {isLoadingStreak ? (
                      <Skeleton className="h-4 w-12" />
                    ) : (
                      streakData?.streak || 0
                    )}
                  </div>
                  <div className="text-xs text-gray-500">Day streak</div>
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}