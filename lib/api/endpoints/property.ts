/**
 * 房产房源(`/app/property`)。浏览已上架=所有用户;管理=仅房东本人。
 */
import { api } from '../client';

export type PropertyStatus = 1 | 2 | 3;
export type PropertyType = 'house' | 'apartment' | 'villa' | 'shop';
export type PriceType = 'rent' | 'sale';

export interface Property {
  id: string;
  userId: string;
  ownerNickname: string | null;
  ownerAvatar: string | null;
  ownerIsManager: boolean | null;
  title: string;
  description: string | null;
  propertyType: PropertyType;
  layout: string | null;
  areaSqm: number | null;
  floorInfo: string | null;
  orientation: string | null;
  decoration: string | null;
  price: number;
  priceType: PriceType;
  address: string;
  district: string | null;
  city: string | null;
  facilities: string[];
  contactName: string | null;
  contactPhone: string | null;
  status: PropertyStatus;
  viewCount: number;
  images: string[];
  createTime?: string;
}

export interface PropertyReq {
  title: string;
  description?: string;
  propertyType: PropertyType;
  layout?: string;
  areaSqm?: number;
  floorInfo?: string;
  orientation?: string;
  decoration?: string;
  price: number;
  priceType: PriceType;
  address: string;
  district?: string;
  city?: string;
  facilities?: string[];
  contactName?: string;
  contactPhone?: string;
  images?: string[];
  status: PropertyStatus;
}

export interface PropertyPage {
  records: Property[];
  total: number;
}

export function createProperty(req: PropertyReq): Promise<number> {
  return api.post<number>('/app/property', req);
}

export function fetchProperties(params: {
  page: number; size: number; city?: string; propertyType?: string; priceType?: string;
}): Promise<PropertyPage> {
  return api.get<PropertyPage>('/app/property/list', params);
}

export function fetchMyProperties(page: number, size: number): Promise<PropertyPage> {
  return api.get<PropertyPage>('/app/property/mine', { page, size });
}

export function fetchPropertyDetail(id: string): Promise<Property> {
  return api.get<Property>(`/app/property/${id}`);
}

export function updateProperty(id: string, req: PropertyReq): Promise<void> {
  return api.put<void>(`/app/property/${id}`, req);
}

export function deleteProperty(id: string): Promise<void> {
  return api.delete<void>(`/app/property/${id}`);
}

export function updatePropertyStatus(id: string, status: PropertyStatus): Promise<void> {
  return api.post<void>(`/app/property/${id}/status`, undefined, { params: { status } });
}
