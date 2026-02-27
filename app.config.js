export default {
  expo: {
    name: "TrackSure",
    slug: "tracksure",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/logo.png",
    userInterfaceStyle: "light",
    newArchEnabled: false,
    extra: {
      eas: {
        projectId: "db5d27be-279d-4d60-9077-69ad8d733e95"
      }
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.tracksure.app",
      config: {
        googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
      },
      infoPlist: {
        NSLocationWhenInUseUsageDescription: "TrackSure needs your location to track deliveries.",
        NSLocationAlwaysAndWhenInUseUsageDescription: "TrackSure needs your location to track deliveries in the background.",
        NSCameraUsageDescription: "TrackSure needs camera access to capture delivery proof photos.",
        NSPhotoLibraryUsageDescription: "TrackSure needs photo library access to save delivery proof."
      }
    },
    android: {
      package: "com.tracksure.app",
      usesCleartextTraffic: true,
      config: {
        googleMaps: {
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
        }
      },
      permissions: [
        "ACCESS_FINE_LOCATION",
        "ACCESS_COARSE_LOCATION",
        "CAMERA",
        "READ_EXTERNAL_STORAGE",
        "WRITE_EXTERNAL_STORAGE",
        "INTERNET",
        "ACCESS_NETWORK_STATE",
        "RECORD_AUDIO"
      ]
    },
    plugins: [
      [
        "expo-location",
        {
          locationAlwaysAndWhenInUsePermission: "Allow TrackSure to use your location for delivery tracking."
        }
      ],
      [
        "expo-image-picker",
        {
          photosPermission: "TrackSure needs access to your photos to capture delivery proof.",
          cameraPermission: "TrackSure needs camera access to capture delivery proof photos."
        }
      ],
      "expo-asset"
    ]
  }
};
