import { useState } from 'react';
import {
  FlatList,
  View,
  Text,
  Image,
  Pressable,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../src/api';
import { useStore } from '../../src/store';

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

  const { data, isLoading } = useQuery({
    queryKey: ['observations', activeChildId],
    queryFn: () => api.get<Observation[]>(`/parent/observations?childId=${activeChildId}`),
    enabled: !!activeChildId,
  });

  if (isLoading) return <ActivityIndicator className="mt-8" />;

  return (
    <>
      <FlatList
        className="flex-1 bg-bg"
        contentContainerClassName="p-4 gap-4"
        data={data ?? []}
        keyExtractor={(o) => String(o.id)}
        ListEmptyComponent={
          <View className="rounded-2xl border border-dashed border-border p-8">
            <Text className="text-center text-muted">No shared observations yet.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View className="overflow-hidden rounded-2xl bg-surface">
            {!!item.photo_url && (
              <Pressable onPress={() => setPhoto(item.photo_url)}>
                <Image source={{ uri: item.photo_url }} className="h-48 w-full" resizeMode="cover" />
              </Pressable>
            )}
            <View className="p-4">
              {item.areas?.length > 0 && (
                <View className="mb-2 flex-row flex-wrap gap-1">
                  {item.areas.map((a) => (
                    <View key={a} className="rounded-full bg-gray-100 px-2 py-0.5">
                      <Text className="text-xs text-gray-700">{a}</Text>
                    </View>
                  ))}
                </View>
              )}
              <Text className="text-sm text-gray-900">{item.text}</Text>
              <Text className="mt-2 text-xs text-muted">
                {item.obs_date}
                {item.practitioner ? ` · ${item.practitioner}` : ''}
              </Text>
            </View>
          </View>
        )}
      />

      <Modal visible={!!photo} transparent onRequestClose={() => setPhoto(null)}>
        <Pressable
          className="flex-1 items-center justify-center bg-black/90"
          onPress={() => setPhoto(null)}
        >
          {!!photo && (
            <Image source={{ uri: photo }} className="h-full w-full" resizeMode="contain" />
          )}
        </Pressable>
      </Modal>
    </>
  );
}
