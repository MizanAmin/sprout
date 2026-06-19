import { ScrollView, Pressable, Text } from 'react-native';
import { useStore } from '../store';

// Child pills shown on the indigo app header for multi-child parents. Hidden when
// the parent has a single child (the header already shows that child).
export function ChildSwitcher() {
  const children = useStore((s) => s.children);
  const activeChildId = useStore((s) => s.activeChildId);
  const setActiveChild = useStore((s) => s.setActiveChild);

  if (children.length <= 1) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="px-4 pb-3 gap-2"
    >
      {children.map((child) => {
        const active = child.id === activeChildId;
        return (
          <Pressable
            key={child.id}
            onPress={() => setActiveChild(child.id)}
            className={`rounded-full px-4 py-1.5 ${active ? 'bg-white' : 'bg-white/20'}`}
          >
            <Text className={`text-sm font-semibold ${active ? 'text-primary' : 'text-white'}`}>
              {child.name.split(' ')[0]}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
