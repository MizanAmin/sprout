import { ScrollView, Pressable, Text } from 'react-native';
import { useStore } from '../store';

// Persistent top-of-screen pill row for multi-child parents. Hidden when the
// parent has a single child. Rendered in (tabs)/_layout above the tab content.
export function ChildSwitcher() {
  const children = useStore((s) => s.children);
  const activeChildId = useStore((s) => s.activeChildId);
  const setActiveChild = useStore((s) => s.setActiveChild);

  if (children.length <= 1) return null;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-4 py-2">
      {children.map((child) => (
        <Pressable
          key={child.id}
          onPress={() => setActiveChild(child.id)}
          className={`mr-2 rounded-full px-4 py-1 ${
            child.id === activeChildId ? 'bg-primary' : 'bg-gray-100'
          }`}
        >
          <Text className={child.id === activeChildId ? 'text-white' : 'text-gray-700'}>
            {child.name.split(' ')[0]}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
