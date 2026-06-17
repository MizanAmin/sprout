import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import { supabase } from '@sprout/db/native';

// Initial route ('/'): decide where to send the user once the persisted session
// has been read. Without this screen, '/' has nothing to render and the app
// shows a blank page until the layout's auth guard kicks in.
export default function Index() {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setAuthed(!!data.session);
      setReady(true);
    });
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#4f8ef7" />
      </View>
    );
  }

  return <Redirect href={authed ? '/(tabs)' : '/(auth)/login'} />;
}
