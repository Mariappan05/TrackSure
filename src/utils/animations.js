import { Animated, Easing } from 'react-native';

export const fadeIn = (animatedValue, duration = 300) => {
  Animated.timing(animatedValue, {
    toValue: 1,
    duration,
    easing: Easing.ease,
    useNativeDriver: true,
  }).start();
};

export const fadeOut = (animatedValue, duration = 300) => {
  Animated.timing(animatedValue, {
    toValue: 0,
    duration,
    easing: Easing.ease,
    useNativeDriver: true,
  }).start();
};

export const slideUp = (animatedValue, duration = 400) => {
  Animated.spring(animatedValue, {
    toValue: 0,
    tension: 50,
    friction: 7,
    useNativeDriver: true,
  }).start();
};

export const scaleIn = (animatedValue, duration = 300) => {
  Animated.spring(animatedValue, {
    toValue: 1,
    tension: 100,
    friction: 7,
    useNativeDriver: true,
  }).start();
};
