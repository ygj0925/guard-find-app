/**
 * 社区动态(`/app/post`)——朋友圈形态。位置为用户手输,不申请定位权限。
 */
import { api } from '../client';

export interface CommunityPost {
  id: string;
  userId: string;
  nickname: string | null;
  avatar: string | null;
  content: string;
  images: string[];
  locationName: string | null;
  longitude?: number | null;
  latitude?: number | null;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
  createTime?: string;
}

export interface CommunityComment {
  id: string;
  userId: string;
  nickname: string | null;
  avatar: string | null;
  content: string;
  createTime?: string;
}

export interface PostCreateReq {
  content: string;
  images?: string[];
  locationName?: string;
  longitude?: number;
  latitude?: number;
}

export function createPost(req: PostCreateReq): Promise<number> {
  return api.post<number>('/app/post', req);
}

export function fetchPosts(page: number, size: number): Promise<{ records: CommunityPost[]; total: number }> {
  return api.get<{ records: CommunityPost[]; total: number }>('/app/post/page', { page, size });
}

export function fetchMyPosts(page: number, size: number): Promise<{ records: CommunityPost[]; total: number }> {
  return api.get<{ records: CommunityPost[]; total: number }>('/app/post/mine', { page, size });
}

export function fetchPostDetail(id: string): Promise<CommunityPost> {
  return api.get<CommunityPost>(`/app/post/${id}`);
}

export function fetchPostComments(id: string): Promise<CommunityComment[]> {
  return api.get<CommunityComment[]>(`/app/post/${id}/comment`);
}

export function createPostComment(id: string, content: string): Promise<number> {
  return api.post<number>(`/app/post/${id}/comment`, { content });
}

export function togglePostLike(id: string): Promise<boolean> {
  return api.post<boolean>(`/app/post/${id}/like`);
}

export function deletePost(id: string): Promise<void> {
  return api.delete<void>(`/app/post/${id}`);
}
