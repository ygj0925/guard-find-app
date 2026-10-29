/**
 * 音乐播放器:添加本地音频 → 播放列表 → 播放控制/进度。
 * 能力分派:Web=HTML5 Audio 完整可用;鸿蒙=unsupported 降级文案(原生音频模块未验证);
 * 播放列表元数据本地持久化(uri 失效的曲目会标"需重新添加")。
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Pause, Play, SkipBack, SkipForward } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState, SectionCard } from '@/components/business/feedback';
import { DraggableProgress } from '@/components/ui/draggable-progress';
import {
  formatTrackTime,
  musicPlayer,
  nextIndex,
  prevIndex,
  ratioToSeconds,
  type MusicTrack,
} from '@/lib/capabilities';
import { kvGetJson, kvSetJson } from '@/lib/storage/kv';
import { useColorScheme } from '@/hooks/useColorScheme';
import { token } from '@/constants/Colors';
import { useToast } from '@/providers/ToastProvider';

const PLAYLIST_KEY = 'guardfind.music-playlist.v1';

interface StoredTrack {
  uri: string;
  name: string;
}

export default function MusicScreen() {
  const { toast } = useToast();
  const scheme = useColorScheme() ?? 'light';

  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [state, setState] = useState({ index: -1, playing: false, position: 0, duration: 0 });
  const stateRef = useRef(state);
  // 轮询读取用最新快照;规则禁止渲染期访问 ref.current,用 effect 同步
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    void (async () => {
      const stored = await kvGetJson<StoredTrack[]>(PLAYLIST_KEY, []);
      setTracks(Array.isArray(stored) ? stored : []);
      setLoaded(true);
    })();
  }, []);

  // 轮询播放状态(500ms),避免事件监听泄漏
  useEffect(() => {
    const timer = setInterval(() => {
      const snapshot = musicPlayer.snapshot();
      const current = stateRef.current;
      if (
        snapshot.index !== current.index ||
        snapshot.playing !== current.playing ||
        Math.abs(snapshot.position - current.position) > 0.2 ||
        Math.abs(snapshot.duration - current.duration) > 0.5
      ) {
        setState(snapshot);
      }
    }, 500);
    return () => clearInterval(timer);
  }, []);

  const available = musicPlayer.isAvailable();

  const addTracks = useCallback(async () => {
    const picked = await musicPlayer.pickTracks(20);
    if (!picked.ok) {
      toast(picked.message, 'warn');
      return;
    }
    setTracks((prev) => {
      const next = [...prev, ...picked.value];
      void kvSetJson(PLAYLIST_KEY, next.map((t) => ({ uri: t.uri, name: t.name })));
      return next;
    });
    toast(`已添加 ${picked.value.length} 首`, 'success');
  }, [toast]);

  const playTrack = useCallback(
    (index: number) => {
      musicPlayer.load(tracks, index);
      musicPlayer.play();
      setState((prev) => ({ ...prev, index, playing: true }));
    },
    [tracks],
  );

  const togglePlay = useCallback(() => {
    if (state.index < 0) {
      if (tracks.length > 0) playTrack(0);
      return;
    }
    if (state.playing) musicPlayer.pause();
    else musicPlayer.play();
    setState((prev) => ({ ...prev, playing: !prev.playing }));
  }, [playTrack, state, tracks]);

  const skip = useCallback(
    (direction: 'next' | 'prev') => {
      const index = direction === 'next' ? nextIndex(state.index, tracks.length) : prevIndex(state.index, tracks.length);
      if (index >= 0) playTrack(index);
    },
    [playTrack, state.index, tracks.length],
  );

  const current = state.index >= 0 ? tracks[state.index] : null;
  const progress = state.duration > 0 ? state.position / state.duration : 0;

  const currentCard = useMemo(() => {
    if (!current) return null;
    return (
      <Card className="mb-3 p-4">
        <Text className="text-foreground text-lg font-bold" numberOfLines={1}>
          {current.name}
        </Text>
        <Text className="text-muted-foreground mt-1 text-xs">
          第 {(state.index + 1).toString()} 首 / 共 {tracks.length} 首 · {musicPlayer.kind.includes('web') ? 'Web Audio' : '原生'}
        </Text>
        {/* 吸附卡+画线:拖动画线跟随,松手吸附 seek */}
        <DraggableProgress
          progress={progress}
          onDrag={(ratio) => setState((prev) => ({ ...prev, position: ratio * prev.duration }))}
          onSeek={(ratio) => musicPlayer.seek(ratioToSeconds(ratio, state.duration))}
          activeColor={token('primary', scheme)}
          trackColor={token('muted', scheme)}
        />
        <View className="mt-1 flex-row justify-between">
          <Text className="text-muted-foreground text-xs">{formatTrackTime(state.position)}</Text>
          <Text className="text-muted-foreground text-xs">{formatTrackTime(state.duration)}</Text>
        </View>
        <View className="mt-3 flex-row items-center justify-center" style={{ gap: 24 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="上一首" onPress={() => skip('prev')} className="p-2">
            <Icon as={SkipBack} size={24} className="text-foreground" />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={state.playing ? '暂停' : '播放'}
            onPress={togglePlay}
            className="h-14 w-14 items-center justify-center rounded-full"
            style={{ backgroundColor: token('primary', scheme) }}
          >
            <Icon as={state.playing ? Pause : Play} size={24} className="text-primary-foreground" />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="下一首" onPress={() => skip('next')} className="p-2">
            <Icon as={SkipForward} size={24} className="text-foreground" />
          </Pressable>
        </View>
      </Card>
    );
  }, [current, progress, scheme, skip, state, togglePlay, tracks.length]);

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <View className="flex-1 px-4">
        <View className="mb-3 mt-2 flex-row items-center justify-between">
          <View>
            <Text className="text-2xl font-bold">音乐</Text>
            <Text className="text-muted-foreground mt-1 text-sm">播放本地音频 · {tracks.length} 首歌单</Text>
          </View>
          <Button onPress={() => void addTracks()}>
            <Text>添加音频</Text>
          </Button>
        </View>

        {!available ? (
          <SectionCard
            title="当前设备暂不支持本地音乐播放"
            description="原生音频模块需要实机验证后接入;Web 预览环境可完整体验。"
          >
            {null}
          </SectionCard>
        ) : (
          <>
            {currentCard}
            {loaded && tracks.length === 0 ? (
              <EmptyState title="歌单是空的" description="点右上角「添加音频」从手机里选歌" />
            ) : (
              <Card className="p-2">
                {tracks.map((track, index) => (
                  <Pressable
                    key={`${track.uri}:${index}`}
                    accessibilityRole="button"
                    accessibilityLabel={`播放 ${track.name}`}
                    onPress={() => playTrack(index)}
                    className={`flex-row items-center rounded-lg px-2 py-2.5 ${index === state.index ? 'bg-accent' : ''}`}
                    style={{ gap: 8 }}
                  >
                    <Text
                      className={`text-xs font-bold ${index === state.index ? 'text-primary' : 'text-muted-foreground'}`}
                    >
                      {index === state.index && state.playing ? '♪' : index + 1}
                    </Text>
                    <Text
                      className={`flex-1 text-sm ${index === state.index ? 'text-primary font-semibold' : 'text-foreground'}`}
                      numberOfLines={1}
                    >
                      {track.name}
                    </Text>
                  </Pressable>
                ))}
              </Card>
            )}
          </>
        )}
      </View>
    </SafeAreaView>
  );
}
