import config from '@accedo/xdk-config';

const defaultConfig = {
  'register-exit-key': true,
  'bubble-native-key-event': false,
};

defaultConfig[config.KEY.NETWORK] = {
  polling: {
    interval: 30,
    'consec-failure-threshold': 3,
    url: undefined,
  },
};

defaultConfig[config.KEY.PLAYERS] = [
  {
    id: 'samsung-avplayer',
    importer: () => import('@accedo/xdk-device-samsung-tizen/esm/player/AVPlayer.js'),
    extensions: [
      {
        type: 'drm',
        importer: () =>
          import('@accedo/xdk-device-samsung-tizen/esm/player/extension/PlayreadyDRMAgent.js'),
        config: {
          scheme: 'playready',
        },
      },
      {
        type: 'drm',
        importer: () =>
          import('@accedo/xdk-device-samsung-tizen/esm/player/extension/WidevineDRMAgent.js'),
        config: {
          scheme: 'widevine',
        },
      },
      {
        type: 'audio-track',
        importer: () =>
          import('@accedo/xdk-device-samsung-tizen/esm/player/extension/AVPlayerAudioTrack.js'),
      },
      {
        type: 'subtitle',
        importer: () => import('./player/extension/AVPlayerSubtitles'),
        config: {
          location: 'internal',
        },
      },
      {
        type: 'subtitle',
        importer: () => import('./player/extension/AVPlayerExternalSubtitles'),
        config: {
          location: 'external',
        },
      },
    ],
    'connection-timeout': 90,
    'buffering-timeout': 10,
    'log-blacklist': null,
  },
  {
    id: 'html5player',
    importer: () => import(`@accedo/xdk-core/esm/device/player/HTML5Player.js`),
    extensions: [
      {
        type: 'subtitle',
        importer: () =>
          import(`@accedo/xdk-core/esm/device/player/extension/HTML5PlayerExternalSubtitle.js`),
        config: {
          location: 'external',
        },
      },
      {
        type: 'audio-track',
        importer: () =>
          import(`@accedo/xdk-core/esm/device/player/extension/HTML5PlayerAudioTrack.js`),
      },
    ],
  },
];

defaultConfig[config.KEY.STORAGES] = [
  {
    type: 'local',
    importer: () => import(`@accedo/xdk-core/esm/device/storage/Local.js`),
  },
  {
    type: 'cookie',
    importer: () => import(`@accedo/xdk-core/esm/device/storage/Cookie.js`),
  },
];

defaultConfig[config.KEY.EXTENSIONS] = [
  {
    id: 'samsung-tizen/extension/camera',
    type: 'camera',
  },
];

export default defaultConfig;
