/**
 * 社交关注(`/app/social`)——关注/粉丝/计数。
 */
import { api } from '../client';

export interface SocialUserBrief {
  userId: string;
  nickname: string | null;
  avatar: string | null;
  createTime?: string;
  /** 当前登录用户是否已关注该用户。 */
  followedByMe: boolean;
}

export interface SocialCounts {
  followingCount: number;
  followerCount: number;
  postCount: number;
  followedByMe: boolean;
}

/** 关注;返回 true=本次新关注, false=原本已关注。 */
export function followUser(userId: string): Promise<boolean> {
  return api.post<boolean>(`/app/social/follow/${userId}`);
}

export function unfollowUser(userId: string): Promise<void> {
  return api.post<void>(`/app/social/unfollow/${userId}`);
}

export function fetchFollowing(page: number, size: number): Promise<{ records: SocialUserBrief[]; total: number }> {
  return api.get('/app/social/following', { page, size });
}

export function fetchFollowers(page: number, size: number): Promise<{ records: SocialUserBrief[]; total: number }> {
  return api.get('/app/social/followers', { page, size });
}

export function fetchSocialCounts(userId: string): Promise<SocialCounts> {
  return api.get<SocialCounts>(`/app/social/counts/${userId}`);
}
