/**
 * 档案详情(spec: 卡片与详情的脱敏展示 / 地图入口明示未开放)。
 *
 * 三条硬规则:
 *   1. 未登录也能看,数据是契约 2 节的 `CasePublic`(时间只到月、地区只到市、无联系方式);
 *      已登录时先试 `GET /app/find/case/{id}/full`,越权(403)静默回落到脱敏版;
 *   2. 一期不申请定位权限:地图入口只做"将在后续版本提供"的明示 + 文字地址复制;
 *   3. 联系方式永不出现在公开视图,唯一的联系入口是"提交线索"。
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Heart, MapPin, Share2 } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Skeleton } from '@/components/ui/skeleton';
import { RemoteImage } from '@/components/business/RemoteImage';
import {
  CaseStatusBadge,
  MissingDuration,
  UrgencyBadge,
} from '@/components/business/status-badges';
import { EmptyState, ErrorState, InlineRow, SectionCard } from '@/components/business/feedback';
import { AgreementLinks, AntiFraudNotice } from '@/components/business/compliance';
import { useRequest } from '@/hooks/useRequest';
import { caseApi, type CaseDetail, type CasePublic } from '@/lib/api/endpoints/case';
import { ApiError } from '@/lib/api/error';
import { env } from '@/lib/env';
import { clipboard } from '@/lib/capabilities';
import {
  GENDER_LABEL,
  URGENCY_LABEL,
  caseAgeText,
  formatDateTime,
  formatMissingMonth,
} from '@/lib/format';
import { shareCase } from '@/lib/share/case-share';
import { trackCaseExpose } from '@/lib/track';
import { useFilters } from '@/providers/FiltersProvider';
import { favoriteRunId, useSessionGuard } from '@/providers/SessionProvider';
import { useToast } from '@/providers/ToastProvider';
import { useFavorites } from '@/store/favorites';
import { useSession } from '@/store/session';

export default function CaseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const caseId = Array.isArray(id) ? id[0] : id;
  const signedIn = useSession((state) => state.phase === 'authenticated');
  const user = useSession((state) => state.user);
  const { optionsOf } = useFilters();
  const { toast } = useToast();
  const { guard, takePendingRun } = useSessionGuard();

  const [full, setFull] = useState<CaseDetail | null>(null);
  /** 不支持系统分享时兜底展示的链接文本,必须在用到它的回调之前声明。 */
  const [manualLink, setManualLink] = useState<string | null>(null);

  const fetcher = useCallback(async (): Promise<CasePublic> => {
    if (signedIn) {
      try {
        const detail = await caseApi.detailFull(caseId);
        setFull(detail);
        return detail;
      } catch (error) {
        // 403/404 之外的越权形态都按"只看脱敏版"处理,不弹错误。
        setFull(null);
        if (error instanceof ApiError && (error.code === 403 || error.code === 404)) {
          if (error.code === 404) throw error;
        } else if (error instanceof ApiError && error.isNetwork) {
          throw error;
        }
      }
    }
    const detail = await caseApi.detail(caseId);
    return detail;
  }, [caseId, signedIn]);

  const request = useRequest(fetcher, [caseId, signedIn]);
  const item = request.data;

  const favoritesLoaded = useFavorites((state) => state.loaded);
  const favoriteMap = useFavorites((state) => state.byId);
  const loadFavorites = useFavorites((state) => state.load);
  const favorited = Boolean(caseId && favoriteMap[caseId]);

  useEffect(() => {
    void loadFavorites();
  }, [loadFavorites]);

  useEffect(() => {
    if (item) trackCaseExpose(item.id);
  }, [item]);

  // 未登录点收藏 -> 登录后自动补做那一次(spec: 未登录收藏被引导)。
  useEffect(() => {
    if (!signedIn || !favoritesLoaded || !item) return;
    const run = takePendingRun();
    if (run !== favoriteRunId(item.id)) return;
    void useFavorites.getState().toggle(item).then((added) => {
      toast(added ? '已加入收藏(仅本机)' : '已取消收藏', 'success');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn, favoritesLoaded, item]);

  const caseTypeLabel = useMemo(() => {
    if (!item) return '';
    const hit = optionsOf('caseTypes').find((option) => option.value === item.caseType);
    return hit?.label ?? item.caseType;
  }, [item, optionsOf]);

  const toggleFavorite = useCallback(() => {
    if (!item) return;
    if (!signedIn) {
      guard({ href: `/case/${item.id}`, run: favoriteRunId(item.id), label: 'favorite' });
      toast('登录后才能收藏,已为你跳到登录页', 'info');
      return;
    }
    void useFavorites
      .getState()
      .toggle(item)
      .then((added) => {
        toast(added ? '已加入收藏(仅本机,跨设备同步待服务端端点)' : '已取消收藏');
      });
  }, [guard, item, signedIn, toast]);

  const onShare = useCallback(async () => {
    if (!item) return;
    const outcome = await shareCase(item);
    if (outcome.kind === 'shared') toast('已唤起系统分享', 'success');
    else if (outcome.kind === 'copied') toast(outcome.message, 'info');
    else if (outcome.kind === 'manual-copy') {
      toast('当前设备不支持一键分享,请长按复制下方链接', 'warn');
      setManualLink(outcome.message);
    }
  }, [item, toast]);

  const maskedAddress = item
    ? `${item.regionText || '地区未知'}${item.districtText ? ` ${item.districtText}` : ''}`
    : '';
  const detailedAddress = full?.address ?? null;

  const copyAddress = useCallback(async () => {
    const text = detailedAddress
      ? `${maskedAddress} ${detailedAddress}`
      : `${maskedAddress}(详细地址仅档案所有人可见)`;
    const result = await clipboard.copy(text);
    toast(
      result.ok ? '地址已复制' : `${result.message}(本区文字可直接长按选中)`,
      result.ok ? 'success' : 'warn',
    );
  }, [detailedAddress, maskedAddress, toast]);

  if (request.isInitialLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background p-4">
        <Skeleton className="h-52 rounded-xl" />
        <Skeleton className="mt-3 h-6 w-1/2" />
        <Skeleton className="mt-6 h-32 rounded-xl" />
      </SafeAreaView>
    );
  }

  if (request.error && !item) {
    const notFound = request.error instanceof ApiError && request.error.code === 404;
    return (
      <SafeAreaView className="flex-1 bg-background">
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          {notFound ? (
            <EmptyState
              title="信息不存在或已下架"
              description="该档案可能已被撤回、下架或删除;如你仍掌握线索,请联系运营方核实。"
              actionLabel="回到广场"
              onAction={() => router.replace('/(tabs)/plaza')}
            />
          ) : (
            <ErrorState error={request.error} onRetry={() => void request.reload()} />
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (!item) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <EmptyState title="没有可展示的档案" actionLabel="回到广场" onAction={() => router.replace('/(tabs)/plaza')} />
      </SafeAreaView>
    );
  }

  const gallery = [item.coverUrl, ...item.mediaUrls].filter((url): url is string => Boolean(url));
  const urgent = item.urgencyLevel !== 'NORMAL';
  const found = item.status === 'FOUND';

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ paddingBottom: 96 }}>
        {gallery.length ? (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            style={{ height: 260 }}
          >
            {gallery.map((url) => (
              <RemoteImage
                key={url}
                uri={url}
                resizeMode="contain"
                fallbackLabel="照片暂不可见"
                style={{ width: 320, height: 260 }}
              />
            ))}
          </ScrollView>
        ) : (
          <View className="bg-muted items-center justify-center py-12">
            <Text className="text-muted-foreground text-sm">该档案暂无照片</Text>
          </View>
        )}

        <View className="px-4 pt-4">
          <View className="flex-row items-center gap-2">
            <Text className="text-2xl font-bold">{item.name}</Text>
            {item.aliases?.length ? (
              <Text className="text-muted-foreground text-sm">别名 {item.aliases.join('、')}</Text>
            ) : null}
          </View>
          <View className="mt-2 flex-row flex-wrap items-center gap-2">
            <CaseStatusBadge status={item.status} />
            <UrgencyBadge level={item.urgencyLevel} />
            <Badge variant="outline">
              <Text>
                {GENDER_LABEL[item.gender]} · {caseAgeText(item)}
              </Text>
            </Badge>
            <Badge variant="outline">
              <Text>线索 {item.leadCount}</Text>
            </Badge>
          </View>

          <View className="mt-3">
            <MissingDuration hours={item.missingHours} urgent={urgent} />
            {urgent ? (
              <Text className="text-muted-foreground mt-1 text-xs">
                {URGENCY_LABEL[item.urgencyLevel]}档案,时长自服务端取数时刻起按分钟推进。
              </Text>
            ) : null}
          </View>

          {found ? (
            <View className="bg-found/10 mt-3 rounded-lg border border-found/40 p-3">
              <Text className="text-found text-sm font-semibold">
                该档案已标记找回,以下为历史发布信息,仅供核对。
              </Text>
            </View>
          ) : null}
        </View>

        <View className="px-4 pt-4">
          <AntiFraudNotice />

          <SectionCard title="失踪信息">
            <InlineRow label="失踪时间" value={formatMissingMonth(item.missingMonth)} />
            <InlineRow label="失踪地区" value={item.regionText || '未知'} />
            <InlineRow label="区/县" value={item.districtText ?? '未公开'} />
            <InlineRow label="情形" value={caseTypeLabel || '未填写'} />
            <InlineRow label="身高" value={item.height ? `${item.height} cm` : '未填写'} />
            <InlineRow label="体貌特征" value={item.features ?? '未填写'} selectable />
            <InlineRow label="发布时间" value={formatDateTime(item.publishTime)} />
            {item.sourceType && item.sourceType !== 'APP' ? (
              <InlineRow
                label="信息来源"
                value={`${item.sourceType}${item.sourceUrl ? ` ${item.sourceUrl}` : ''}`}
                selectable
              />
            ) : null}
            <InlineRow label="档案编号" value={item.id} selectable />
          </SectionCard>

          {full ? (
            <SectionCard title="完整信息(仅本人/志愿者/审核可见)" className="mt-3">
              <InlineRow label="失踪时间" value={formatDateTime(full.missingTime)} />
              <InlineRow label="出生日期" value={full.birthday ?? '未填写'} />
              <InlineRow label="户籍地" value={full.hometownText ?? '未填写'} />
              <InlineRow label="详细地址" value={full.address ?? '未填写'} selectable />
              <InlineRow label="体型" value={full.bodyType ?? '未填写'} />
              <InlineRow label="发型" value={full.hairType ?? '未填写'} />
              <InlineRow label="口音" value={full.accent ?? '未填写'} />
              <InlineRow label="衣着" value={full.clothing ?? '未填写'} />
              <InlineRow label="随身物品" value={full.belongings ?? '未填写'} />
              <InlineRow label="事件经过" value={full.narrative ?? '未填写'} selectable />
              <InlineRow label="家庭线索" value={full.familyClues ?? '未填写'} />
              <InlineRow label="是否报警" value={full.policeReported ? '是' : '否'} />
              <InlineRow label="受理派出所" value={full.policeStation ?? '未填写'} />
              <InlineRow label="血样采集" value={full.bloodSampleStatus ?? '未填写'} />
              <InlineRow label="联络方式" value={full.contactMode ?? '未填写'} />
              {full.contactPhone ? (
                <InlineRow label="联系电话" value={full.contactPhone} selectable />
              ) : null}
              {full.auditRemark ? (
                <InlineRow label="审核意见" value={full.auditRemark} selectable />
              ) : null}
            </SectionCard>
          ) : null}

          {/* 一期不申请定位权限:地图入口只做明示,并给出可复制的文字地址。 */}
          <SectionCard title="位置" className="mt-3">
            <View className="border-border items-start gap-2 rounded-lg border border-dashed p-3">
              <View className="flex-row items-center gap-2">
                <Icon as={MapPin} size={16} className="text-muted-foreground" />
                <Text className="text-muted-foreground text-sm">
                  地图定位将在后续版本提供
                </Text>
              </View>
              <Text selectable className="mt-2 text-sm">
                {maskedAddress}
                {detailedAddress ? ` ${detailedAddress}` : ''}
              </Text>
              {!detailedAddress ? (
                <Text className="text-muted-foreground mt-1 text-xs">
                  详细地址与联系电话不对公众展示,仅档案所有人可见。
                </Text>
              ) : null}
              <Button variant="outline" size="sm" className="mt-2" onPress={() => void copyAddress()}>
                <Text>复制地址文字</Text>
              </Button>
              {!clipboard.isAvailable() ? (
                <Text className="text-muted-foreground mt-1 text-xs">
                  当前设备不支持一键复制,请长按上方文字选中。
                </Text>
              ) : null}
            </View>
          </SectionCard>

          <View className="mt-3">
            <AgreementLinks version={env.AGREEMENT_VERSION} />
          </View>

          {manualLink ? (
            <Text selectable className="text-muted-foreground mt-3 text-xs">
              {manualLink}
            </Text>
          ) : null}
        </View>
      </ScrollView>

      {/* 主 CTA 固定在底部:规格要求"提交线索"是详情页第一动作。 */}
      <View className="border-border bg-card flex-row gap-3 border-t px-4 py-3">
        <Button
          testID="case-lead-cta"
          className="flex-1"
          onPress={() => router.push(`/case/${item.id}/lead`)}
        >
          <Text>提交线索</Text>
        </Button>
        <Button
          variant={favorited ? 'default' : 'outline'}
          onPress={toggleFavorite}
          accessibilityLabel={favorited ? '取消收藏' : '收藏'}
        >
          <Icon as={Heart} size={16} className={favorited ? 'text-primary-foreground' : 'text-foreground'} />
          <Text>{favorited ? '已收藏' : '收藏'}</Text>
        </Button>
        <Button variant="outline" onPress={() => void onShare()} accessibilityLabel="分享">
          <Icon as={Share2} size={16} />
          <Text>分享</Text>
        </Button>
      </View>
      {user && !user.boundPhone ? (
        <View className="bg-pending/10 px-4 py-2">
          <Text className="text-xs">提示:你还未绑定手机号,绑定后才能提交线索。</Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}
