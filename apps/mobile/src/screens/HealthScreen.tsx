import { StyleSheet, Text, View } from 'react-native';
import type { HealthCheckResponse } from '@grovio/contracts';

export default function HealthScreen() {
  // Declares a variable typed as HealthCheckResponse to prove the import resolves correctly
  const healthData: HealthCheckResponse = {
    status: 'ok',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Grovio Mobile</Text>
      <Text style={styles.status}>
        Status: {healthData.status}
      </Text>
      <Text style={styles.version}>
        v{healthData.version}
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
