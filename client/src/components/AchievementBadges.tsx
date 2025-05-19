import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiRequest } from "@/lib/queryClient";
import { TEMP_USER_ID, formatRelativeDate } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, Award, Clock, CalendarClock, Flag, Star } from "lucide-react";

// Define what an achievement looks like with the joined data
interface AchievementWithDate {
  id: number;
  name: string;
  description: string;
  type: string;
  threshold: number;
  icon: string;
  earnedAt?: Date;
}

export default function AchievementBadges() {
  const [selectedAchievement, setSelectedAchievement] = useState<AchievementWithDate | null>(null);

  // Fetch user's achievements
  const { data: userAchievements, isLoading: isLoadingUserAchievements } = useQuery({
    queryKey: ["/api/user-achievements", { userId: TEMP_USER_ID }],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/user-achievements?userId=${TEMP_USER_ID}`,
        undefined
      );
      return res.json() as Promise<any[]>;
    },
  });

  // Fetch all possible achievements
  const { data: allAchievements, isLoading: isLoadingAllAchievements } = useQuery({
    queryKey: ["/api/achievements"],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        "/api/achievements",
        undefined
      );
      return res.json() as Promise<any[]>;
    },
  });

  // Check for new achievements on component mount
  const { refetch: checkAchievements } = useQuery({
    queryKey: ["/api/check-achievements", { userId: TEMP_USER_ID }],
    queryFn: async () => {
      const res = await apiRequest(
        "POST",
        "/api/check-achievements",
        { userId: TEMP_USER_ID }
      );
      return res.json() as Promise<any[]>;
    },
    enabled: false, // Don't run automatically, we'll trigger this manually
  });

  // Find the appropriate icon component based on achievement type
  const getAchievementIcon = (type: string) => {
    switch (type) {
      case "word_count":
        return <Award className="h-full w-full p-1" />;
      case "streak":
        return <CalendarClock className="h-full w-full p-1" />;
      case "chapter_completion":
        return <Flag className="h-full w-full p-1" />;
      case "book_completion":
        return <Trophy className="h-full w-full p-1" />;
      case "first_book":
        return <Star className="h-full w-full p-1" />;
      case "consistent_writer":
        return <Clock className="h-full w-full p-1" />;
      default:
        return <Trophy className="h-full w-full p-1" />;
    }
  };

  // Get color classes based on achievement type
  const getColorClasses = (type: string) => {
    switch (type) {
      case "word_count":
        return "bg-violet-100 text-violet-600";
      case "streak":
        return "bg-green-100 text-green-600";
      case "chapter_completion":
        return "bg-blue-100 text-blue-600";
      case "book_completion":
        return "bg-yellow-100 text-yellow-600";
      case "first_book":
        return "bg-amber-100 text-amber-600";
      case "consistent_writer":
        return "bg-indigo-100 text-indigo-600";
      default:
        return "bg-gray-100 text-gray-600";
    }
  };

  // Combine all achievements with earned status
  const achievements = allAchievements?.map(achievement => {
    const earned = userAchievements?.find(ua => 
      ua.achievementId === achievement.id || 
      (ua.achievement && ua.achievement.id === achievement.id)
    );
    
    return {
      ...achievement,
      earnedAt: earned ? earned.earnedAt : null,
    };
  });
  
  // Separate earned and unearned achievements
  const earnedAchievements = achievements?.filter(a => a.earnedAt) || [];
  const unearnedAchievements = achievements?.filter(a => !a.earnedAt) || [];

  const isLoading = isLoadingUserAchievements || isLoadingAllAchievements;

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold">Achievement Badges</CardTitle>
            <Trophy className="h-5 w-5 text-gray-500" />
          </div>
          <CardDescription>
            Earn badges by reaching writing milestones
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              <div className="flex space-x-3">
                <Skeleton className="h-16 w-16 rounded-md" />
                <Skeleton className="h-16 w-16 rounded-md" />
                <Skeleton className="h-16 w-16 rounded-md" />
                <Skeleton className="h-16 w-16 rounded-md" />
              </div>
              <Skeleton className="h-16 w-full rounded-md" />
            </div>
          ) : (
            <>
              {earnedAchievements.length === 0 ? (
                <div className="text-center p-6 bg-gray-50 rounded-md border border-gray-200">
                  <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <Trophy className="h-8 w-8 text-gray-400" />
                  </div>
                  <h4 className="text-lg font-medium text-gray-800 mb-2">No achievements yet</h4>
                  <p className="text-sm text-gray-500">
                    Start writing to earn your first achievement badge!
                  </p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-4 gap-3 mb-4">
                    {earnedAchievements.slice(0, 4).map((achievement) => (
                      <div 
                        key={achievement.id}
                        className="aspect-square p-1 rounded-md border border-gray-200 hover:border-primary cursor-pointer transition-colors"
                        onClick={() => setSelectedAchievement(achievement)}
                      >
                        <div className={`w-full h-full rounded-md flex items-center justify-center ${getColorClasses(achievement.type)}`}>
                          {getAchievementIcon(achievement.type)}
                        </div>
                      </div>
                    ))}
                    
                    {earnedAchievements.length < 4 && Array(4 - earnedAchievements.length).fill(0).map((_, i) => (
                      <div 
                        key={`empty-${i}`}
                        className="aspect-square p-1 rounded-md border border-gray-200 bg-gray-50"
                      >
                        <div className="w-full h-full rounded-md flex items-center justify-center bg-gray-100 text-gray-300">
                          <Trophy className="h-full w-full p-3" />
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div 
                    className="p-3 bg-gray-50 border border-gray-200 rounded-md hover:bg-gray-100 transition-colors cursor-pointer"
                    onClick={() => setSelectedAchievement(earnedAchievements[0])}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className={`w-10 h-10 rounded-md mr-3 flex items-center justify-center ${getColorClasses(earnedAchievements[0].type)}`}>
                          {getAchievementIcon(earnedAchievements[0].type)}
                        </div>
                        <div>
                          <div className="font-medium text-gray-800">{earnedAchievements[0].name}</div>
                          <div className="text-xs text-gray-500">
                            Earned {earnedAchievements[0].earnedAt ? formatRelativeDate(earnedAchievements[0].earnedAt) : ''}
                          </div>
                        </div>
                      </div>
                      <div className="text-sm text-primary">
                        View all ({earnedAchievements.length})
                      </div>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Achievement Detail Dialog */}
      <Dialog open={!!selectedAchievement} onOpenChange={(open) => !open && setSelectedAchievement(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Achievement Details</DialogTitle>
            <DialogDescription>
              Learn more about this achievement and how to earn others.
            </DialogDescription>
          </DialogHeader>

          {selectedAchievement && (
            <div className="py-4">
              <div className="flex items-center mb-6">
                <div className={`w-16 h-16 rounded-md mr-4 flex items-center justify-center ${getColorClasses(selectedAchievement.type)}`}>
                  {getAchievementIcon(selectedAchievement.type)}
                </div>
                <div>
                  <h3 className="text-lg font-semibold">{selectedAchievement.name}</h3>
                  <p className="text-sm text-gray-500">
                    {selectedAchievement.earnedAt 
                      ? `Earned ${formatRelativeDate(selectedAchievement.earnedAt)}` 
                      : 'Not yet earned'}
                  </p>
                </div>
              </div>

              <p className="text-gray-700 mb-6">{selectedAchievement.description}</p>

              <div className="border-t border-gray-200 pt-4">
                <h4 className="font-medium mb-3">All Achievements</h4>
                <ScrollArea className="h-[200px]">
                  <div className="space-y-3 pr-3">
                    {earnedAchievements.map(achievement => (
                      <div 
                        key={achievement.id} 
                        className="flex items-center p-2 rounded-md hover:bg-gray-100 cursor-pointer"
                        onClick={() => setSelectedAchievement(achievement)}
                      >
                        <div className={`w-10 h-10 rounded-md mr-3 flex items-center justify-center ${getColorClasses(achievement.type)}`}>
                          {getAchievementIcon(achievement.type)}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium">{achievement.name}</div>
                          <div className="text-xs text-green-600">Earned {achievement.earnedAt ? formatRelativeDate(achievement.earnedAt) : ''}</div>
                        </div>
                      </div>
                    ))}
                    
                    {unearnedAchievements.map(achievement => (
                      <div 
                        key={achievement.id} 
                        className="flex items-center p-2 rounded-md hover:bg-gray-100 cursor-pointer opacity-75"
                        onClick={() => setSelectedAchievement(achievement)}
                      >
                        <div className="w-10 h-10 rounded-md mr-3 flex items-center justify-center bg-gray-100 text-gray-400">
                          {getAchievementIcon(achievement.type)}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium">{achievement.name}</div>
                          <div className="text-xs text-gray-500">Not yet earned</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}