export interface Series {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  cover_url: string | null;
  banner_url: string | null;
  author: string | null;
  artist: string | null;
  type: 'manga' | 'novel';
  status: 'ongoing' | 'completed' | 'hiatus';
  genres: string[];
  is_trending: boolean;
  is_popular: boolean;
  rating: number;
  view_count: number;
  created_at: string;
  updated_at: string;
}

export interface Chapter {
  id: string;
  series_id: string;
  number: number;
  title: string | null;
  is_premium: boolean;
  price: number;
  created_at: string;
  updated_at: string;
}

export interface ChapterPage {
  id: string;
  chapter_id: string;
  page_number: number;
  image_url: string;
}

export interface SiteSettings {
  id: boolean;
  site_name: string;
  seo_description: string;
  hero_title: string;
  hero_subtitle: string;
}

export type Tables<T extends keyof DatabaseTables> = DatabaseTables[T];

interface DatabaseTables {
  series: Series;
  chapters: Chapter;
  chapter_pages: ChapterPage;
  site_settings: SiteSettings;
}
