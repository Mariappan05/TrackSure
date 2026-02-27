import React, { useEffect, useRef } from 'react';
import { View, Image, StyleSheet, Animated, Easing } from 'react-native';

export default function SplashScreen({ onFinish }) {
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const wave1 = useRef(new Animated.Value(0)).current;
  const wave2 = useRef(new Animated.Value(0)).current;
  const wave3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Logo fade in and scale
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 4,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    // Beat waves animation
    const createWave = (wave, delay) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(wave, {
            toValue: 1,
            duration: 1500,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(wave, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      );
    };

    createWave(wave1, 0).start();
    createWave(wave2, 500).start();
    createWave(wave3, 1000).start();

    // Finish after 3 seconds
    setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start(() => onFinish());
    }, 3000);
  }, []);

  return (
    <View style={styles.container}>
      {/* Wave 1 */}
      <Animated.View
        style={[
          styles.wave,
          {
            opacity: wave1.interpolate({
              inputRange: [0, 1],
              outputRange: [0.6, 0],
            }),
            transform: [
              {
                scale: wave1.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 2.5],
                }),
              },
            ],
          },
        ]}
      />
      
      {/* Wave 2 */}
      <Animated.View
        style={[
          styles.wave,
          {
            opacity: wave2.interpolate({
              inputRange: [0, 1],
              outputRange: [0.4, 0],
            }),
            transform: [
              {
                scale: wave2.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 2.5],
                }),
              },
            ],
          },
        ]}
      />
      
      {/* Wave 3 */}
      <Animated.View
        style={[
          styles.wave,
          {
            opacity: wave3.interpolate({
              inputRange: [0, 1],
              outputRange: [0.3, 0],
            }),
            transform: [
              {
                scale: wave3.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 2.5],
                }),
              },
            ],
          },
        ]}
      />

      {/* Logo */}
      <Animated.View
        style={[
          styles.logoContainer,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <Image
          source={require('../../assets/logo.png')}
          style={styles.logo}
          resizeMode="cover"
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1E3A8A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    width: 200,
    height: 200,
    borderRadius: 100,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  logo: {
    width: 200,
    height: 200,
    borderRadius: 100,
  },
  wave: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 3,
    borderColor: '#10B981',
  },
});
