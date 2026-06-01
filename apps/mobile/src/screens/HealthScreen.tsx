import { StyleSheet, Text, View } from 'react-native';

export default function HealthScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Grovio Mobile</Text>
      <Text style={styles.status}>
        Status: ok
      </Text>
      <Text style={styles.version}>
        v0.1.0
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 12,
  },
  status: {
    fontSize: 16,
    color: '#16a34a',
    marginBottom: 4,
  },
  version: {
    fontSize: 14,
    color: '#6b7280',
  },
});
