import { useState } from 'react';
import { FlatList, View, Text, Image, Pressable, Modal, RefreshControl } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../src/api';
import { useStore } from '../../src/store';
import { relativeDate } from '../../src/date';
import { Card, Pill, EmptyState, Loading } from '../../src/ui';
import { colors } from '../../src/theme';

interface Observation {
  id: number;
  obs_date: string;
  text: string;
  areas: string[];
  photo_url: string;
  practitioner: string;
}

export default function Journal() {
  const activeChildId = useStore((s) => s.activeChildId);
  const [photo, setPhoto] = useState<string | null>(null);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['observations', activeChildId],
    queryFn: () => api.get<Observation[]>(`/parent/observations?childId=${activeChildId}`),
    enabled: !!activeChildId,
  });

  if (isLoading) {
    return (
      <View className="flex-1 bg-bg">
        <Loading />
      </View>
    );
  }

  return (
    <>
      <FlatList
        className="flex-1 bg-bg"
        contentContainerClassName="p-4 gap-4"
        showsVerticalScrollIndicator={false}
        data={data ?? []}
        keyExtractor={(o) => String(o.id)}
        refreshControl={
          <RefreshControl
            refreshing={isFetching}
            onRefresh={refetch}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        ListEmptyComponent={
          <EmptyState
            emoji="📖"
            title="No journal entries yet"
            subtitle="Shared observations and photos from your nursery will appear here."
          />
        }
        renderItem={({ item }) => (
          <Card className="overflow-hidden p-0">
            {!!item.photo_url && (
              <Pressable onPress={() => setPhoto(item.photo_url)}>
                <Image source={{ uri: item.photo_url }} className="h-52 w-full" resizeMode="cover" />
              </Pressable>
            )}
            <View className="p-4">
              {item.areas?.length > 0 && (
                <View className="mb-2 flex-row flex-wrap gap-1.5">
                  {item.areas.map((a) => (
                    <Pill key={a} label={a} bg="#f1f5f9" fg={colors.muted} />
                  ))}
                </View>
              )}
              <Text className="text-sm leading-5 text-gray-900">{item.text}</Text>
              <Text className="mt-2 text-xs text-muted">
                {relativeDate(item.obs_date)}
                {item.practitioner ? ` · ${item.practitioner}` : ''}
              </Text>
            </View>
          </Card>
        )}
      />

      <Modal visible={!!photo} transparent onRequestClose={() => setPhoto(null)}>
        <Pressable
          className="flex-1 items-center justify-center bg-black/90"
          onPress={() => setPhoto(null)}
        >
          {!!photo && <Image source={{ uri: photo }} className="h-full w-full" resizeMode="contain" />}
        </Pressable>
      </Modal>
    </>
  );
}
