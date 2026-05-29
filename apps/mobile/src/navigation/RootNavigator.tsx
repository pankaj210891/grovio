import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HealthScreen from '../screens/HealthScreen';

export type RootStackParamList = {
  Health: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  return (
    <Stack.Navigator initialRouteName="Health">
      <Stack.Screen
        name="Health"
        component={HealthScreen}
        options={{ title: 'Grovio' }}
      />
    </Stack.Navigator>
  );
}
