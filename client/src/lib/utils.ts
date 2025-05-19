import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format a number with commas for thousands separators
export function formatNumber(num: number): string {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// Format a date relative to now (e.g., "2 days ago")
export function formatRelativeDate(date: Date | string): string {
  const now = new Date();
  const past = new Date(date);
  
  const diffInMilliseconds = now.getTime() - past.getTime();
  const diffInSeconds = Math.floor(diffInMilliseconds / 1000);
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  const diffInHours = Math.floor(diffInMinutes / 60);
  const diffInDays = Math.floor(diffInHours / 24);
  const diffInWeeks = Math.floor(diffInDays / 7);
  const diffInMonths = Math.floor(diffInDays / 30);
  
  if (diffInMonths > 1) {
    return `${diffInMonths} months ago`;
  } else if (diffInMonths === 1) {
    return "1 month ago";
  } else if (diffInWeeks > 1) {
    return `${diffInWeeks} weeks ago`;
  } else if (diffInWeeks === 1) {
    return "1 week ago";
  } else if (diffInDays > 1) {
    return `${diffInDays} days ago`;
  } else if (diffInDays === 1) {
    return "1 day ago";
  } else if (diffInHours > 1) {
    return `${diffInHours} hours ago`;
  } else if (diffInHours === 1) {
    return "1 hour ago";
  } else if (diffInMinutes > 1) {
    return `${diffInMinutes} minutes ago`;
  } else if (diffInMinutes === 1) {
    return "1 minute ago";
  } else {
    return "just now";
  }
}

// Calculate word count from a string
export function countWords(text: string = ""): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// Truncate a string to a certain length with ellipsis
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}

// Format a date to a readable string
export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
}

// Get status badge color based on status
export function getStatusColor(status: string): { bg: string, text: string } {
  switch (status) {
    case 'draft':
      return { bg: 'bg-blue-100', text: 'text-blue-800' };
    case 'in_progress':
      return { bg: 'bg-green-100', text: 'text-green-800' };
    case 'completed':
      return { bg: 'bg-purple-100', text: 'text-purple-800' };
    case 'archived':
      return { bg: 'bg-gray-100', text: 'text-gray-800' };
    case 'outline':
      return { bg: 'bg-amber-100', text: 'text-amber-800' };
    case 'edited':
      return { bg: 'bg-indigo-100', text: 'text-indigo-800' };
    default:
      return { bg: 'bg-gray-100', text: 'text-gray-800' };
  }
}

// Format status for display
export function formatStatus(status: string): string {
  return status
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Helper to create a dummy user ID until authentication is implemented
export const TEMP_USER_ID = 1;
