import { useQuery } from '@tanstack/react-query';
import { api, type MeResponse } from './client';
import type { StageDef } from '../data/stages';
import { STAGES as FALLBACK } from '../data/stages';

export function useMe() {
  return useQuery<MeResponse>({
    queryKey: ['me'],
    queryFn: () => api.get<MeResponse>('/api/me'),
    retry: false,
    staleTime: 30_000,
  });
}

export function useStages() {
  return useQuery<StageDef[]>({
    queryKey: ['stages'],
    queryFn: () => api.get<StageDef[]>('/api/stages'),
    staleTime: 60_000,
    // fallback пока бек не ответил
    placeholderData: FALLBACK,
  });
}

export interface IntroGoal {
  title: string;
  text: string;
}

export interface IntroGalleryItem {
  image?: string;
  label?: string;
  caption?: string;
  alt?: string;
}

export interface IntroContent {
  title: string;
  mission: string;
  values: string[];
  instruction: string;
  goals: IntroGoal[];
  gallery: IntroGalleryItem[];
}

export function usePublicIntro() {
  // FR-102: контент этапа 1 редактируется HR в админке.
  // retry: false — публичная страница обязана рендериться даже без бэкенда,
  // компонент держит локальные фолбэки на каждый слот.
  return useQuery<IntroContent>({
    queryKey: ['public-intro'],
    queryFn: () => api.get<IntroContent>('/api/public/intro'),
    retry: false,
    staleTime: 60_000,
  });
}
