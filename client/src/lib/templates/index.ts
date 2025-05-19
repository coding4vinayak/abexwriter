import { novelTemplate } from './novel';
import { academicTemplate } from './academic';
import { technicalTemplate } from './technical';
import { businessTemplate } from './business';
import { screenplayTemplate } from './screenplay';
import { shortStoryTemplate } from './short_story';
import { nonfictionTemplate } from './nonfiction';
import { blogTemplate } from './blog';

export type Template = {
  name: string;
  description: string;
  promptTemplate: string;
  exampleText: string;
};

export const templateTypes = [
  { value: "none", label: "No Template" },
  { value: "novel", label: "Novel" },
  { value: "academic", label: "Academic Writing" },
  { value: "technical", label: "Technical Documentation" },
  { value: "business", label: "Business Document" },
  { value: "screenplay", label: "Screenplay" },
  { value: "short_story", label: "Short Story" },
  { value: "nonfiction", label: "Non-Fiction" },
  { value: "blog", label: "Blog Post" }
];

export const templates: Record<string, Template> = {
  novel: novelTemplate,
  academic: academicTemplate,
  technical: technicalTemplate,
  business: businessTemplate,
  screenplay: screenplayTemplate,
  short_story: shortStoryTemplate,
  nonfiction: nonfictionTemplate,
  blog: blogTemplate
};

export function getTemplate(type: string): Template | null {
  return templates[type] || null;
}