
export type ToolType = 'all' | 'reels' | 'video' | 'photo' | 'stories' | 'igtv';

export interface BlogPost {
  id: string;
  title: string;
  excerpt: string;
  date: string;
  image: string;
  category: string;
  content: string;
}

export interface FAQItem {
  question: string;
  answer: string;
}

export interface NavLink {
  name: string;
  path: string;
  type: ToolType;
}
